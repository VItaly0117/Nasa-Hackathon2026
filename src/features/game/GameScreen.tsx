import { useEffect } from "react";
import { t } from "@/i18n";
import { useGame, useMeta, useSession } from "@/session/hooks";
import { Intro } from "@/features/story/Intro";
import { RotateHint } from "@/ui/RotateHint";
import { Ending } from "@/features/results/Ending";
import { DaySummary } from "./DaySummary";
import { WrapUp } from "./WrapUp";
import { DayBanner } from "./DayBanner";
import { EventModal } from "./EventModal";
import { MapView } from "./MapView";
import { BuildContainer, CrewContainer, SideContainer } from "./Panels";
import { TaskToasts } from "./TaskToasts";
import { TopBar } from "./TopBar";
import { GameUiProvider } from "./GameUiProvider";
import { useGameUi } from "./ui-state";
import { useSoundEffects } from "./useSoundEffects";

type Props = { onRestart: () => void; onMenu: () => void; onSources: () => void };

// Финальный ролик; итогового экрана нет — по кнопке возвращаемся в меню
function Results({ onMenu }: Props) {
  const session = useSession();
  const won = useGame((s) => s.status === "won");
  return <Ending won={won} onDone={() => { session.save(); onMenu(); }} />;
}

function Summary() {
  const ui = useGameUi();
  const playing = useGame((s) => s.status === "playing");
  return ui.summary && playing ? <DaySummary summary={ui.summary} onClose={ui.closeSummary} /> : null;
}

function Rules() {
  const ui = useGameUi();
  const { rulesOpen, setRulesOpen } = ui;
  useEffect(() => {
    if (!rulesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRulesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rulesOpen, setRulesOpen]);
  return ui.rulesOpen ? <Intro rulesOnly onStart={() => ui.setRulesOpen(false)} /> : null;
}

function ConnectionLost() {
  const session = useSession();
  const connected = useMeta((m) => m.connected);
  return session.online && !connected ? <div className="online-lost" role="alert">{t("online.lost")}</div> : null;
}

// Экран игры: только раскладка. Каждая часть берёт из игры то, что ей нужно
function Layout(props: Props) {
  const session = useSession();
  const isNight = useGame((s) => s.isNight);
  const playing = useGame((s) => s.status === "playing");
  const summaryOpen = !!useGameUi().summary;
  useSoundEffects();
  return (
    <div className={`game ${isNight ? "game--night" : ""}`}>
      <MapView />
      <TopBar onMenu={() => { session.save(); props.onMenu(); }} />
      <CrewContainer />
      <SideContainer />
      <BuildContainer />
      <EventModal />
      {!playing && <Results {...props} />}
      <Summary />
      <DayBanner />
      <WrapUp />
      {/* Задания нового дня показываем только после закрытия итогов старого */}
      {!summaryOpen && <TaskToasts />}
      <Rules />
      <ConnectionLost />
      <RotateHint />
    </div>
  );
}

export function GameScreen(props: Props) {
  return (
    <GameUiProvider>
      <Layout {...props} />
    </GameUiProvider>
  );
}
