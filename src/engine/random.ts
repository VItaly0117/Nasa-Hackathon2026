// Случайное число от 0 до 1 из seed и следующий seed (mulberry32). Состояние хранит seed, поэтому игра воспроизводима.
// Никакого Math.random в ядре: вся случайность идёт отсюда
export function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(s ^ (s >>> 15), 1 | s);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return [((x ^ (x >>> 14)) >>> 0) / 4294967296, s];
}
