import type { ResourceKey, Resources } from "@/types";
import { t } from "@/i18n";
import { ResourceIcon } from "@/ui/icons";
import { resourceLevel } from "./resource-config";
import "./ResourceBar.css";

type Props = {
  resources: Resources;
  delta: Partial<Resources>;      // реальный прирост прямо сейчас (с учётом дня или ночи)
  dayDelta: Partial<Resources>;   // каким он был бы днём
  nightDelta: Partial<Resources>; // и ночью
  isNight: boolean;
  capacity: Resources; // сколько каждого ресурса помещается на базе (склад и батарея добавляют места)
};

// Кислород и здоровье остаются процентами, остальное в единицах с лимитом: «70/100 л»
const PERCENT: ResourceKey[] = ["oxygen", "health"];

const ORDER: ResourceKey[] = ["oxygen", "water", "food", "energy", "materials", "health"];

const HOURS_PER_DAY = 24;

function formatDelta(perDay: number): string {
  if (perDay > 0) return `+${perDay}`;
  if (perDay < 0) return `−${Math.abs(perDay)}`;
  return "0";
}

// «≈3 дн.» или, если хватит меньше чем на день, «≈7 год.»
function formatSpan(daysFloat: number): string {
  if (daysFloat < 1) return `${Math.max(0, Math.floor(daysFloat * HOURS_PER_DAY))} ${t("unit.hShort")}`;
  return `${Math.floor(daysFloat)} ${t("unit.dShort")}`;
}

export function ResourceBar({ resources, delta, dayDelta, nightDelta, isNight, capacity }: Props) {
  return (
    <ul className="resources" aria-label={t("res.aria")}>
      {ORDER.map((key) => {
        const value = Math.round(resources[key]);
        const perDay = delta[key] ?? 0;
        const day = dayDelta[key] ?? 0;
        const night = nightDelta[key] ?? 0;
        const ratesDiffer = day !== night;
        const daysFloat = perDay < 0 ? value / -perDay : null;
        const label = t(`res.${key}`);
        const level = resourceLevel(key, value, capacity[key], daysFloat);
        const trend = perDay > 0 ? "up" : perDay < 0 ? "down" : "flat";
        const span = daysFloat !== null ? formatSpan(daysFloat) : null;
        const status = level === "ok" ? null : t(`res.status.${level}`);

        return (
          <li
            key={key}
            className={`resource resource--${level}`}
            tabIndex={0}
            aria-label={[label, `${value}`, status, t(`res.trend.${trend}`)].filter(Boolean).join(", ")}
            data-full={!PERCENT.includes(key) && value >= capacity[key] ? "" : undefined}
          >
            <ResourceIcon type={key} />
            <div className="resource__body">
              <span className="resource__value">
                <span key={value} className="resource__num">{value}</span>
                {PERCENT.includes(key) ? (
                  t(`res.unit.${key}`)
                ) : (
                  <small className="resource__cap">
                    /{capacity[key]} {t(`res.unit.${key}`)}
                  </small>
                )}
              </span>
              <span className={`resource__delta resource__delta--${trend}`}>
                <span aria-hidden="true">{trend === "up" ? "▲" : trend === "down" ? "▼" : "="}</span>{" "}
                {trend === "flat" ? t("res.trend.flat") : t("res.perDay", { delta: formatDelta(perDay) })}
                {isNight && ratesDiffer && <span title={t("app.night")} aria-label={t("app.night")}> 🌙</span>}
              </span>
              {(status || span) && (
                <span className="resource__status">
                  {status && <><span aria-hidden="true">⚠️</span> {status}</>}
                  {status && span && " · "}
                  {span && t("res.forecast", { span })}
                </span>
              )}
            </div>
            <div className="resource__tip" role="tooltip">
              <strong>{label}</strong>
              <p>{t(`res.tip.${key}.what`)}</p>
              <p>{t(`res.tip.${key}.use`)}</p>
              <p className="resource__tipnote">
                {t("res.tip.now", { delta: formatDelta(perDay) })}
                {ratesDiffer && ` ${t("res.tip.dayNight", { day: formatDelta(day), night: formatDelta(night) })}`}
              </p>
              {key === "energy" && <p className="resource__tipnote">{t("res.tip.energy.night")}</p>}
              {span && <p className="resource__tipnote">{t("res.tip.left", { span })}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
