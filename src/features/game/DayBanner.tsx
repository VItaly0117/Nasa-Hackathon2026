import { useEffect, useState } from "react";
import { MISSION_DAYS } from "@/engine";
import { t } from "@/i18n";
import { useGame } from "@/session/react";
import { shallowEqual } from "@/session/store";

// Баннер «День N» на несколько секунд при смене дня
export function DayBanner() {
  const { day, isNight } = useGame((s) => ({ day: s.day, isNight: s.isNight }), shallowEqual);
  const visible = useGame((s) => s.status === "playing" && s.activeEvent === null);
  const [banner, setBanner] = useState<{ day: number; night: boolean } | null>(null);

  useEffect(() => {
    if (day === 1) return;
    setBanner({ day, night: isNight });
    const timer = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(timer);
  }, [day, isNight]);

  if (!banner || !visible) return null;
  return (
    <div key={banner.day} className={`day-banner ${banner.night ? "day-banner--night" : ""}`} aria-live="polite">
      {t("app.dayOf", { day: banner.day, total: MISSION_DAYS })}
      {banner.night ? ` · ${t("app.night")}` : ""}
    </div>
  );
}
