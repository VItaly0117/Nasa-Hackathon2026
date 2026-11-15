import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { DAY_MS, MISSION_DAYS, NIGHT_START } from "@/engine";
import { days, t } from "@/i18n";
import { sound } from "@/audio/audio";
import { useGame, useMeta, useSession } from "@/session/hooks";
import { shallowEqual } from "@/session/store";
import { DayClock } from "./DayClock";
import { BookIcon, MoonLogo, SoundOffIcon, SoundOnIcon } from "@/ui/icons";
import { ResourcesContainer } from "./Panels";
import { useClockRunning } from "./useClockRunning";
import { useGameUi } from "./ui-state";

// Часы: единственное, что перерисовывается на каждый tick. Время дня идёт, пока игрок ничем не занят:
// ни события, ни правил, ни выбора места. В совместной игре время общее: его двигает только ведущий
function GameClock({ children }: { children: ReactNode }) {
  const session = useSession();
  const clockMs = useGame((s) => s.clockMs);
  const running = useClockRunning();
  const isNight = useGame((s) => s.isNight);
  return (
    <DayClock running={running} isNight={isNight} progress={clockMs / DAY_MS} onTick={session.tick}>
      {children}
    </DayClock>
  );
}

function Badge() {
  const session = useSession();
  const { day, isNight } = useGame((s) => ({ day: s.day, isNight: s.isNight }), shallowEqual);
  const playersCount = useMeta((m) => m.players.length);
  const daysToNight = NIGHT_START - day;
  return (
    <div className="base-badge__text">
      <strong>{t("app.base")}</strong>
      <span>
        {t("app.dayOf", { day, total: MISSION_DAYS })} ·{" "}
        {isNight ? t("app.night") : daysToNight > 0 ? t("app.toNight", { days: days(daysToNight) }) : t("app.lunarDay")}
      </span>
      {session.online && (
        <span className="online-badge">
          {t("online.badge", { room: session.online.room, role: t(`role.${session.online.role}`) })} ·{" "}
          {t("online.players", { n: playersCount })}
        </span>
      )}
    </div>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState(() => sound.isMuted());
  useEffect(() => sound.subscribe(setMuted), []);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small btn--icon base-badge__mute"
      onClick={() => sound.toggleMute()}
      aria-label={muted ? t("app.soundOff") : t("app.soundOn")}
      title={muted ? t("app.soundOff") : t("app.soundOn")}
    >
      {muted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
    </button>
  );
}

function Buttons({ onMenu }: { onMenu: () => void }) {
  const ui = useGameUi();
  return (
    <>
      <button className="btn btn--ghost btn--small btn--help" onClick={() => { sound.playClick(); ui.setRulesOpen(true); }}>
        <BookIcon size={18} />
        <span>{t("app.rules")}</span>
      </button>
      <button className="btn btn--ghost btn--small" onClick={() => { sound.playClick(); onMenu(); }}>
        {t("app.menu")}
      </button>
    </>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="topbar">
      <div className="hud-panel base-badge">
        <MoonLogo />
        <Badge />
        <MuteButton />
        <GameClock>
          <Buttons onMenu={onMenu} />
        </GameClock>
      </div>
      <ResourcesContainer />
    </header>
  );
}
