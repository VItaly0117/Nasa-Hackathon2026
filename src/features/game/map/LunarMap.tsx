import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ModuleDef, ModuleType } from "@/types";
import { MAP_LAYOUT, BUILD_RADIUS, getTileInfo, inBuildZone, slotOf, cellOf } from "@/engine";
import type { Terrain, TileInfo } from "@/engine";
import { IMAGE_SIZE, MAP_W, MAP_H, TILE_W, TILE_H, tileCenter } from "@/content/map";
import { moduleName, t, tDynamic } from "@/i18n";
import { ArtDefs, Ice, ModuleArt } from "./art";
import { ART_HEIGHT } from "./art-size";
import { MapBackground } from "./MapBackground";
import { Walkers } from "./Walkers";
import type { WalkTarget } from "./Walkers";
import "./LunarMap.css";

interface LunarMapProps {
  modules: MapModule[];
  defs: ModuleDef[];
  isNight: boolean;
  buildType: ModuleType | null;
  surveyingIce?: boolean;
  crewActive: boolean;
  sickCrewIds?: number[]; // кто из астронавтов болеет (стоят на месте)
  canPlaceAt: (row: number, col: number) => boolean;
  canAffordRepair?: boolean;
  onRepairModule?: (slot: number) => void;
  onSelectTile?: (tile: TileInfo) => void;
  // Живые части стройки (полоска и проценты). Отдельно от modules: прогресс меняется 10 раз в секунду,
  // а карта при этом не должна перерисовываться. Эти части подписываются на время сами
  renderBuild?: { progress: (module: MapModule) => ReactNode; percent: (module: MapModule) => ReactNode };
}

// Что карте нужно знать о модуле. Время стройки (leftMs) сюда намеренно не входит
export type MapModule = { slot: number; type: ModuleType; broken: boolean; building: boolean; waiting: boolean };

const OK_COLOR = "#4ADE80";
const BAD_COLOR = "#FF6B6B";

// Рисунки модулей по размеру подобраны под ракету на фоновой картинке
const ART_SCALE = 1.7;
const BUBBLE_W = 300;
const BUBBLE_H = 140;
const DRAG_THRESHOLD = 6;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.6;
const START_ZOOM = 0.85;

// Карта — фоновая картинка, клетки размечены поверх неё в data/map.ts.
// Горизонт и горы нарисованы на картинке, поэтому своей кривизны горизонта здесь нет
const getPosition = tileCenter;

const diamond = (x: number, y: number) =>
  [
    `${x},${y - TILE_H / 2}`,
    `${x + TILE_W / 2},${y}`,
    `${x},${y + TILE_H / 2}`,
    `${x - TILE_W / 2},${y}`,
  ].join(" ");

const getTerrainName = (terrain: Terrain) => t(`terrain.${terrain}`);

// «+6 еды · −3 воды · −5 кВт в день»
// «+6 еды · −3 воды · −5 энергии в день»
function perDayText(def: ModuleDef, isNight: boolean) {
  const source = isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
  const parts = Object.entries(source)
    .filter(([, value]) => value)
    .map(([key, value]) => `${value! > 0 ? "+" : "−"}${Math.abs(value!)} ${tDynamic(`unit.${key}`)}`);
  return parts.length ? t("map.perDay", { parts: parts.join(" · ") }) : t("map.nothing");
}

// Облачко-подпись над объектом на карте. (x, y) — точка, куда указывает хвостик.
// Масштаб 1/k держит размер текста на экране одинаковым при любом приближении
function Bubble({
  x,
  y,
  title,
  text,
  onRepair,
  canRepair,
}: {
  x: number;
  y: number;
  title: string;
  text: ReactNode;
  onRepair?: () => void;
  canRepair?: boolean;
}) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px) scale(var(--inv-k, 1))` }} pointerEvents={onRepair ? "auto" : "none"}>
      <foreignObject x={-BUBBLE_W / 2} y={-BUBBLE_H} width={BUBBLE_W} height={BUBBLE_H}>
        <div className="bubble">
          <div className="bubble__body" role="status">
            <div className="bubble__title">{title}</div>
            <div>{text}</div>
            {onRepair && (
              <button
                className="bubble__repair-btn"
                disabled={!canRepair}
                onClick={(e) => {
                  e.stopPropagation();
                  onRepair();
                }}
              >
                {t("map.repair")} (💧10 ⚡10)
              </button>
            )}
          </div>
          <div className="bubble__tail" />
        </div>
      </foreignObject>
    </g>
  );
}

// Все клетки и объекты на них, от дальних к ближним, чтобы ближние перекрывали дальние
const TILES = MAP_LAYOUT.flatMap((line, row) =>
  line.split("").map((_, col) => getTileInfo(row, col))
);

type View = { x: number; y: number; k: number };
type Size = { w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Карта не должна уезжать за край. Отдалять можно, пока картинка закрывает весь экран:
// на ней же нарисовано небо, и за её краем ничего нет. У верхнего края оставляем небольшой запас,
// иначе горы и кратеры при фокусе на базе обрезаются.
function clampView(v: View, size: Size): View {
  // Мінімум, що закриває весь екран, має пріоритет над MAX_ZOOM (на дуже великих екранах / малому масштабі браузера)
  const cover = Math.max(size.w / MAP_W, size.h / MAP_H);
  const k = clamp(v.k, Math.max(MIN_ZOOM, cover), Math.max(MAX_ZOOM, cover));
  const mw = MAP_W * k;
  const mh = MAP_H * k;
  const x = mw <= size.w ? (size.w - mw) / 2 : clamp(v.x, size.w - mw, 0);
  // Верхній край картинки не опускаємо нижче верху екрана: інакше угорі видно порожній фон
  const y = mh <= size.h ? size.h - mh : clamp(v.y, size.h - mh, 0);
  return { x, y, k };
}

// Меняет масштаб так, чтобы точка (cx, cy) на экране осталась на месте
function zoomAt(v: View, k: number, cx: number, cy: number): View {
  const ratio = k / v.k;
  return { k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
}

export default function LunarMap({
  modules,
  defs,
  isNight,
  buildType,
  surveyingIce = false,
  crewActive,
  sickCrewIds,
  canPlaceAt,
  canAffordRepair = true,
  onRepairModule,
  onSelectTile,
  renderBuild,
}: LunarMapProps) {
  const [selected, setSelected] = useState<TileInfo | null>(null);
  const [hovered, setHovered] = useState<TileInfo | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<Size>({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, k: START_ZOOM });
  const rafRef = useRef(0);
  const idleTimer = useRef<number | undefined>(undefined);
  const [smooth, setSmooth] = useState(false);
  const smoothTimer = useRef<number | undefined>(undefined);

  // Камера двигается напрямую через DOM: React не перерисовывает карту на каждый кадр перетаскивания и зума.
  // Масштаб подписей (1/k) отдаётся в CSS-переменной, а не через состояние
  const flush = useCallback(() => {
    rafRef.current = 0;
    const stage = stageRef.current;
    if (!stage) return;
    const v = viewRef.current;
    stage.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
    stage.style.setProperty("--inv-k", String(1 / v.k));
    // Пока камера движется, сцена — готовая GPU-текстура (дорогой SVG-фон не перерисовывается каждый кадр).
    // После паузы слой снимается, и карта перерисовывается чётко в новом масштабе
    stage.classList.add("map-stage--moving");
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => stage.classList.remove("map-stage--moving"), 180);
  }, []);

  const apply = useCallback(
    (next: View) => {
      viewRef.current = clampView(next, sizeRef.current);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
    },
    [flush]
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.clearTimeout(idleTimer.current);
    },
    []
  );

  // Центр стартовой базы: на него смотрим при запуске и по кнопке «До бази».
  // Считаем один раз, поэтому новые модули камеру не двигают
  const baseCenter = useRef(
    (() => {
      if (modules.length === 0) return { x: MAP_W / 2, y: MAP_H / 2 };
      let sx = 0;
      let sy = 0;
      for (const m of modules) {
        const { row, col } = cellOf(m.slot);
        const p = getPosition(row, col);
        sx += p.x;
        sy += p.y;
      }
      return { x: sx / modules.length, y: sy / modules.length };
    })()
  ).current;

  const focusBase = useCallback(
    (k: number) => {
      const { w, h } = sizeRef.current;
      // база чуть выше середины рамки: внизу её закрывает панель строительства
      apply({ k, x: w / 2 - baseCenter.x * k, y: h * 0.34 - baseCenter.y * k });
    },
    [apply, baseCenter]
  );

  // Следим за размером рамки; при первом размере показываем базу в центре
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let first = true;
    const measure = () => {
      sizeRef.current = { w: frame.clientWidth, h: frame.clientHeight };
      if (first && sizeRef.current.w > 0) {
        first = false;
        focusBase(START_ZOOM);
      } else {
        apply(viewRef.current);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [apply, focusBase]);

  const animate = () => {
    setSmooth(true);
    window.clearTimeout(smoothTimer.current);
    smoothTimer.current = window.setTimeout(() => setSmooth(false), 300);
  };

  const zoomBy = (factor: number) => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    animate();
    apply(zoomAt(v, clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM), w / 2, h / 2));
  };

  // Колесо мыши и жест двумя пальцами на тачпаде приближают к курсору
  const onWheel = (e: React.WheelEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const v = viewRef.current;
    const k = clamp(v.k * Math.exp(-e.deltaY * 0.0016), MIN_ZOOM, MAX_ZOOM);
    apply(zoomAt(v, k, e.clientX - rect.left, e.clientY - rect.top));
  };

  // Мышь и пальцы: один палец двигает карту, два пальца приближают (щипок)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    moved: false,
    startX: 0,
    startY: 0,
    startView: { x: 0, y: 0, k: START_ZOOM },
    startDist: 1,
    startMidX: 0,
    startMidY: 0,
  });

  const localPoint = (e: React.PointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const beginGesture = () => {
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    g.startView = viewRef.current;
    if (pts.length === 1) {
      g.startX = pts[0].x;
      g.startY = pts[0].y;
    } else if (pts.length >= 2) {
      g.startDist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      g.startMidX = (pts[0].x + pts[1].x) / 2;
      g.startMidY = (pts[0].y + pts[1].y) / 2;
      g.moved = true;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, localPoint(e));
    if (pointers.current.size === 1) gesture.current.moved = false;
    beginGesture();
    if (smoothTimer.current !== undefined) {
      window.clearTimeout(smoothTimer.current);
      smoothTimer.current = undefined;
    }
    setSmooth(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const g = gesture.current;
    const pts = [...pointers.current.values()];

    if (pts.length === 1) {
      const dx = pts[0].x - g.startX;
      const dy = pts[0].y - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!g.moved) {
        e.currentTarget.setPointerCapture(e.pointerId);
        // пока тащим карту, браузеру не нужно искать, над какой клеткой курсор
        e.currentTarget.classList.add("map-frame--dragging");
      }
      g.moved = true;
      apply({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy });
    } else if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const k = clamp(g.startView.k * (dist / g.startDist), MIN_ZOOM, MAX_ZOOM);
      // точка карты под центром щипка остаётся под ним, плюс сдвиг центра
      const zoomed = zoomAt(g.startView, k, g.startMidX, g.startMidY);
      apply({ ...zoomed, x: zoomed.x + (midX - g.startMidX), y: zoomed.y + (midY - g.startMidY) });
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) beginGesture();
    else e.currentTarget.classList.remove("map-frame--dragging");
  };

  const moduleAt = (row: number, col: number) =>
    modules.find((m) => m.slot === slotOf(row, col));

  // Куда ходят астронавты: к каждому модулю, на землю перед ним
  const walkTargets = useMemo<WalkTarget[]>(
    () =>
      modules.map((m) => {
        const { row, col } = cellOf(m.slot);
        const p = getPosition(row, col);
        return { type: m.type, x: p.x, y: p.y + TILE_H * 0.62 };
      }),
    [modules]
  );

  // Что написать в облачке над выбранной клеткой
  const bubble = (() => {
    if (!selected) return null;
    const { x, y } = getPosition(selected.row, selected.col);
    const module = moduleAt(selected.row, selected.col);
    const def = defs.find((d) => d.type === module?.type);

    if (module && def) {
      const isBroken = module.broken;
      return {
        x,
        y: y - ART_HEIGHT[module.type] * ART_SCALE - 4,
        title: moduleName(def.type),
        text: module.building
          ? module.waiting
            ? t("map.waiting")
            : renderBuild?.percent(module)
          : isBroken
            ? t("map.broken")
            : perDayText(def, isNight),
        onRepair: isBroken && onRepairModule ? () => onRepairModule(module.slot) : undefined,
        canRepair: isBroken ? canAffordRepair : undefined,
      };
    }

    const near = inBuildZone(modules, selected.row, selected.col);
    const text = selected.terrain === "ice"
      ? t("map.ice")
      : selected.terrain === "rock"
        ? t("map.rock")
        : !selected.canBuild
        ? t("map.noBuild")
        : near
          ? t("map.canBuild")
          : t("map.tooFar", { n: BUILD_RADIUS });
    // над ракетой и скалами облачко поднимаем, чтобы оно их не закрывало
    const lift = selected.terrain === "landing" ? 170 : selected.terrain === "rock" && !selected.canBuild ? 30 : 0;

    return { x, y: y - TILE_H / 2 - lift, title: getTerrainName(selected.terrain), text };
  })();

  const handleSelectImpl = (tile: TileInfo) => {
    if (gesture.current.moved) return;
    // повторный клик по той же клетке прячет облачко
    const same = selected?.row === tile.row && selected?.col === tile.col;
    setSelected(same && !buildType ? null : tile);
    onSelectTile?.(tile);
  };

  const selectRef = useRef(handleSelectImpl);
  selectRef.current = handleSelectImpl;
  const handleSelect = useCallback((tile: TileInfo) => selectRef.current(tile), []);

  // Тяжёлые слои считаются только при реальном изменении данных, а не при каждом наведении мыши
  const tileLayer = useMemo(
    () =>
      TILES.map((tile) => {
        const { x, y } = getPosition(tile.row, tile.col);
        return (
          <polygon
            key={`t-${tile.row}-${tile.col}`}
            points={diamond(x, y)}
            fill="transparent"
            stroke={buildType ? "#ffffff" : "none"}
            strokeOpacity="0.14"
            onClick={() => handleSelect(tile)}
            onMouseEnter={buildType ? () => setHovered(tile) : undefined}
            style={{ cursor: buildType ? "crosshair" : "pointer" }}
          />
        );
      }),
    [buildType, handleSelect]
  );

  const iceLayer = useMemo(
    () =>
      TILES.map((tile) => {
        if (tile.terrain !== "ice" || modules.some((m) => m.slot === slotOf(tile.row, tile.col))) return null;
        const { x, y } = getPosition(tile.row, tile.col);
        return (
          <g key={`ice-${tile.row}-${tile.col}`} transform={`translate(${x} ${y}) scale(${ART_SCALE})`} pointerEvents="none">
            <Ice />
          </g>
        );
      }),
    [modules]
  );

  const okTiles = useMemo(
    () => (buildType ? TILES.filter((tile) => canPlaceAt(tile.row, tile.col)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildType, modules]
  );

  const moduleLayer = useMemo(
    () =>
      [...modules]
        .sort((a, b) => a.slot - b.slot)
        .map((module) => {
          const { row, col } = cellOf(module.slot);
          const tile = TILES.find((t2) => t2.row === row && t2.col === col);
          if (!tile) return null;
          const { x, y } = getPosition(row, col);
          return (
            <g
              key={`o-${row}-${col}`}
              transform={`translate(${x} ${y}) scale(${ART_SCALE})`}
              onClick={() => handleSelect(tile)}
              style={{ cursor: "pointer" }}
              pointerEvents={buildType ? "none" : "auto"}
            >
              <g className="module-art" opacity={module.building ? 0.45 : 1}>
                {/* при смене «строится → готово» ключ пересоздаёт группу и играет появление */}
                <g key={module.building ? "building" : "ready"} className={module.building ? undefined : "module-pop"}>
                  <ModuleArt type={module.type} broken={module.broken} />
                </g>
              </g>
              {!module.building && <ellipse className="build-pulse" cx="0" cy="0" rx="34" ry="17" fill="none" stroke="#ffd166" strokeWidth="3" />}
              {module.building && renderBuild?.progress(module)}
            </g>
          );
        }),
    [modules, buildType, handleSelect, renderBuild]
  );

  const ghost =
    buildType && hovered && !moduleAt(hovered.row, hovered.col) && canPlaceAt(hovered.row, hovered.col)
      ? getPosition(hovered.row, hovered.col)
      : null;

  return (
    <>
      <div
        ref={frameRef}
        className="map-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => setHovered(null)}
        onWheel={onWheel}
      >
        <div
          ref={stageRef}
          className={`map-stage ${smooth ? "map-stage--smooth" : ""}`}
          style={{ width: MAP_W, height: MAP_H }}
        >
          {/* Слой 1: фоновая картинка — небо, Земля, горы, кратеры, лёд, площадка с ракетой */}
          <MapBackground imageWidth={IMAGE_SIZE.width} imageHeight={IMAGE_SIZE.height} width={MAP_W} height={MAP_H} />
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            width={MAP_W}
            height={MAP_H}
            className="map-svg"
            role="img"
            aria-label={t("map.aria")}
          >
            <ArtDefs />

            {/* Слой 1 (фон) вынесен под SVG: см. MapBackground */}

            {/* Слой 2: невидимые клетки, по которым кликают. В режиме стройки видна сетка */}
            {tileLayer}

            {surveyingIce && (
              <g pointerEvents="none" aria-hidden="true">
                {TILES.filter((tile) => tile.terrain === "ice").map((tile) => {
                  const { x, y } = getPosition(tile.row, tile.col);
                  return <polygon key={`ice-survey-${tile.row}-${tile.col}`} className="tile-ice-survey" points={diamond(x, y)} />;
                })}
              </g>
            )}

            {/* Слой 3: лунная ночь затемняет поверхность, огни зданий остаются яркими */}
            {isNight && (
              <rect width={MAP_W} height={MAP_H} fill="#050a1a" opacity="0.5" pointerEvents="none" />
            )}

            {/* Слой 4: зелёные клетки, где можно строить выбранный модуль */}
            {buildType && (
              <g pointerEvents="none">
                {okTiles.map((tile) => {
                  const { x, y } = getPosition(tile.row, tile.col);
                  const isHovered = hovered?.row === tile.row && hovered?.col === tile.col;
                  return (
                    <polygon
                      key={`hl-${tile.row}-${tile.col}`}
                      className="tile-ok"
                      points={diamond(x, y)}
                      fill={OK_COLOR}
                      fillOpacity={isHovered ? 0.55 : 0.3}
                      stroke={OK_COLOR}
                      strokeWidth={isHovered ? 4 : 2}
                    />
                  );
                })}
                {hovered && !okTiles.includes(hovered) && (() => {
                  const { x, y } = getPosition(hovered.row, hovered.col);
                  return <polygon points={diamond(x, y)} fill={BAD_COLOR} fillOpacity={0.55} stroke={BAD_COLOR} strokeWidth={4} />;
                })()}
              </g>
            )}

            {/* Подсветка выбранной клетки */}
            {selected && !buildType && (() => {
              const { x, y } = getPosition(selected.row, selected.col);
              return (
                <polygon
                  points={diamond(x, y)}
                  fill="#ffe16b"
                  fillOpacity="0.18"
                  stroke="#ffe16b"
                  strokeWidth="3.5"
                  pointerEvents="none"
                />
              );
            })()}

            {/* Слой 5: поклади льоду, будівлі та «призрак» модуля */}
            {iceLayer}
            {moduleLayer}
            {ghost && (
              <g transform={`translate(${ghost.x} ${ghost.y}) scale(${ART_SCALE})`} opacity="0.6" pointerEvents="none">
                <ModuleArt type={buildType!} />
              </g>
            )}

            {/* Слой 6: астронавты ходят между модулями */}
            <Walkers targets={walkTargets} active={crewActive} sickIds={sickCrewIds} />

            {/* Слой 7: облачко-подпись над выбранным объектом, поверх всего */}
            {bubble && <Bubble {...bubble} />}
          </svg>
        </div>
      </div>

      <div className="zoom" role="group" aria-label={t("map.aria")}>
        <button className="zoom__btn" onClick={() => zoomBy(1.35)} aria-label={t("zoom.in")} title={t("zoom.in")}>
          +
        </button>
        <button className="zoom__btn" onClick={() => zoomBy(1 / 1.35)} aria-label={t("zoom.out")} title={t("zoom.out")}>
          −
        </button>
        <button
          className="zoom__btn zoom__btn--home"
          onClick={() => {
            animate();
            focusBase(START_ZOOM);
          }}
          aria-label={t("zoom.reset")}
          title={t("zoom.reset")}
        >
          <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
            <path d="M3 10 L10 3 L17 10 V17 H12 V12 H8 V17 H3 Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </>
  );
}
