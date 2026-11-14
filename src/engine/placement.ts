import type { GameState, ModuleType, PlacedModule } from "../types";

export type Terrain = "ground" | "rock" | "crater" | "ice" | "landing";

export interface TileInfo {
  row: number;
  col: number;
  terrain: Terrain;
  canBuild: boolean;
  canMine: boolean;
}

// G — грунт, R — камни, C — кратер, I — лёд, P — посадочная площадка.
// Карта в «шахматной» изометрии: нечётные ряды сдвинуты на полклетки вправо,
// поэтому на экране она прямоугольная и тянется вправо
export const MAP_LAYOUT: string[] = [
  "GGGGGGGGGGGGGGGGGGGGGCGGGGGGGG",
  "GGGGGGIGGGGGGGGGGGGGGGGGGRGGGG",
  "GRGGGGGGGGGGGRGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGCGGGGGGGGGCG",
  "GGGGGGGGGGGGGGGGGGGGGGRGGGGGGG",
  "GGGGGGGGGGRGPGGGGGGGGGGGGIGGGG",
  "GGGGGGGGGGGGGGIGCGGGGGGGGGGGGG",
  "GGRGGGGGGGGGGGGGGGGGGGGGGGGRGG",
  "GGGGGGGGGGGGGGGGGGGGIGGGGGGGGG",
  "GGGGGGGGCGGGGGGRGGGGGGGGGCGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GRGGGGGGGGGGGGGGGGGGGCGGGGGGGG",
];

export const MAP_ROWS = MAP_LAYOUT.length;
export const MAP_COLS = MAP_LAYOUT[0].length;

// Строить можно не дальше стольких клеток от любого построенного модуля
export const BUILD_RADIUS = 3;

const TERRAIN_MAP: Record<string, Terrain> = {
  G: "ground",
  R: "rock",
  C: "crater",
  I: "ice",
  P: "landing",
};

export function getTileInfo(row: number, col: number): TileInfo {
  const terrain = TERRAIN_MAP[MAP_LAYOUT[row][col]];
  return {
    row,
    col,
    terrain,
    canBuild: terrain === "ground",
    canMine: terrain === "ice" || terrain === "rock",
  };
}

// Клетка карты ↔ номер слота в GameState (slot = row * MAP_COLS + col)
export const slotOf = (row: number, col: number) => row * MAP_COLS + col;
export const cellOf = (slot: number) => ({ row: Math.floor(slot / MAP_COLS), col: slot % MAP_COLS });

// Перевод из «шахматных» координат в диагональные, где соседние клетки отличаются на 1
function toDiamond(row: number, col: number) {
  const odd = row & 1;
  return { i: (row + 2 * col + odd) / 2, j: (row - 2 * col - odd) / 2 };
}

// Расстояние в клетках с учётом диагоналей: соседняя по диагонали клетка — это 1
export function cellDistance(a: { row: number; col: number }, b: { row: number; col: number }) {
  const p = toDiamond(a.row, a.col);
  const q = toDiamond(b.row, b.col);
  return Math.max(Math.abs(p.i - q.i), Math.abs(p.j - q.j));
}

export function isNearBase(modules: PlacedModule[], row: number, col: number): boolean {
  return modules.some((m) => cellDistance(cellOf(m.slot), { row, col }) <= BUILD_RADIUS);
}

// TODO @Regie: размер модуля, лёд только для добычи
export function canPlace(state: GameState, type: ModuleType, row: number, col: number): boolean {
  const tile = getTileInfo(row, col);
  // Добыча ставится прямо на месторождение, остальное — на ровный грунт
  const fits =
    type === "iceMine" ? tile.terrain === "ice"
    : type === "rockMine" ? tile.terrain === "rock"
    : tile.canBuild;
  if (!fits) return false;
  if (state.modules.some((m) => m.slot === slotOf(row, col))) return false;
  return isNearBase(state.modules, row, col);
}
