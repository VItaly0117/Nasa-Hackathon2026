import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ModuleType } from "../../types";

// Что игрок сейчас делает с интерфейсом. Это не состояние игры, оно живёт только на экране
export type GameUi = {
  selectedType: ModuleType | null; // модуль, открытый в карточке справа
  buildType: ModuleType | null;    // игрок выбирает место на карте: карта подсвечивает, куда можно поставить
  surveyingIce: boolean;
  rulesOpen: boolean;
  selectType(type: ModuleType): void;
  startPlacing(): void;
  stopPlacing(): void;
  setSurveyingIce(on: boolean): void;
  setRulesOpen(open: boolean): void;
};

const GameUiContext = createContext<GameUi | null>(null);

export function GameUiProvider({ children }: { children: ReactNode }) {
  const [selectedType, setSelectedType] = useState<ModuleType | null>("greenhouse");
  const [buildType, setBuildType] = useState<ModuleType | null>(null);
  const [surveyingIce, setSurveyingIce] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Esc отменяет постройку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuildType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<GameUi>(
    () => ({
      selectedType,
      buildType,
      surveyingIce,
      rulesOpen,
      selectType: (type) => {
        setSelectedType(type);
        setBuildType(null);
      },
      startPlacing: () => setBuildType(selectedType),
      stopPlacing: () => setBuildType(null),
      setSurveyingIce: (on) => {
        setSurveyingIce(on);
        if (on) setBuildType(null);
      },
      setRulesOpen,
    }),
    [selectedType, buildType, surveyingIce, rulesOpen],
  );

  return <GameUiContext.Provider value={value}>{children}</GameUiContext.Provider>;
}

export function useGameUi(): GameUi {
  const ui = useContext(GameUiContext);
  if (!ui) throw new Error("useGameUi вне GameUiProvider");
  return ui;
}
