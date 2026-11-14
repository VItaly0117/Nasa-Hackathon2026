import modulesData from "@/content/modules.json";
import { canPlace, hasFreeCrew, REPAIR_COST, slotOf } from "@/engine";
import type { TileInfo } from "@/engine";
import type { ModuleDef, ModuleType } from "@/types";
import { sound } from "@/audio/audio";
import { useGame, useSend, useSession } from "@/session/react";
import { BuildProgress } from "@/features/game/map/BuildProgress";
import LunarMap from "@/features/game/map/LunarMap";
import type { MapModule } from "@/features/game/map/LunarMap";
import { t } from "@/i18n";
import { canAffordCost } from "./afford";
import { useGameUi } from "./ui-state";

const MODULES = modulesData as ModuleDef[];

const sameMapModules = (a: MapModule[], b: MapModule[]) =>
  a.length === b.length &&
  a.every((m, i) => m.slot === b[i].slot && m.type === b[i].type && m.broken === b[i].broken && m.building === b[i].building && m.waiting === b[i].waiting);

// Доля готовности стройки: меняется 10 раз в секунду, поэтому перерисовывается только этот маленький кусок
function LiveProgress({ slot, type }: { slot: number; type: ModuleType }) {
  const done = useGame((s) => {
    const build = s.modules.find((m) => m.slot === slot)?.build;
    return build ? 1 - build.leftMs / build.totalMs : 0;
  });
  return <BuildProgress type={type} done={done} />;
}

function LivePercent({ slot }: { slot: number }) {
  const percent = useGame((s) => {
    const build = s.modules.find((m) => m.slot === slot)?.build;
    return build ? Math.round((1 - build.leftMs / build.totalMs) * 100) : 0;
  });
  return <>{t("map.building", { n: percent })}</>;
}

const RENDER_BUILD = {
  progress: (m: MapModule) => <LiveProgress slot={m.slot} type={m.type} />,
  percent: (m: MapModule) => <LivePercent slot={m.slot} />,
};

export function MapView() {
  const session = useSession();
  const send = useSend();
  const ui = useGameUi();
  const modules = useGame(
    (s): MapModule[] =>
      s.modules.map((m) => ({ slot: m.slot, type: m.type, broken: m.broken, building: !!m.build, waiting: !!m.build && m.build.crewId === null })),
    sameMapModules,
  );
  const isNight = useGame((s) => s.isNight);
  const crewActive = useGame((s) => s.status === "playing" && s.activeEvent === null);
  const canAffordRepair = useGame((s) => canAffordCost(s.resources, REPAIR_COST));

  function handleSelectTile(tile: TileInfo) {
    const state = session.store.getState();
    if (ui.surveyingIce) {
      send({ type: "research", id: "iceScout", answer: tile.terrain === "ice" ? "ice" : "rock" });
      ui.setSurveyingIce(false);
      return;
    }
    const type = ui.buildType;
    if (!type || !hasFreeCrew(state) || !canPlace(state, type, tile.row, tile.col)) return;
    sound.playBuildStart();
    send({ type: "build", slot: slotOf(tile.row, tile.col), module: type });
    ui.stopPlacing();
  }

  return (
    <LunarMap
      modules={modules}
      defs={MODULES}
      isNight={isNight}
      buildType={ui.buildType}
      surveyingIce={ui.surveyingIce}
      crewActive={crewActive}
      canPlaceAt={(row, col) => ui.buildType !== null && canPlace(session.store.getState(), ui.buildType, row, col)}
      canAffordRepair={canAffordRepair}
      onRepairModule={(slot) => {
        sound.playRepair();
        send({ type: "repair", slot });
      }}
      onSelectTile={handleSelectTile}
      renderBuild={RENDER_BUILD}
    />
  );
}
