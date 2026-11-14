import type { ModuleType } from "@/types";

// Рисунки объектов в мультяшной изометрии. Точка (0, 0) — центр клетки на земле,
// клетка 96×48. TODO @Zakhar: при желании заменить на PNG из assets/

// Высота рисунка над землёй: по ней облачко-подпись встаёт над объектом
export const ART_HEIGHT: Record<ModuleType, number> = {
  habitat: 50,
  lifeSupport: 42,
  solar: 34,
  battery: 26,
  greenhouse: 44,
  shelter: 40,
  storage: 34,
  medbay: 34,
  iceMine: 30,
  rockMine: 30,
};

const WHITE_TOP = "#f4f3f9";
const WHITE_LEFT = "#c7c3d6";
const WHITE_RIGHT = "#e1def0";

function Shadow({ rx = 40, ry = 18 }: { rx?: number; ry?: number }) {
  return <ellipse cx="0" cy="4" rx={rx} ry={ry} fill="#2e2842" opacity="0.35" />;
}

function Light({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill="#ffb347" opacity="0.35" />
      <circle cx={x} cy={y} r="2.4" fill="#ffd98a" />
    </g>
  );
}

// Изометрический параллелепипед: w и d — полуширина и полуглубина основания, h — высота
function Box({
  w, d, h, dx = 0, dy = 0,
  top = WHITE_TOP, left = WHITE_LEFT, right = WHITE_RIGHT,
}: {
  w: number; d: number; h: number; dx?: number; dy?: number;
  top?: string; left?: string; right?: string;
}) {
  const p = (x: number, y: number) => `${x + dx},${y + dy}`;
  return (
    <g>
      <polygon points={`${p(-w, -h)} ${p(0, d - h)} ${p(0, d)} ${p(-w, 0)}`} fill={left} />
      <polygon points={`${p(w, -h)} ${p(0, d - h)} ${p(0, d)} ${p(w, 0)}`} fill={right} />
      <polygon points={`${p(0, -d - h)} ${p(w, -h)} ${p(0, d - h)} ${p(-w, -h)}`} fill={top} />
    </g>
  );
}

function Habitat() {
  return (
    <g>
      <Shadow rx={38} />
      <Box w={32} d={16} h={20} />
      {/* окна */}
      <polygon points="-26,-14 -18,-10 -18,-4 -26,-8" fill="#5aa9e6" />
      <polygon points="-14,-8 -6,-4 -6,2 -14,-2" fill="#5aa9e6" />
      {/* дверь */}
      <polygon points="10,-2 18,-6 18,6 10,10" fill="#5b5675" />
      {/* купол */}
      <path d="M -26 -20 A 26 22 0 0 1 26 -20 Z" fill="#ecebf4" />
      <path d="M 0 -42 A 26 22 0 0 1 26 -20 L 0 -20 Z" fill="#d9d6e6" />
      <path d="M -24 -24 Q 0 -16 24 -24" stroke="#b9b5cb" strokeWidth="1.5" fill="none" />
      <circle cx="-8" cy="-32" r="4" fill="#ffffff" opacity="0.7" />
      <Light x={-32} y={-2} />
      <Light x={32} y={-2} />
      <Light x={0} y={14} />
    </g>
  );
}

function Greenhouse() {
  return (
    <g>
      <Shadow rx={40} />
      <Box w={36} d={18} h={6} top="#d9d6e6" left="#a9a4bd" right="#c3bfd3" />
      <path d="M -33 -6 A 33 30 0 0 1 33 -6 Z" fill="#8fdcf5" opacity="0.5" />
      {/* растения внутри */}
      <circle cx="-16" cy="-12" r="8" fill="#3f9d4a" />
      <circle cx="-2" cy="-18" r="9" fill="#5cb85c" />
      <circle cx="13" cy="-11" r="8" fill="#3f9d4a" />
      <circle cx="4" cy="-8" r="6" fill="#7ccf5a" />
      <circle cx="-8" cy="-22" r="5" fill="#7ccf5a" />
      {/* каркас купола */}
      <path d="M -33 -6 A 33 30 0 0 1 33 -6" fill="none" stroke="#eef9ff" strokeWidth="2" />
      <path d="M 0 -36 Q -22 -24 -33 -6 M 0 -36 Q 22 -24 33 -6 M 0 -36 L 0 -6" stroke="#eef9ff" strokeWidth="1.3" fill="none" opacity="0.8" />
      <path d="M -29 -18 Q 0 -10 29 -18" stroke="#eef9ff" strokeWidth="1.3" fill="none" opacity="0.8" />
      <ellipse cx="-13" cy="-26" rx="7" ry="4" fill="#ffffff" opacity="0.55" />
      <Light x={-36} y={0} />
      <Light x={36} y={0} />
    </g>
  );
}

function SolarPanel({ dx, dy }: { dx: number; dy: number }) {
  const p = (x: number, y: number) => `${x + dx},${y + dy}`;
  return (
    <g>
      <line x1={-12 + dx} y1={-2 + dy} x2={-12 + dx} y2={8 + dy} stroke="#8d88a3" strokeWidth="2" />
      <line x1={14 + dx} y1={-14 + dy} x2={14 + dx} y2={0 + dy} stroke="#8d88a3" strokeWidth="2" />
      <polygon points={`${p(-30, -10)} ${p(4, -30)} ${p(24, -20)} ${p(-10, 0)}`} fill="#2c4a8a" stroke="#a9bde6" strokeWidth="1.5" />
      <path
        d={`M ${p(-21, -15)} L ${p(-1, -5)} M ${p(-13, -20)} L ${p(7, -10)} M ${p(-4, -25)} L ${p(16, -15)} M ${p(-20, -5)} L ${p(14, -25)}`}
        stroke="#6f8fd0"
        strokeWidth="1"
      />
    </g>
  );
}

function Solar() {
  return (
    <g>
      <Shadow rx={42} ry={16} />
      <SolarPanel dx={-10} dy={0} />
      <SolarPanel dx={14} dy={12} />
    </g>
  );
}

function Battery() {
  return (
    <g>
      <Shadow rx={36} ry={16} />
      <Box w={14} d={7} h={22} dx={-14} dy={-2} />
      <Box w={14} d={7} h={22} dx={12} dy={6} />
      <path d="M -6 -12 L -10 -4 L -7 -4 L -9 3 L -3 -6 L -6 -6 Z" fill="#fbbf24" />
      <path d="M 20 -4 L 16 4 L 19 4 L 17 11 L 23 2 L 20 2 Z" fill="#fbbf24" />
      <circle cx="-20" cy="-8" r="2" fill="#4ade80" />
      <circle cx="6" cy="0" r="2" fill="#4ade80" />
    </g>
  );
}

function Tank({ x, y, h, r }: { x: number; y: number; h: number; r: number }) {
  return (
    <g>
      <path d={`M ${x - r} ${y - h} L ${x - r} ${y} A ${r} ${r / 2} 0 0 0 ${x + r} ${y} L ${x + r} ${y - h} Z`} fill="#3f74c9" />
      <path d={`M ${x} ${y - h} L ${x + r} ${y - h} L ${x + r} ${y} A ${r} ${r / 2} 0 0 1 ${x} ${y + r / 2} Z`} fill="#2f5ea8" />
      <ellipse cx={x} cy={y - h} rx={r} ry={r / 2} fill="#7fb0f0" />
      <rect x={x - r + 3} y={y - h + 4} width="3" height={h - 8} fill="#a8cdf7" opacity="0.7" />
    </g>
  );
}

function LifeSupport() {
  return (
    <g>
      <Shadow rx={38} />
      <Box w={18} d={9} h={12} dx={14} dy={6} />
      <Tank x={-14} y={0} h={30} r={11} />
      <Tank x={8} y={-8} h={24} r={9} />
      <path d="M -3 -12 Q 2 -16 6 -12" stroke="#9a95b0" strokeWidth="3" fill="none" />
      <Light x={30} y={4} />
    </g>
  );
}

function Shelter() {
  return (
    <g>
      <Shadow rx={40} />
      <path d="M -36 0 L -36 -14 Q -30 -40 0 -40 Q 30 -40 36 -14 L 36 0 Q 0 18 -36 0 Z" fill="#8e86a0" />
      <path d="M 0 -40 Q 30 -40 36 -14 L 36 0 Q 18 9 0 10 Z" fill="#7a7290" />
      <path d="M -30 -16 Q 0 -6 30 -16 M -33 -6 Q 0 6 33 -6 M -22 -30 Q 0 -22 22 -30" stroke="#a49cb6" strokeWidth="2" fill="none" />
      <path d="M 8 6 L 8 -8 Q 15 -14 22 -10 L 22 3 Z" fill="#3b3550" />
      <circle cx="-12" cy="-24" r="6" fill="#fbbf24" />
      <circle cx="-12" cy="-24" r="2" fill="#2e2842" />
      <Light x={15} y={-14} />
    </g>
  );
}

// Склад: три контейнера разного цвета, чтобы было видно, что тут лежат разные запасы
function Storage() {
  return (
    <g>
      <Shadow rx={42} ry={18} />
      <Box w={18} d={9} h={24} dx={-14} dy={0} top="#9fd0ff" left="#6f9fd6" right="#86b6ec" />
      <Box w={18} d={9} h={24} dx={14} dy={6} top="#7fe0b0" left="#4fb083" right="#66c99a" />
      <Box w={14} d={7} h={14} dx={0} dy={-10} top="#fbbf24" left="#c98a12" right="#e0a21c" />
    </g>
  );
}

// Медпункт: белый домик с красным крестом на стене
function Medbay() {
  return (
    <g>
      <Shadow rx={40} ry={17} />
      <Box w={24} d={12} h={26} dx={0} dy={0} />
      <path d="M -17 -22 L -17 -4 L -7 1 L -7 -17 Z" fill="#9fd0ff" opacity="0.9" />
      <path d="M 6 -12 L 6 -5 M 2.5 -8.5 L 9.5 -8.5" stroke="#ff4d5e" strokeWidth="3" strokeLinecap="round" transform="translate(6 -4) scale(1.2)" />
      <Light x={-2} y={-34} />
    </g>
  );
}

// Добыча стоит прямо на месторождении: под машиной видно лёд или камни
function IceMine() {
  return (
    <g>
      <Ice />
      <Box w={12} d={6} h={18} dx={-20} dy={4} />
      <Tank x={22} y={4} h={18} r={7} />
    </g>
  );
}

function RockMine() {
  return (
    <g>
      <Rocks variant={0} />
      <Box w={14} d={7} h={14} dx={18} dy={8} top="#fbbf24" left="#c98a12" right="#e0a21c" />
    </g>
  );
}

const MODULE_ART: Record<ModuleType, () => React.JSX.Element> = {
  habitat: Habitat,
  lifeSupport: LifeSupport,
  solar: Solar,
  battery: Battery,
  greenhouse: Greenhouse,
  shelter: Shelter,
  storage: Storage,
  medbay: Medbay,
  iceMine: IceMine,
  rockMine: RockMine,
};

export function ModuleArt({ type, broken = false }: { type: ModuleType; broken?: boolean }) {
  const Art = MODULE_ART[type];
  return (
    <g filter={broken ? "url(#broken)" : undefined}>
      <Art />
      {broken && (
        <g>
          <circle cx="6" cy={-ART_HEIGHT[type] - 6} r="9" fill="#8a8399" opacity="0.6" />
          <circle cx="-4" cy={-ART_HEIGHT[type] - 14} r="7" fill="#8a8399" opacity="0.45" />
          <path d={`M 0 ${-ART_HEIGHT[type] + 4} l 9 15 h -18 Z`} fill="#ff5a5a" stroke="#fff" strokeWidth="1.5" />
          <path d={`M 0 ${-ART_HEIGHT[type] + 9} v 5 M 0 ${-ART_HEIGHT[type] + 16} v 1`} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// Один валун. s — масштаб
function Boulder({ x, y, s }: { x: number; y: number; s: number }) {
  const P = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  return (
    <g>
      <ellipse cx={x} cy={y + 3 * s} rx={16 * s} ry={6 * s} fill="#2e2842" opacity="0.3" />
      <path
        d={`M ${P(-14, 0)} Q ${P(-16, -12)} ${P(-6, -16)} Q ${P(6, -21)} ${P(14, -10)} Q ${P(18, -2)} ${P(10, 4)} Q ${P(-4, 8)} ${P(-14, 0)} Z`}
        fill="#6f6787"
      />
      <path d={`M ${P(2, -18)} Q ${P(13, -12)} ${P(14, -6)} Q ${P(17, 0)} ${P(10, 4)} Q ${P(4, 5)} ${P(0, 4)} Z`} fill="#5a5372" />
      <path d={`M ${P(-12, -5)} Q ${P(-9, -14)} ${P(2, -16)} Q ${P(-3, -10)} ${P(-12, -5)} Z`} fill="#a39bb8" />
    </g>
  );
}

function Rocks({ variant }: { variant: number }) {
  return variant % 2 === 0 ? (
    <g>
      <Boulder x={-10} y={-2} s={1.3} />
      <Boulder x={16} y={6} s={0.8} />
    </g>
  ) : (
    <g>
      <Boulder x={8} y={-4} s={1.1} />
      <Boulder x={-14} y={6} s={0.9} />
      <Boulder x={14} y={10} s={0.6} />
    </g>
  );
}

function Ice() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="40" ry="19" fill="#7fd8ff" opacity="0.25" />
      <ellipse cx="0" cy="2" rx="32" ry="15" fill="#6c6482" />
      <polygon points="-18,0 -12,-16 -2,-12 0,2" fill="#c7f2ff" stroke="#effbff" strokeWidth="1.3" />
      <polygon points="-2,4 4,-22 14,-14 12,6" fill="#a8e8ff" stroke="#effbff" strokeWidth="1.3" />
      <polygon points="10,8 18,-6 26,0 22,10" fill="#d8f6ff" stroke="#effbff" strokeWidth="1.3" />
      <path d="M 6 -18 L 8 -4" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
    </g>
  );
}

// Общие определения для карты и превью: фильтр «сломан»
export function ArtDefs() {
  return (
    <defs>
      <filter id="broken">
        <feColorMatrix type="saturate" values="0.15" />
      </filter>
    </defs>
  );
}

// Маленькая картинка модуля для меню строительства
export function ModulePreview({ type, size = 72 }: { type: ModuleType; size?: number }) {
  return (
    <svg viewBox="-50 -62 100 80" width={size} height={size * 0.8} aria-hidden="true">
      <ModuleArt type={type} />
    </svg>
  );
}
