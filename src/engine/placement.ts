import type { GameState, ModuleType, PlacedModule } from "../types";
import { FORCE_BLOCK, FORCE_BUILD, IMAGE_SCALE, MAP_LAYOUT, MAP_ROWS, MAP_COLS, tileCenter } from "../data/map";
import type { Terrain } from "../data/map";

export type { Terrain };
export { MAP_LAYOUT, MAP_ROWS, MAP_COLS };

export interface TileInfo {
  row: number;
  col: number;
  terrain: Terrain;
  canBuild: boolean;
  canMine: boolean;
}

// Карта (G — грунт, R — камни, C — кратер, I — лёд, P — площадка) считается
// по фоновой картинке в data/map.ts

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
  const slot = row * MAP_COLS + col;
  return {
    row,
    col,
    terrain,
    // фиолетовые клетки запрещены, зелёные разрешены даже на камне
    canBuild: !FORCE_BLOCK.has(slot) && (terrain === "ground" || FORCE_BUILD.has(slot)),
    canMine: terrain === "ice" || terrain === "rock",
  };
}

// Клетка карты ↔ номер слота в GameState (slot = row * MAP_COLS + col)
export const slotOf = (row: number, col: number) => row * MAP_COLS + col;
export const cellOf = (slot: number) => ({ row: Math.floor(slot / MAP_COLS), col: slot % MAP_COLS });

// Ближайшая клетка с обычным грунтом к точке на фоновой картинке (x, y — в её пикселях)
export function nearestGroundSlot(x: number, y: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!getTileInfo(row, col).canBuild) continue;
      const c = tileCenter(row, col);
      const dist = (c.x / IMAGE_SCALE - x) ** 2 + (c.y / IMAGE_SCALE - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = slotOf(row, col);
      }
    }
  }
  return best;
}

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

// Зона стройки: радиус вокруг базы плюс зелёные клетки, размеченные вручную
export function inBuildZone(modules: PlacedModule[], row: number, col: number): boolean {
  return FORCE_BUILD.has(slotOf(row, col)) || isNearBase(modules, row, col);
}

// TODO @Regie: размер модуля
export function canPlace(state: GameState, type: ModuleType, row: number, col: number): boolean {
  if (FORCE_BLOCK.has(slotOf(row, col))) return false; // фиолетовые клетки
  const tile = getTileInfo(row, col);
  // Добыча ставится прямо на месторождение, остальное — на ровный грунт
  const fits =
    type === "iceMine" ? tile.terrain === "ice"
    : type === "rockMine" ? tile.terrain === "rock"
    : tile.canBuild;
  if (!fits) return false;
  if (state.modules.some((m) => m.slot === slotOf(row, col))) return false;
  return inBuildZone(state.modules, row, col);
}
