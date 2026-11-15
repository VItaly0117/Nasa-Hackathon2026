import { createContext, useContext } from "react";
import type { DaySummary } from "@/engine";
import type { ModuleType } from "@/types";

// Что игрок сейчас делает с интерфейсом. Это не состояние игры, оно живёт только на экране
export type GameUi = {
  selectedType: ModuleType | null; // модуль, открытый в карточке справа
  buildType: ModuleType | null;    // игрок выбирает место на карте: карта подсвечивает, куда можно поставить
  surveyingIce: boolean;
  rulesOpen: boolean;
  summary: DaySummary | null; // итоги закончившегося дня: пока открыты, время стоит, а событие ждёт
  selectType(type: ModuleType): void;
  startPlacing(): void;
  stopPlacing(): void;
  setSurveyingIce(on: boolean): void;
  setRulesOpen(open: boolean): void;
  closeSummary(): void;
};

export const GameUiContext = createContext<GameUi | null>(null);

export function useGameUi(): GameUi {
  const ui = useContext(GameUiContext);
  if (!ui) throw new Error("useGameUi вне GameUiProvider");
  return ui;
}
