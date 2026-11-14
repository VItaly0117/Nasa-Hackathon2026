import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ModuleType } from "@/types";
import { GameUiContext } from "./ui-state";
import type { GameUi } from "./ui-state";

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
