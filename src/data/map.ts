// Карта лежит поверх картинки assets/moon-bg.webp. Объекты на картинке перечислены
// в её пикселях (FEATURES), а клетки и всё остальное — в единицах карты.
// Если поменяется фон, нужно поправить FEATURES: где на нём кратеры, камни, лёд и площадка

export type Terrain = "ground" | "rock" | "crater" | "ice" | "landing";

// Снизу на исходнике виден тулбар редактора, поэтому показываем картинку без нижних 62 px
const IMAGE = { width: 1369, height: 774, visibleHeight: 712 };

export const TILE_W = 150;
export const TILE_H = 75;

// Одна клетка — 96 пикселей картинки: так здания по размеру подходят к ракете на фоне
export const IMAGE_SCALE = TILE_W / 96;

// Размер карты в единицах карты. 1 единица = 1 пиксель экрана при масштабе 1
export const MAP_W = IMAGE.width * IMAGE_SCALE;
export const MAP_H = IMAGE.visibleHeight * IMAGE_SCALE;
export const IMAGE_SIZE = { width: IMAGE.width * IMAGE_SCALE, height: IMAGE.height * IMAGE_SCALE };

const GRID_TOP = 222 * IMAGE_SCALE;   // центр первого ряда клеток, сразу под горами
export const MAP_ROWS = 20;
export const MAP_COLS = 14;

// «Шахматная» изометрия: нечётные ряды сдвинуты на полклетки вправо
export function tileCenter(row: number, col: number) {
  return {
    x: col * TILE_W + (row & 1) * (TILE_W / 2) + TILE_W / 2,
    y: GRID_TOP + row * (TILE_H / 2),
  };
}

type Feature = { t: Terrain; x: number; y: number; rx: number; ry: number };

// Объекты на фоновой картинке: центр и радиусы эллипса в пикселях картинки
const FEATURES: Feature[] = [
  // посадочная площадка с ракетой
  { t: "landing", x: 478, y: 332, rx: 125, ry: 40 },
  // кратеры
  { t: "crater", x: 225, y: 260, rx: 45, ry: 14 },
  { t: "crater", x: 1105, y: 325, rx: 85, ry: 26 },
  { t: "crater", x: 105, y: 437, rx: 70, ry: 20 },
  { t: "crater", x: 690, y: 463, rx: 40, ry: 13 },
  { t: "crater", x: 580, y: 377, rx: 45, ry: 12 },
  { t: "crater", x: 1072, y: 565, rx: 125, ry: 42 },
  { t: "crater", x: 480, y: 585, rx: 45, ry: 13 },
  // лёд
  { t: "ice", x: 1275, y: 238, rx: 75, ry: 16 },
  { t: "ice", x: 1250, y: 390, rx: 90, ry: 22 },
  { t: "ice", x: 1100, y: 612, rx: 80, ry: 14 },
  // большие скалы: на них ставится карьер
  { t: "rock", x: 1090, y: 195, rx: 230, ry: 55 },
  { t: "rock", x: 40, y: 350, rx: 55, ry: 42 },
  { t: "rock", x: 130, y: 290, rx: 45, ry: 20 },
  { t: "rock", x: 60, y: 500, rx: 75, ry: 50 },
  { t: "rock", x: 150, y: 535, rx: 40, ry: 30 },
  { t: "rock", x: 90, y: 640, rx: 120, ry: 70 },
  { t: "rock", x: 300, y: 690, rx: 95, ry: 40 },
  { t: "rock", x: 550, y: 690, rx: 65, ry: 30 },
  { t: "rock", x: 690, y: 635, rx: 60, ry: 28 },
  { t: "rock", x: 380, y: 425, rx: 35, ry: 18 },
  { t: "rock", x: 855, y: 228, rx: 50, ry: 18 },
  { t: "rock", x: 1310, y: 320, rx: 70, ry: 40 },
  { t: "rock", x: 1290, y: 500, rx: 65, ry: 35 },
  { t: "rock", x: 1240, y: 625, rx: 85, ry: 40 },
  { t: "rock", x: 1300, y: 695, rx: 130, ry: 50 },
];

const HORIZON = 205; // выше — горы

// x, y — в пикселях картинки
function terrainAt(x: number, y: number): Terrain {
  if (y < HORIZON) return "rock";
  for (const f of FEATURES) {
    const dx = (x - f.x) / f.rx;
    const dy = (y - f.y) / f.ry;
    if (dx * dx + dy * dy <= 1) return f.t;
  }
  return "ground";
}

const CODE: Record<Terrain, string> = { ground: "G", rock: "R", crater: "C", ice: "I", landing: "P" };

// Строковая карта, как раньше, только посчитанная по картинке
export const MAP_LAYOUT: string[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => {
    const { x, y } = tileCenter(row, col);
    return CODE[terrainAt(x / IMAGE_SCALE, y / IMAGE_SCALE)];
  }).join("")
);
