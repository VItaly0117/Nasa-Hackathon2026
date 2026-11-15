import modulesData from "@/content/modules.json";
import { canAffordCost } from "./afford";
import { capacityOf, dailyDelta, dailyDeltaFor, hasFreeCrew, lockedTasks } from "@/engine";
import { goalHint } from "./goal-hint";
import type { ModuleDef, Role } from "@/types";
import { sound } from "@/audio/audio";
import { useGame, useMeta, useSend, useSession } from "@/session/hooks";
import { shallowEqual } from "@/session/store";
import { BuildMenu } from "./BuildMenu";
import { CrewPanel } from "./CrewPanel";
import { ResourceBar } from "./ResourceBar";
import { SidePanel } from "./SidePanel";
import { useGameUi } from "./ui-state";

const MODULES = modulesData as ModuleDef[];

// Каждая панель подписана только на свой кусок состояния, поэтому ход часов их не перерисовывает

export function ResourcesContainer() {
  const resources = useGame((s) => s.resources);
  const delta = useGame(dailyDelta, shallowEqual);
  const dayDelta = useGame((s) => dailyDeltaFor(s, false), shallowEqual);
  const nightDelta = useGame((s) => dailyDeltaFor(s, true), shallowEqual);
  const isNight = useGame((s) => s.isNight);
  const capacity = useGame((s) => capacityOf(s.modules), shallowEqual);
  return (
    <ResourceBar
      resources={resources}
      delta={delta}
      dayDelta={dayDelta}
      nightDelta={nightDelta}
      isNight={isNight}
      capacity={capacity}
    />
  );
}

export function CrewContainer() {
  const health = useGame((s) => s.resources.health);
  const crew = useGame((s) => s.crew);
  return <CrewPanel health={health} crew={crew} />;
}

export function SideContainer() {
  const view = useGame(
    (s) => ({ day: s.day, isNight: s.isNight, pending: s.pending, tasks: s.tasks, research: s.research, log: s.log }),
    shallowEqual,
  );
  const locked = useGame(lockedTasks, shallowEqual);
  const hint = useGame(goalHint);
  const send = useSend();
  const ui = useGameUi();
  return (
    <SidePanel
      state={view}
      locked={locked}
      hint={hint}
      surveyingIce={ui.surveyingIce}
      onCancelIceSurvey={() => ui.setSurveyingIce(false)}
      onStartIceSurvey={() => ui.setSurveyingIce(true)}
      onResearch={(answer) => send({ type: "research", id: "moonDust", answer })}
    />
  );
}

export function BuildContainer() {
  const { resources, crewBusy, playing } = useGame(
    (s) => ({ resources: s.resources, crewBusy: !hasFreeCrew(s), playing: s.status === "playing" }),
    shallowEqual,
  );
  const session = useSession();
  const players = useMeta((m) => m.players);
  const ui = useGameUi();

  // Модуль строит игрок с ролью из modules.json. Пока такой роли ни у кого нет, строить может любой
  const online = session.online;
  const lockedBy = online
    ? (def: ModuleDef): Role | null =>
        def.builder && def.builder !== online.role && players.some((p) => p.role === def.builder) ? def.builder : null
    : undefined;

  return (
    <BuildMenu
      defs={MODULES}
      selected={ui.selectedType}
      placing={ui.buildType !== null}
      disabled={!playing}
      crewBusy={crewBusy}
      isAffordable={(def) => canAffordCost(resources, def.cost)}
      lockedBy={lockedBy}
      onSelect={(type) => {
        sound.playClick();
        ui.selectType(type);
      }}
      onStartBuild={(type) => {
        sound.playClick();
        ui.startPlacing(type);
      }}
      onCancel={() => {
        sound.playClick();
        ui.stopPlacing();
      }}
    />
  );
}
