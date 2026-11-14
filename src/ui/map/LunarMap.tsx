import { useEffect, useRef, useState } from "react";
import type { ModuleDef, ModuleType, PlacedModule } from "../../types";
import {
  MAP_LAYOUT,
  MAP_ROWS,
  MAP_COLS,
  BUILD_RADIUS,
  getTileInfo,
  isNearBase,
  slotOf,
  cellOf,
} from "../../engine/placement";
import type { Terrain, TileInfo } from "../../engine/placement";
import { ART_HEIGHT, ArtDefs, ModuleArt, TerrainArt } from "./art";
import "./LunarMap.css";

interface LunarMapProps {
  modules: PlacedModule[];
  defs: ModuleDef[];
  isNight: boolean;
  buildType: ModuleType | null;
  canPlaceAt: (row: number, col: number) => boolean;
  onSelectTile?: (tile: TileInfo) => void;
}

const OK_COLOR = "#4ADE80";
const BAD_COLOR = "#FF6B6B";

const TILE_W = 96;
const TILE_H = 48;
const TOP = 120;     // горы на горизонте и место для высоких зданий верхнего ряда
const BOTTOM = 160;  // грунт под панелью строительства
const ART_SCALE = 1.2; // рисунки чуть крупнее клетки, как на макете
const BUBBLE_W = 260;
const BUBBLE_H = 84;
const DRAG_THRESHOLD = 5;

// Размер карты в единицах SVG. На экране она растягивается по высоте рамки,
// а по ширине получается длиннее экрана и прокручивается влево-вправо
const MAP_W = MAP_COLS * TILE_W + TILE_W / 2;
const MAP_H = TOP + MAP_ROWS * (TILE_H / 2) + TILE_H / 2 + BOTTOM;

// «Шахматная» изометрия: нечётные ряды сдвинуты на полклетки вправо
const getPosition = (row: number, col: number) => ({
  x: col * TILE_W + (row & 1) * (TILE_W / 2) + TILE_W / 2,
  y: TOP + row * (TILE_H / 2) + TILE_H / 2,
});

const diamond = (x: number, y: number) =>
  [
    `${x},${y - TILE_H / 2}`,
    `${x + TILE_W / 2},${y}`,
    `${x},${y + TILE_H / 2}`,
    `${x - TILE_W / 2},${y}`,
  ].join(" ");

// Силуэт гор на горизонте: сумма синусоид, чтобы выглядело неровно, но одинаково при каждом запуске
function hillsPath(base: number, amp: number, k: number) {
  const points: string[] = [];
  for (let x = 0; x <= MAP_W; x += 30) {
    const y = base - amp * (0.55 + 0.3 * Math.sin(x * 0.004 * k + k) + 0.15 * Math.sin(x * 0.013 * k));
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M 0 ${TOP + 40} L ${points.join(" L ")} L ${MAP_W} ${TOP + 40} Z`;
}

const FAR_HILLS = hillsPath(TOP - 10, 90, 1.3);
const NEAR_HILLS = hillsPath(TOP + 6, 40, 2.1);

const getTerrainName = (terrain: Terrain) => {
  const names: Record<Terrain, string> = {
    ground: "Обычный грунт",
    rock: "Камни",
    crater: "Кратер",
    ice: "Месторождение льда",
    landing: "Посадочная площадка",
  };

  return names[terrain];
};

const SHORT: Record<string, string> = {
  oxygen: "O₂",
  water: "воды",
  food: "еды",
  energy: "кВт",
  health: "здоровья",
  materials: "мат.",
};

// «+6 еды · −3 воды · −5 кВт в день»
function perDayText(def: ModuleDef, isNight: boolean) {
  const source = isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
  const parts = Object.entries(source)
    .filter(([, value]) => value)
    .map(([key, value]) => `${value! > 0 ? "+" : "−"}${Math.abs(value!)} ${SHORT[key]}`);
  return parts.length ? `${parts.join(" · ")} в день` : "Сейчас ничего не даёт";
}

// Облачко-подпись над объектом на карте. (x, y) — точка, куда указывает хвостик
function Bubble({ x, y, title, text }: { x: number; y: number; title: string; text: string }) {
  return (
    <foreignObject
      x={x - BUBBLE_W / 2}
      y={y - BUBBLE_H}
      width={BUBBLE_W}
      height={BUBBLE_H}
      pointerEvents="none"
    >
      <div className="bubble">
        <div className="bubble__body" role="status">
          <div className="bubble__title">{title}</div>
          <div>{text}</div>
        </div>
        <div className="bubble__tail" />
      </div>
    </foreignObject>
  );
}

// Все клетки и объекты на них, от дальних к ближним, чтобы ближние перекрывали дальние
const TILES = MAP_LAYOUT.flatMap((line, row) =>
  line.split("").map((_, col) => getTileInfo(row, col))
);

export default function LunarMap({
  modules,
  defs,
  isNight,
  buildType,
  canPlaceAt,
  onSelectTile,
}: LunarMapProps) {
  const [selected, setSelected] = useState<TileInfo | null>(null);
  const [hovered, setHovered] = useState<TileInfo | null>(null);

  // Перетаскивание карты мышью. Если мышь сдвинулась, это не клик по клетке
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 });

  // При запуске показываем базу в центре экрана
  useEffect(() => {
    const frame = frameRef.current;
    const svg = frame?.querySelector("svg");
    if (!frame || !svg || modules.length === 0) return;
    const scale = svg.clientHeight / MAP_H;
    const cx =
      modules.reduce((sum, m) => {
        const { row, col } = cellOf(m.slot);
        return sum + getPosition(row, col).x;
      }, 0) / modules.length;
    frame.scrollLeft = cx * scale - frame.clientWidth / 2;
    // центрируем только при первом показе, дальше игрок двигает карту сам
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    drag.current = { active: true, moved: false, x: e.clientX, left: frame.scrollLeft };
  };

  const moveDrag = (e: React.MouseEvent) => {
    const frame = frameRef.current;
    const d = drag.current;
    if (!frame || !d.active) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    d.moved = true;
    frame.scrollLeft = d.left - dx;
  };

  const endDrag = () => {
    drag.current.active = false;
  };

  // Колесо мыши крутит карту вбок: вверх-вниз она не прокручивается
  const onWheel = (e: React.WheelEvent) => {
    const frame = frameRef.current;
    if (frame) frame.scrollLeft += e.deltaY + e.deltaX;
  };

  const moduleAt = (row: number, col: number) =>
    modules.find((m) => m.slot === slotOf(row, col));

  // Что написать в облачке над выбранной клеткой
  const bubble = (() => {
    if (!selected) return null;
    const { x, y } = getPosition(selected.row, selected.col);
    const module = moduleAt(selected.row, selected.col);
    const def = defs.find((d) => d.type === module?.type);

    if (module && def) {
      return {
        x,
        y: y - ART_HEIGHT[module.type] * ART_SCALE - 4,
        title: def.name,
        text: module.broken ? "Сломан, нужен ремонт" : perDayText(def, isNight),
      };
    }

    const near = isNearBase(modules, selected.row, selected.col);
    const text = selected.terrain === "ice"
      ? "Лёд: поставь сюда ледодобытчик"
      : selected.terrain === "rock"
        ? "Камни: поставь сюда карьер"
        : !selected.canBuild
        ? "Строить здесь нельзя"
        : near
          ? "Можно строить"
          : `Слишком далеко: до базы больше ${BUILD_RADIUS} клеток`;
    const lift = selected.terrain === "landing" ? 90 : selected.terrain === "rock" ? 20 : 0;

    return { x, y: y - TILE_H / 2 - lift, title: getTerrainName(selected.terrain), text };
  })();

  const handleSelect = (tile: TileInfo) => {
    if (drag.current.moved) return;
    // повторный клик по той же клетке прячет облачко
    const same = selected?.row === tile.row && selected?.col === tile.col;
    setSelected(same && !buildType ? null : tile);
    onSelectTile?.(tile);
  };

  return (
    <div
      ref={frameRef}
      className="map-frame"
      onMouseDown={startDrag}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag();
        setHovered(null);
      }}
      onWheel={onWheel}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="map-svg"
        style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
        role="img"
        aria-label="Карта лунной базы"
      >
        <ArtDefs />
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6f6788" />
            <stop offset="0.5" stopColor="#8a82a0" />
            <stop offset="1" stopColor="#9d95b2" />
          </linearGradient>
          <pattern id="regolith" width="140" height="70" patternUnits="userSpaceOnUse">
            <ellipse cx="22" cy="18" rx="9" ry="4" fill="#b2abc2" opacity="0.5" />
            <ellipse cx="22" cy="19" rx="6" ry="2.5" fill="#6a6382" opacity="0.6" />
            <ellipse cx="96" cy="48" rx="13" ry="5.5" fill="#b2abc2" opacity="0.45" />
            <ellipse cx="96" cy="49" rx="9" ry="3.5" fill="#6a6382" opacity="0.55" />
            <circle cx="64" cy="12" r="1.6" fill="#5a5372" opacity="0.6" />
            <circle cx="120" cy="22" r="1.3" fill="#c3bdd1" opacity="0.6" />
            <circle cx="40" cy="58" r="1.8" fill="#5a5372" opacity="0.5" />
            <circle cx="8" cy="44" r="1.2" fill="#c3bdd1" opacity="0.6" />
          </pattern>
        </defs>

        {/* Слой 1: горизонт и грунт */}
        <path d={FAR_HILLS} fill="#4a4362" />
        <path d={NEAR_HILLS} fill="#5f5779" />
        <rect y={TOP} width={MAP_W} height={MAP_H - TOP} fill="url(#ground)" />
        <rect y={TOP} width={MAP_W} height={MAP_H - TOP} fill="url(#regolith)" />

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
          <rect width={MAP_W} height={MAP_H} fill="#050a1a" opacity="0.5" pointerEvents="none" />
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
                  points={diamond(x, y)}
                  fill={color}
                  fillOpacity={isHovered ? 0.55 : 0.3}
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 1.5}
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
              strokeWidth="2.5"
              pointerEvents="none"
            />
          );
        })()}

        {/* Слой 5: камни, кратеры, площадка и здания, от дальних к ближним */}
        {TILES.map((tile) => {
          const module = moduleAt(tile.row, tile.col);
          const isGhost =
            !module &&
            buildType !== null &&
            hovered?.row === tile.row &&
            hovered?.col === tile.col &&
            canPlaceAt(tile.row, tile.col);
          if (!module && tile.terrain === "ground" && !isGhost) return null;

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
                <ModuleArt type={module.type} broken={module.broken} />
              </g>
            );
          }

          if (isGhost && buildType) {
            return (
              <g key={`o-${tile.row}-${tile.col}`} transform={`translate(${x} ${y}) scale(${ART_SCALE})`} opacity="0.6" pointerEvents="none">
                <ModuleArt type={buildType} />
              </g>
            );
          }

          return (
            <g key={`o-${tile.row}-${tile.col}`} transform={`translate(${x} ${y}) scale(${ART_SCALE})`} pointerEvents="none">
              <TerrainArt terrain={tile.terrain} variant={tile.row + tile.col} />
            </g>
          );
        })}

        {/* Слой 6: облачко-подпись над выбранным объектом, поверх всего */}
        {bubble && <Bubble {...bubble} />}
      </svg>
    </div>
  );
}
