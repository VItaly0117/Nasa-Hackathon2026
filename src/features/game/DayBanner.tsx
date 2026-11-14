import { useEffect, useState } from "react";
import { MISSION_DAYS } from "@/engine";
import { t } from "@/i18n";
import { useGame } from "@/session/hooks";
import { shallowEqual } from "@/session/store";

// Баннер «День N» на несколько секунд при смене дня. Что показывать, выводится из дня; в состоянии только день, который уже скрыт
export function DayBanner() {
  const { day, isNight } = useGame((s) => ({ day: s.day, isNight: s.isNight }), shallowEqual);
  const visible = useGame((s) => s.status === "playing" && s.activeEvent === null);
  const [hiddenDay, setHiddenDay] = useState(0);

  useEffect(() => {
    if (day === 1) return;
    const timer = window.setTimeout(() => setHiddenDay(day), 1800);
    return () => window.clearTimeout(timer);
  }, [day]);

  if (day === 1 || hiddenDay === day || !visible) return null;
  return (
    <div key={day} className={`day-banner ${isNight ? "day-banner--night" : ""}`} aria-live="polite">
      {t("app.dayOf", { day, total: MISSION_DAYS })}
      {isNight ? ` · ${t("app.night")}` : ""}
    </div>
  );
}
