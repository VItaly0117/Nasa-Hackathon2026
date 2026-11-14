import { sound } from "@/audio/audio";
import { t } from "@/i18n";
import { useGame, useMeta, useSession } from "@/session/react";
import { Intro } from "@/features/story/Intro";
import { ResultsScreen } from "@/features/results/ResultsScreen";
import { RotateHint } from "@/ui/RotateHint";
import { DayBanner } from "./DayBanner";
import { EventModal } from "./EventModal";
import { MapView } from "./MapView";
import { BuildContainer, CrewContainer, SideContainer } from "./Panels";
import { TaskToasts } from "./TaskToasts";
import { TopBar } from "./TopBar";
import { GameUiProvider, useGameUi } from "./ui-state";
import { useSoundEffects } from "./useSoundEffects";

type Props = { onRestart: () => void; onMenu: () => void; onSources: () => void };

function Results({ onRestart, onMenu, onSources }: Props) {
  const session = useSession();
  const state = useGame((s) => s);
  const record = useMeta((m) => m.record);
  return (
    <ResultsScreen
      state={state}
      online={!!session.online}
      record={record}
      onRestart={() => { sound.playClick(); onRestart(); }}
      onMenu={() => { sound.playClick(); session.save(); onMenu(); }}
      onSources={() => { sound.playClick(); onSources(); }}
    />
  );
}

function Rules() {
  const ui = useGameUi();
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
      <DayBanner />
      <TaskToasts />
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
