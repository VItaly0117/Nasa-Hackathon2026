import { DAY_MS, MISSION_DAYS, NIGHT_START } from "@/engine";
import { t } from "@/i18n";
import { useGame } from "@/session/hooks";
import { shallowEqual } from "@/session/store";

// Вся миссия одной полоской: слева дни, справа ночь (с дня NIGHT_START), метка показывает «сейчас».
// Положение считается от дня и от часов дня, поэтому метка плывёт плавно
export function CycleBar() {
  const { day, isNight, clockMs } = useGame((s) => ({ day: s.day, isNight: s.isNight, clockMs: s.clockMs }), shallowEqual);
  const spent = Math.min(MISSION_DAYS, day - 1 + clockMs / DAY_MS);
  const pos = (spent / MISSION_DAYS) * 100;
  const nightAt = ((NIGHT_START - 1) / MISSION_DAYS) * 100;
  const label = t("cycle.aria", { day, total: MISSION_DAYS, night: NIGHT_START });

  return (
    <div className="cycle" role="img" aria-label={label} title={label}>
      <span className="cycle__icon" aria-hidden="true">☀️</span>
      <div className="cycle__track">
        <div className="cycle__day" style={{ width: `${nightAt}%` }} />
        <div className="cycle__night" style={{ left: `${nightAt}%` }} />
        <span className="cycle__marker" style={{ left: `${pos}%` }} aria-hidden="true">{isNight ? "🌙" : "☀️"}</span>
      </div>
      <span className="cycle__icon" aria-hidden="true">🌙</span>
    </div>
  );
}
