import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { summarizeDay } from "@/engine";
import type { DaySummary } from "@/engine";
import type { GameState, ModuleType } from "@/types";
import { useSession } from "@/session/hooks";
import { GameUiContext } from "./ui-state";
import type { GameUi } from "./ui-state";

export function GameUiProvider({ children }: { children: ReactNode }) {
  const [selectedType, setSelectedType] = useState<ModuleType | null>("greenhouse");
  const [buildType, setBuildType] = useState<ModuleType | null>(null);
  const [surveyingIce, setSurveyingIce] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const { store } = useSession();
  const rulesRef = useRef(false);
  useEffect(() => {
    rulesRef.current = rulesOpen;
  }, [rulesOpen]);

  // Итоги дня: состояние на начало дня запоминаем, а при смене дня сравниваем с ним.
  // Последний день не показываем: вместо него итог всей миссии
  useEffect(() => {
    let dayStart: GameState = store.getState();
    return store.subscribe(() => {
      const state = store.getState();
      if (state.day === dayStart.day) return;
      const before = dayStart;
      dayStart = state;
      if (state.status === "playing") setSummary(summarizeDay(before, state));
    });
  }, [store]);

  // Клавиатура: Esc закрывает окно правил или отменяет постройку/разведку льда, R открывает правила.
  // Не трогаем ввод текста и сочетания с Ctrl/Cmd; по физическим клавишам (code), чтобы работало на любой раскладке
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Escape" || e.key === "Escape") {
        if (rulesRef.current) setRulesOpen(false);
        else {
          setBuildType(null);
          setSurveyingIce(false);
        }
      } else if (e.code === "KeyR" && !e.repeat) {
        // другое окно (событие, итоги дня) поверх: правила не открываем
        const other = document.querySelector('[role="dialog"]');
        if (rulesRef.current) setRulesOpen(false);
        else if (!other) setRulesOpen(true);
      }
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
      summary,
      selectType: (type) => {
        setSelectedType(type);
        setBuildType(null);
      },
      startPlacing: (type) => {
        if (type) setSelectedType(type);
        setBuildType(type ?? selectedType);
      },
      stopPlacing: () => setBuildType(null),
      setSurveyingIce: (on) => {
        setSurveyingIce(on);
        if (on) setBuildType(null);
      },
      setRulesOpen,
      closeSummary: () => setSummary(null),
    }),
    [selectedType, buildType, surveyingIce, rulesOpen, summary],
  );

  return <GameUiContext.Provider value={value}>{children}</GameUiContext.Provider>;
}
