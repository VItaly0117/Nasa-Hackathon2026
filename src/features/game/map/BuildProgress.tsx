import type { ModuleType } from "@/types";
import { ART_HEIGHT } from "./art-size";

// Полоска над стройкой: сколько уже построено. Рисуется в тех же координатах, что и сам модуль
export function BuildProgress({ type, done }: { type: ModuleType; done: number }) {
  const width = 44;
  return (
    <g transform={`translate(0 ${-ART_HEIGHT[type] - 14})`} pointerEvents="none">
      <rect x={-width / 2 - 2} y={-2} width={width + 4} height={10} rx={5} fill="#0b1026" opacity="0.8" />
      <rect x={-width / 2} y={0} width={Math.max(2, width * done)} height={6} rx={3} fill="#f5b83d" />
    </g>
  );
}
