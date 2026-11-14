import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModuleDef, ModuleType, PlacedModule } from "../../types";
import {
  MAP_LAYOUT,
  BUILD_RADIUS,
  getTileInfo,
  isNearBase,
  slotOf,
  cellOf,
} from "../../engine/placement";
import type { Terrain, TileInfo } from "../../engine/placement";
import { IMAGE_SIZE, MAP_W, MAP_H, TILE_W, TILE_H, tileCenter } from "../../data/map";
import { moduleName, t } from "../../i18n";
import { ART_HEIGHT, ArtDefs, ModuleArt } from "./art";
import moonBg from "../../assets/moon-bg.webp";
import { Walkers } from "./Walkers";
import { BuildProgress } from "./BuildProgress";
import type { WalkTarget } from "./Walkers";
import "./LunarMap.css";

interface LunarMapProps {
  modules: PlacedModule[];
  defs: ModuleDef[];
  isNight: boolean;
  buildType: ModuleType | null;
  crewActive: boolean;
  canPlaceAt: (row: number, col: number) => boolean;
  canAffordRepair?: boolean;
  onRepairModule?: (slot: number) => void;
  onSelectTile?: (tile: TileInfo) => void;
}

const OK_COLOR = "#4ADE80";
const BAD_COLOR = "#FF6B6B";

// Рисунки модулей по размеру подобраны под ракету на фоновой картинке
const ART_SCALE = 1.7;
// Клетки крупные, а рисунки модулей маленькие относительно клетки: между зданиями остаётся воздух
const TILE_W = 150;
const TILE_H = 75;
const TOP = 240;      // горы на горизонте и место для высоких зданий верхнего ряда
const BOTTOM = 350;   // грунт под панелью строительства
const ART_SCALE = 1.45;
const BUBBLE_W = 300;
const BUBBLE_H = 140;
const DRAG_THRESHOLD = 6;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.6;
const START_ZOOM = 0.85;

// Карта — фоновая картинка, клетки размечены поверх неё в data/map.ts
const getPosition = tileCenter;
// Размер карты в единицах SVG. 1 единица = 1 пиксель при масштабе 1
const MAP_W = MAP_COLS * TILE_W + TILE_W / 2;
const MAP_H = TOP + MAP_ROWS * (TILE_H / 2) + TILE_H / 2 + BOTTOM;

// «Шахматная» изометрия с естественной кривизной лунного горизонта:
// центр карты припіднятий, а краї виразно закруглюються вниз (дуга планетарного купола Місяця)
const CURVE_AMOUNT = 220; // виразний вигин місячного диска/горизонту
const curveOffset = (x: number) => {
  const norm = (x - MAP_W / 2) / (MAP_W / 2); // -1 .. +1
  return (norm * norm) * CURVE_AMOUNT;
};

const getPosition = (row: number, col: number) => {
  const x = col * TILE_W + (row & 1) * (TILE_W / 2) + TILE_W / 2;
  const baseY = TOP + row * (TILE_H / 2) + TILE_H / 2;
  return {
    x,
    y: baseY + curveOffset(x),
  };
};

const diamond = (x: number, y: number) =>
  [
    `${x},${y - TILE_H / 2}`,
    `${x + TILE_W / 2},${y}`,
    `${x},${y + TILE_H / 2}`,
    `${x - TILE_W / 2},${y}`,
  ].join(" ");

// Силуэт гор на горизонте с естественной дугой кривизны Луны
function hillsPath(base: number, amp: number, k: number) {
  const points: string[] = [];
  for (let x = 0; x <= MAP_W; x += 30) {
    const cY = curveOffset(x);
    const y = base + cY - amp * (0.55 + 0.3 * Math.sin(x * 0.004 * k + k) + 0.15 * Math.sin(x * 0.013 * k));
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M 0 ${MAP_H + 200} L ${points.join(" L ")} L ${MAP_W} ${MAP_H + 200} Z`;
}

function groundCurvedPath() {
  const points: string[] = [];
  for (let x = 0; x <= MAP_W; x += 30) {
    const y = TOP + curveOffset(x);
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M 0 ${MAP_H + 200} L ${points.join(" L ")} L ${MAP_W} ${MAP_H + 200} Z`;
}

const FAR_HILLS = hillsPath(TOP - 10, 110, 1.3);
const NEAR_HILLS = hillsPath(TOP + 6, 48, 2.1);
const GROUND_PATH = groundCurvedPath();

const getTerrainName = (terrain: Terrain) => t(`terrain.${terrain}`);

// «+6 еды · −3 воды · −5 кВт в день»
// «+6 еды · −3 воды · −5 энергии в день»
function perDayText(def: ModuleDef, isNight: boolean) {
  const source = isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
  const parts = Object.entries(source)
    .filter(([, value]) => value)
    .map(([key, value]) => `${value! > 0 ? "+" : "−"}${Math.abs(value!)} ${t(`unit.${key}`)}`);
  return parts.length ? t("map.perDay", { parts: parts.join(" · ") }) : t("map.nothing");
}

// Облачко-подпись над объектом на карте. (x, y) — точка, куда указывает хвостик.
// Масштаб 1/k держит размер текста на экране одинаковым при любом приближении
function Bubble({
  x,
  y,
  k,
  title,
  text,
  onRepair,
  canRepair,
}: {
  x: number;
  y: number;
  k: number;
  title: string;
  text: string;
  onRepair?: () => void;
  canRepair?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / k})`} pointerEvents={onRepair ? "auto" : "none"}>
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
// на ней же нарисовано небо, и за её краем ничего нет
function clampView(v: View, size: Size): View {
  const k = clamp(v.k, Math.max(MIN_ZOOM, size.w / MAP_W, size.h / MAP_H), MAX_ZOOM);
  const mw = MAP_W * k;
  const mh = MAP_H * k;
  const x = mw <= size.w ? (size.w - mw) / 2 : clamp(v.x, size.w - mw, 0);
  const minTopSky = size.h * 0.18; // залишаємо мінімум 18% неба зверху, щоб гори не зрізались
  const y = mh <= size.h ? size.h - mh : clamp(v.y, size.h - mh, minTopSky);
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
  crewActive,
  canPlaceAt,
  canAffordRepair = true,
  onRepairModule,
  onSelectTile,
}: LunarMapProps) {
  const [selected, setSelected] = useState<TileInfo | null>(null);
  const [hovered, setHovered] = useState<TileInfo | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: START_ZOOM });
  const viewRef = useRef(view);
  const [smooth, setSmooth] = useState(false);
  const smoothTimer = useRef<number | undefined>(undefined);

  const apply = useCallback((next: View) => {
    const clamped = clampView(next, sizeRef.current);
    viewRef.current = clamped;
    setView(clamped);
  }, []);

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
    startView: view,
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
      if (!g.moved) e.currentTarget.setPointerCapture(e.pointerId);
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
        text: module.build
          ? module.build.crewId === null
            ? t("map.waiting")
            : t("map.building", { n: Math.round((1 - module.build.leftMs / module.build.totalMs) * 100) })
          : isBroken
            ? t("map.broken")
            : perDayText(def, isNight),
        onRepair: isBroken && onRepairModule ? () => onRepairModule(module.slot) : undefined,
        canRepair: isBroken ? canAffordRepair : undefined,
      };
    }

    const near = isNearBase(modules, selected.row, selected.col);
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
    const lift = selected.terrain === "landing" ? 170 : selected.terrain === "rock" ? 30 : 0;

    return { x, y: y - TILE_H / 2 - lift, title: getTerrainName(selected.terrain), text };
  })();

  const handleSelect = (tile: TileInfo) => {
    if (gesture.current.moved) return;
    // повторный клик по той же клетке прячет облачко
    const same = selected?.row === tile.row && selected?.col === tile.col;
    setSelected(same && !buildType ? null : tile);
    onSelectTile?.(tile);
  };

  const k = view.k;

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
          className={`map-stage ${smooth ? "map-stage--smooth" : ""}`}
          style={{
            width: MAP_W,
            height: MAP_H,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          }}
        >
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            width={MAP_W}
            height={MAP_H}
            className="map-svg"
            role="img"
            aria-label={t("map.aria")}
          >
            <ArtDefs />

            {/* Слой 1: фоновая картинка — небо, Земля, горы, кратеры, лёд, площадка с ракетой */}
            <image
              href={moonBg}
              width={IMAGE_SIZE.width}
              height={IMAGE_SIZE.height}
              preserveAspectRatio="none"
            />
            <defs>
              <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6f6788" />
                <stop offset="0.5" stopColor="#8a82a0" />
                <stop offset="1" stopColor="#9d95b2" />
              </linearGradient>
              <pattern id="regolith" width="200" height="100" patternUnits="userSpaceOnUse">
                <ellipse cx="32" cy="26" rx="13" ry="6" fill="#b2abc2" opacity="0.5" />
                <ellipse cx="32" cy="27" rx="9" ry="3.6" fill="#6a6382" opacity="0.6" />
                <ellipse cx="137" cy="69" rx="18" ry="8" fill="#b2abc2" opacity="0.45" />
                <ellipse cx="137" cy="70" rx="13" ry="5" fill="#6a6382" opacity="0.55" />
                <circle cx="91" cy="17" r="2.3" fill="#5a5372" opacity="0.6" />
                <circle cx="171" cy="31" r="1.9" fill="#c3bdd1" opacity="0.6" />
                <circle cx="57" cy="83" r="2.6" fill="#5a5372" opacity="0.5" />
                <circle cx="11" cy="63" r="1.7" fill="#c3bdd1" opacity="0.6" />
              </pattern>
            </defs>

            {/* Слой 1: горизонт и грунт с округлой планетарной дугой */}
            <path d={FAR_HILLS} fill="#4a4362" />
            <path d={NEAR_HILLS} fill="#5f5779" />
            <path d={GROUND_PATH} fill="url(#ground)" />
            <path d={GROUND_PATH} fill="url(#regolith)" />

            {/* Слой 2: невидимые клетки, по которым кликают. В режиме стройки видна сетка */}
            {TILES.map((tile) => {
              const { x, y } = getPosition(tile.row, tile.col);
              return (
                <polygon
                  key={`t-${tile.row}-${tile.col}`}
                  points={diamond(x, y)}
                  fill="transparent"
                  stroke={buildType ? "#ffffff" : "none"}
                  strokeOpacity="0.14"
                  onClick={() => handleSelect(tile)}
                  onMouseEnter={() => setHovered(tile)}
                  style={{ cursor: buildType ? "crosshair" : "pointer" }}
                />
              );
            })}

            {/* Слой 3: лунная ночь затемняет поверхность, огни зданий остаются яркими */}
            {isNight && (
              <path d={FAR_HILLS} fill="#050a1a" opacity="0.5" pointerEvents="none" />
            )}

            {/* Слой 4: зелёные клетки, где можно строить выбранный модуль */}
            {buildType && (
              <g pointerEvents="none">
                {TILES.map((tile) => {
                  const ok = canPlaceAt(tile.row, tile.col);
                  const isHovered = hovered?.row === tile.row && hovered?.col === tile.col;
                  if (!ok && !isHovered) return null;

                  const { x, y } = getPosition(tile.row, tile.col);
                  const color = ok ? OK_COLOR : BAD_COLOR;

                  return (
                    <polygon
                      key={`hl-${tile.row}-${tile.col}`}
                      className={ok ? "tile-ok" : undefined}
                      points={diamond(x, y)}
                      fill={color}
                      fillOpacity={isHovered ? 0.55 : 0.3}
                      stroke={color}
                      strokeWidth={isHovered ? 4 : 2}
                    />
                  );
                })}
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

            {/* Слой 5: здания и «призрак» строящегося модуля, от дальних к ближним */}
            {TILES.map((tile) => {
              const module = moduleAt(tile.row, tile.col);
              const isGhost =
                !module &&
                buildType !== null &&
                hovered?.row === tile.row &&
                hovered?.col === tile.col &&
                canPlaceAt(tile.row, tile.col);
              if (!module && !isGhost) return null;

              const { x, y } = getPosition(tile.row, tile.col);

              if (module) {
                return (
                  <g
                    key={`o-${tile.row}-${tile.col}`}
                    transform={`translate(${x} ${y}) scale(${ART_SCALE})`}
                    onClick={() => handleSelect(tile)}
                    style={{ cursor: "pointer" }}
                    pointerEvents={buildType ? "none" : "auto"}
                  >
                    <g opacity={module.build ? 0.45 : 1}>
                      <ModuleArt type={module.type} broken={module.broken} />
                    </g>
                    {module.build && <BuildProgress type={module.type} done={1 - module.build.leftMs / module.build.totalMs} />}
                  </g>
                );
              }

              return (
                <g key={`o-${tile.row}-${tile.col}`} transform={`translate(${x} ${y}) scale(${ART_SCALE})`} opacity="0.6" pointerEvents="none">
                  <ModuleArt type={buildType!} />
                </g>
              );
            })}

            {/* Слой 6: астронавты ходят между модулями */}
            <Walkers targets={walkTargets} active={crewActive} />

            {/* Слой 7: облачко-подпись над выбранным объектом, поверх всего */}
            {bubble && <Bubble {...bubble} k={k} />}
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
