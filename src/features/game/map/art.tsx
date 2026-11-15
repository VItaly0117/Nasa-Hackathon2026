import type { ModuleType } from "@/types";
import { ART_HEIGHT } from "./art-size";

// Рисунки объектов в мультяшной изометрии, всё векторное (SVG): без пикселей при любом зуме. Точка (0, 0) — центр клетки на земле,
// клетка 96×48

// Контур и общие цвета: мультяшная изометрия с тёмной обводкой и мягкими градиентами, как в референсах
const OUT = "#2d2742";
const LINE = { stroke: OUT, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

function Shadow({ rx = 40, ry = 18 }: { rx?: number; ry?: number }) {
  return <ellipse cx="0" cy="5" rx={rx} ry={ry} fill="#2e2842" opacity="0.38" />;
}

function Light({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill="#ffb347" opacity="0.35" />
      <circle cx={x} cy={y} r="2.6" fill="#ffd266" stroke={OUT} strokeWidth="0.8" />
    </g>
  );
}

type Faces = { top: string; left: string; right: string };
const WHITE: Faces = { top: "url(#gWhiteTop)", left: "url(#gWhiteLeft)", right: "url(#gWhiteRight)" };

// Изометрический параллелепипед: w и d — полуширина и полуглубина основания, h — высота
function IsoBox({ w, d, h, dx = 0, dy = 0, faces = WHITE }: { w: number; d: number; h: number; dx?: number; dy?: number; faces?: Faces }) {
  const p = (x: number, y: number) => `${x + dx},${y + dy}`;
  return (
    <g {...LINE}>
      <polygon points={`${p(-w, -h)} ${p(0, d - h)} ${p(0, d)} ${p(-w, 0)}`} fill={faces.left} />
      <polygon points={`${p(w, -h)} ${p(0, d - h)} ${p(0, d)} ${p(w, 0)}`} fill={faces.right} />
      <polygon points={`${p(0, -d - h)} ${p(w, -h)} ${p(0, d - h)} ${p(-w, -h)}`} fill={faces.top} />
    </g>
  );
}

// Потёртости и пятна на корпусе
function Wear({ d, opacity = 0.35 }: { d: string; opacity?: number }) {
  return <path d={d} fill="#8a7f9c" opacity={opacity} />;
}

// Жилой модуль: плита с огоньками, домик с окнами и дверью, белый купол с синим пояском
function Habitat() {
  return (
    <g>
      <Shadow rx={46} ry={21} />
      <g {...LINE}>
        <polygon points="-44,0 0,20 0,27 -44,7" fill="#2a2640" />
        <polygon points="44,0 0,20 0,27 44,7" fill="#38334f" />
        <polygon points="0,-20 44,0 0,20 -44,0" fill="url(#gSlab)" />
      </g>
      <polygon points="0,-14 33,0 0,14 -33,0" fill="none" stroke="#c9a74a" strokeWidth="1.2" opacity="0.8" />
      <Light x={-39} y={3} />
      <Light x={39} y={3} />
      <Light x={0} y={22} />
      <IsoBox w={27} d={13.5} h={17} dy={-1} />
      {/* окна на левой стене */}
      <g {...LINE} strokeWidth="1">
        <polygon points="-23,-14 -16,-10.5 -16,-4 -23,-7.5" fill="url(#gWindow)" />
        <polygon points="-12,-8.5 -5,-5 -5,1.5 -12,-2" fill="url(#gWindow)" />
        {/* дверь на правой стене */}
        <polygon points="8,-1 16,-5 16,6.5 8,10.5" fill="url(#gWindow)" />
      </g>
      <Wear d="M -26 -6 q 3 -4 6 -1 q -1 4 -6 1 Z M 18 -12 q 4 -2 6 2 q -4 3 -6 -2 Z" />
      {/* купол */}
      <g {...LINE}>
        <path d="M -23 -19 A 23 22 0 0 1 23 -19 Q 0 -9 -23 -19 Z" fill="url(#gDome)" />
      </g>
      <path d="M -23.5 -19 Q 0 -9 23.5 -19" fill="none" stroke="#2e6fc5" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M -23.5 -19 Q 0 -9 23.5 -19" fill="none" stroke="#7fb4f2" strokeWidth="1.4" opacity="0.8" transform="translate(0 -1.2)" />
      <ellipse cx="-8" cy="-34" rx="6" ry="3.6" fill="#ffffff" opacity="0.8" transform="rotate(-20 -8 -34)" />
      <Wear d="M 6 -33 q 6 0 8 6 q -5 3 -8 -6 Z M -16 -27 q 3 -3 5 0 q -2 3 -5 0 Z" opacity={0.28} />
    </g>
  );
}

// Цилиндрический бак с градиентом по горизонтали и крышкой
function Tank({ x, y, h, r, tone = "blue" }: { x: number; y: number; h: number; r: number; tone?: "blue" | "grey" }) {
  const g = tone === "blue" ? "url(#gTankBlue)" : "url(#gTankGrey)";
  const cap = tone === "blue" ? "#8fb9f0" : "#b4b6cd";
  return (
    <g {...LINE}>
      <path d={`M ${x - r} ${y - h} L ${x - r} ${y} A ${r} ${r / 2} 0 0 0 ${x + r} ${y} L ${x + r} ${y - h} Z`} fill={g} />
      <ellipse cx={x} cy={y - h} rx={r} ry={r / 2} fill={cap} />
      <ellipse cx={x} cy={y - h} rx={r * 0.5} ry={r * 0.25} fill="#6b6786" strokeWidth="1" />
      <path d={`M ${x - r} ${y - h * 0.62} A ${r} ${r / 2} 0 0 0 ${x + r} ${y - h * 0.62}`} fill="none" strokeWidth="1.2" opacity="0.7" />
      <path d={`M ${x - r + 2.5} ${y - h + 3} L ${x - r + 2.5} ${y - 4}`} stroke="#d6e8ff" strokeWidth="2" opacity="0.55" />
    </g>
  );
}

// Жизнеобеспечение: два синих бака с трубой и пульт с экраном
function LifeSupport() {
  return (
    <g>
      <Shadow rx={40} />
      <Tank x={-16} y={2} h={30} r={11} />
      <Tank x={5} y={-5} h={26} r={10} />
      <path d="M -5 -16 Q 0 -22 4 -16" fill="none" stroke={OUT} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M -5 -16 Q 0 -22 4 -16" fill="none" stroke="#9aa0b8" strokeWidth="2.4" strokeLinecap="round" />
      {/* пульт */}
      <IsoBox w={13} d={6.5} h={9} dx={25} dy={9} faces={{ top: "#cdd2e6", left: "#8f95b3", right: "#aeb4cf" }} />
      <polygon points="14,4 24,9 24,13 14,8" fill="#1d3a33" stroke={OUT} strokeWidth="0.8" />
      <path d="M 15.5 6.5 l 2 -1.5 l 2 1.5 l 2 -1" fill="none" stroke="#6ee79c" strokeWidth="1.1" />
      <Wear d="M -24 -14 q 3 -3 6 0 q -2 4 -6 0 Z M 2 -20 q 3 -3 6 0 q -3 3 -6 0 Z" />
    </g>
  );
}

// Одна солнечная панель: тёмно-синий ромб с белой сеткой и блеском, на двух ножках
function Panel({ dx, dy }: { dx: number; dy: number }) {
  const pt = (x: number, y: number) => `${x + dx},${y + dy}`;
  return (
    <g>
      <g stroke={OUT} strokeWidth="1.6" strokeLinecap="round">
        <line x1={dx - 11} y1={dy + 5} x2={dx - 11} y2={dy + 12} />
        <line x1={dx + 11} y1={dy + 5} x2={dx + 11} y2={dy + 12} />
      </g>
      <g {...LINE}>
        <polygon points={`${pt(-20, 2)} ${pt(0, -8)} ${pt(20, 2)} ${pt(0, 12)}`} fill="url(#gSolar)" />
      </g>
      <path
        d={`M ${pt(0, -8)} L ${pt(0, 12)} M ${pt(-10, -3)} L ${pt(10, 7)} M ${pt(10, -3)} L ${pt(-10, 7)}`}
        stroke="#bcd0f5" strokeWidth="0.9" opacity="0.85" fill="none"
      />
      <polygon points={`${pt(-15, 0)} ${pt(-3, -6)} ${pt(2, -3.5)} ${pt(-10, 3)}`} fill="#ffffff" opacity="0.16" />
    </g>
  );
}

// Солнечные панели: четыре панели блоком 2×2
function Solar() {
  return (
    <g>
      <Shadow rx={46} ry={18} />
      <Panel dx={0} dy={-15} />
      <Panel dx={-21} dy={-4} />
      <Panel dx={21} dy={-4} />
      <Panel dx={0} dy={7} />
    </g>
  );
}

// Батарея: блок из шести кубов, на левых гранях зелёные огни, на правых молнии
function Battery() {
  const stone: Faces = { top: "#dfe1f3", left: "#8d93bb", right: "#aab0d3" };
  const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
  const W = 12;
  const D = 6;
  const H = 16;
  return (
    <g>
      <Shadow rx={40} ry={17} />
      {[...cells]
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
        .map(([i, j]) => {
          const dx = (i - j) * W;
          const dy = (i + j) * D - 6;
          return (
            <g key={`${i}-${j}`}>
              <IsoBox w={W} d={D} h={H} dx={dx} dy={dy} faces={stone} />
              <circle cx={dx - W * 0.5} cy={dy - H * 0.5 + D * 0.4} r="2.4" fill="#4ade80" stroke={OUT} strokeWidth="0.7" />
              <path d={`M ${dx + 7} ${dy - 10} l -4 5 h 3 l -1.8 5.2 l 5 -6.2 h -3 Z`} fill="#fbbf24" stroke={OUT} strokeWidth="0.7" />
            </g>
          );
        })}
    </g>
  );
}

// Теплица: каменное основание, стеклянный купол с рёбрами и растения внутри
function Greenhouse() {
  return (
    <g>
      <Shadow rx={42} ry={19} />
      <g {...LINE}>
        <path d="M -38 -2 L -34 8 Q 0 24 34 8 L 38 -2 Q 0 14 -38 -2 Z" fill="#6c6584" />
        <ellipse cx="0" cy="-3" rx="38" ry="15" fill="url(#gStone)" />
      </g>
      {/* земля и растения */}
      <ellipse cx="0" cy="-5" rx="28" ry="10" fill="#7a5640" stroke={OUT} strokeWidth="1" />
      <g stroke={OUT} strokeWidth="0.9" strokeLinejoin="round">
        <path d="M -14 -6 q -6 -12 -1 -18 q 7 5 1 18 Z" fill="#58b44f" />
        <path d="M -3 -8 q -4 -16 4 -24 q 8 9 -4 24 Z" fill="#7ccf5a" />
        <path d="M 10 -6 q 2 -12 9 -15 q 2 9 -9 15 Z" fill="#58b44f" />
        <path d="M 4 -5 q 9 -6 14 0 q -7 4 -14 0 Z" fill="#8bd45e" />
      </g>
      {/* стеклянный купол */}
      <path d="M -33 -4 A 33 31 0 0 1 33 -4 Q 0 12 -33 -4 Z" fill="url(#gGlass)" stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M -33 -4 Q 0 12 33 -4" fill="none" stroke="#f3fbff" strokeWidth="1.8" opacity="0.8" />
      <path d="M 0 -35 Q -26 -22 -33 -4 M 0 -35 Q 26 -22 33 -4 M 0 -35 Q -12 -16 -4 5 M 0 -35 Q 12 -16 4 5 M -30 -17 Q 0 -8 30 -17 M -21 -28 Q 0 -21 21 -28" fill="none" stroke="#2d2742" strokeWidth="1.2" opacity="0.65" />
      <ellipse cx="-14" cy="-26" rx="7" ry="3.6" fill="#ffffff" opacity="0.6" transform="rotate(-25 -14 -26)" />
    </g>
  );
}

// Укрытие: серо-синий каменный купол с жёлтыми светящимися окошками и дверью-аркой
function Shelter() {
  return (
    <g>
      <Shadow rx={42} ry={19} />
      <g {...LINE}>
        <path d="M -38 2 L -36 -6 L -26 -10 L -14 -7 L 0 -11 L 16 -8 L 30 -10 L 38 -3 L 38 3 L 24 12 L 0 16 L -26 12 Z" fill="url(#gStone)" />
        <path d="M -33 -4 L -33 -14 Q -30 -42 0 -42 Q 30 -42 33 -14 L 33 -4 Q 0 12 -33 -4 Z" fill="url(#gShelter)" />
      </g>
      <path d="M -28 -18 Q 0 -8 28 -18 M -30 -8 Q 0 4 30 -8 M -20 -32 Q 0 -24 20 -32" fill="none" stroke="#3c3756" strokeWidth="1.2" opacity="0.7" />
      <path d="M 4 -42 Q 33 -42 33 -14 L 33 -4 Q 16 5 4 6 Z" fill="#2d2742" opacity="0.18" />
      {/* окошки */}
      <g stroke={OUT} strokeWidth="1">
        <circle cx="-17" cy="-27" r="5.5" fill="#ffc83d" />
        <circle cx="-23" cy="-14" r="4.2" fill="#ffc83d" />
        <circle cx="-6" cy="-36" r="3.6" fill="#ffc83d" />
      </g>
      <circle cx="-18.5" cy="-28.5" r="1.8" fill="#fff3b0" />
      {/* дверь-арка */}
      <path d="M 9 4 L 9 -9 Q 9 -18 17 -17 Q 25 -17 25 -9 L 25 1 Z" fill="#2b2540" stroke={OUT} strokeWidth="1.3" />
      <path d="M 12 2 L 12 -8 Q 12 -14 17 -14 Q 22 -14 22 -8 L 22 0 Z" fill="#ffc86a" opacity="0.55" />
    </g>
  );
}

// Склад: три контейнера разных цветов
function Storage() {
  return (
    <g>
      <Shadow rx={42} ry={18} />
      <IsoBox w={17} d={8.5} h={24} dx={-13} dy={4} faces={{ top: "#8fb8e8", left: "#496fa6", right: "#6791c8" }} />
      <IsoBox w={17} d={8.5} h={24} dx={13} dy={4} faces={{ top: "#8fe3bb", left: "#3f9f85", right: "#5cc2a0" }} />
      <IsoBox w={15} d={7.5} h={17} dx={0} dy={-12} faces={{ top: "#ffd76a", left: "#c9892a", right: "#e6a93a" }} />
      <Wear d="M -26 -4 q 3 -3 6 0 q -2 4 -6 0 Z M 8 -8 q 4 -2 7 1 q -4 3 -7 -1 Z M 14 10 q 3 -3 6 0 q -3 3 -6 0 Z" opacity={0.25} />
    </g>
  );
}

// Медпункт: белый домик со снежными потёртостями, тёмный проём и красный крест
function Medbay() {
  return (
    <g>
      <Shadow rx={38} ry={17} />
      <IsoBox w={24} d={12} h={26} dy={2} faces={{ top: "#f5f6fb", left: "#a9acc9", right: "#e4e6f2" }} />
      <path d="M -24 -23 q 6 -6 14 -2 q 5 -5 10 -1 L 0 -10 L -24 -23 Z" fill="#ffffff" stroke="none" opacity="0.9" />
      {/* проём */}
      <polygon points="-18,-2 -18,-14 -8,-9 -8,4" fill="#2b2f4a" stroke={OUT} strokeWidth="1.3" />
      <polygon points="-15,1 -15,-10 -11,-8 -11,3" fill="#44507c" />
      {/* крест на правой стене: рисуем плоским и наклоняем под плоскость стены */}
      <g transform="matrix(1 -0.5 0 1 13 -7)">
        <path d="M -2.6 -8 h 5.2 v 5.4 h 5.4 v 5.2 h -5.4 v 5.4 h -5.2 v -5.4 h -5.4 v -5.2 h 5.4 Z" fill="#e0243a" stroke={OUT} strokeWidth="0.9" strokeLinejoin="round" />
      </g>
      <Wear d="M 3 -24 q 5 -2 8 2 q -5 3 -8 -2 Z" opacity={0.25} />
    </g>
  );
}

// Добыча стоит прямо на месторождении: серые баки, пульт и глыба льда
function IceMine() {
  return (
    <g>
      <Shadow rx={42} ry={18} />
      <Tank x={-24} y={2} h={26} r={10} tone="grey" />
      <Tank x={-6} y={-6} h={24} r={9} tone="grey" />
      <IsoBox w={11} d={5.5} h={8} dx={-14} dy={12} faces={{ top: "#cdd2e6", left: "#7f85a3", right: "#9ea4c1" }} />
      {/* глыба льда: куб с гранями и бликами */}
      <IsoBox w={17} d={8.5} h={24} dx={23} dy={6} faces={{ top: "#f3fdff", left: "url(#gIceLeft)", right: "#79cbee" }} />
      <path d="M 10 -8 L 10 6 M 17 -4 L 17 10 M 33 -14 L 40 -10" stroke="#ffffff" strokeWidth="1.3" opacity="0.6" fill="none" />
      <path d="M 14 -14 L 22 -10 L 30 -14" stroke="#c9eefa" strokeWidth="1" fill="none" opacity="0.8" />
    </g>
  );
}

// Карьер: скальный выступ и куча щебня
function RockMine() {
  return (
    <g>
      <Shadow rx={42} ry={18} />
      <g {...LINE}>
        <polygon points="-34,6 -30,-14 -22,-20 -14,-34 -2,-30 4,-16 4,4 -14,12" fill="url(#gRock)" />
        <polygon points="-14,-34 -2,-30 4,-16 -6,-18 -14,-28" fill="#d0c0aa" />
        <polygon points="-14,12 -14,-18 -22,-20 -30,-14 -34,6" fill="#6a6280" />
        <polygon points="-14,-18 -6,-18 4,-16 4,4 -14,12" fill="#8a7e95" />
      </g>
      <path d="M -22 -12 L -18 6 M -8 -22 L -6 -4" stroke="#463f5c" strokeWidth="1.2" opacity="0.7" fill="none" />
      {/* куча щебня */}
      <g {...LINE}>
        <path d="M 6 10 Q 14 -10 28 -6 Q 40 -2 40 10 Q 22 18 6 10 Z" fill="#5b5476" />
        <path d="M 22 -7 Q 38 -3 40 10 Q 30 13 22 12 Z" fill="#48425f" />
      </g>
      <g fill="#8a84a8" stroke={OUT} strokeWidth="0.7">
        <ellipse cx="16" cy="6" rx="3" ry="1.8" />
        <ellipse cx="26" cy="2" rx="2.6" ry="1.6" />
        <ellipse cx="32" cy="8" rx="3" ry="1.8" />
        <ellipse cx="24" cy="10" rx="2.4" ry="1.4" />
      </g>
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

export function Ice() {
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

// Общие определения для карты и превью: фильтр «сломан» и градиенты рисунков
export function ArtDefs() {
  return (
    <defs>
      <filter id="broken">
        <feColorMatrix type="saturate" values="0.15" />
      </filter>
      <linearGradient id="gWhiteTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dcdaec" /></linearGradient>
      <linearGradient id="gWhiteLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d5d2e6" /><stop offset="1" stopColor="#a8a4c0" /></linearGradient>
      <linearGradient id="gWhiteRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1f0f9" /><stop offset="1" stopColor="#c9c6de" /></linearGradient>
      <linearGradient id="gSlab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a4566" /><stop offset="1" stopColor="#2f2a47" /></linearGradient>
      <linearGradient id="gWindow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc2f5" /><stop offset="1" stopColor="#2d6fb8" /></linearGradient>
      <radialGradient id="gDome" cx="0.35" cy="0.25" r="0.9"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#e4e3f1" /><stop offset="1" stopColor="#b6b2cd" /></radialGradient>
      <linearGradient id="gTankBlue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2c58a8" /><stop offset="0.35" stopColor="#5d97e8" /><stop offset="1" stopColor="#274c94" /></linearGradient>
      <linearGradient id="gTankGrey" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4c5578" /><stop offset="0.35" stopColor="#8d97bd" /><stop offset="1" stopColor="#434a6b" /></linearGradient>
      <linearGradient id="gSolar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a74c0" /><stop offset="1" stopColor="#1d3469" /></linearGradient>
      <linearGradient id="gStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a93b3" /><stop offset="1" stopColor="#625b7c" /></linearGradient>
      <radialGradient id="gGlass" cx="0.4" cy="0.3" r="0.9"><stop offset="0" stopColor="#d6f3ff" stopOpacity="0.85" /><stop offset="1" stopColor="#5fb4e0" stopOpacity="0.55" /></radialGradient>
      <radialGradient id="gShelter" cx="0.35" cy="0.25" r="0.95"><stop offset="0" stopColor="#8a89b0" /><stop offset="1" stopColor="#4d4a6c" /></radialGradient>
      <linearGradient id="gRock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8a98f" /><stop offset="1" stopColor="#7a6f88" /></linearGradient>
      <linearGradient id="gIceLeft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9f6ff" /><stop offset="1" stopColor="#8ad3f3" /></linearGradient>
    </defs>
  );
}

// Маленькая картинка модуля для меню строительства
export function ModulePreview({ type, size = 72 }: { type: ModuleType; size?: number }) {
  return (
    <svg viewBox="-52 -58 104 90" width={size} height={size * (90 / 104)} aria-hidden="true">
      <ArtDefs />
      <ModuleArt type={type} />
    </svg>
  );
}
