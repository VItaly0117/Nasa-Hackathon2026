import type { ResourceKey, Resources } from "@/types";
import { daysShort, t } from "@/i18n";
import { ResourceIcon } from "@/ui/icons";
import "./ResourceBar.css";

type Props = {
  resources: Resources;
  delta: Partial<Resources>;
  capacity: Resources; // сколько каждого ресурса помещается на базе (склад и батарея добавляют места)
  otherDelta: Partial<Resources>; // скорость в противоположную фазу суток (ночью: дневная, днём: ночная)
  isNight: boolean;
};

// Кислород и здоровье остаются процентами, остальное в единицах с лимитом: «70/100 л»
const PERCENT: ResourceKey[] = ["oxygen", "health"];

const ORDER: ResourceKey[] = ["oxygen", "water", "food", "energy", "materials", "health"];

const WARN_DAYS = 5;    // жёлтый, если ресурса хватит меньше чем на столько дней
const DANGER_DAYS = 2;  // красный
const WARN_FRACTION = 0.25;   // жёлтый, если заполнено меньше четверти
const DANGER_FRACTION = 0.1;  // красный, если меньше десятой части

type Level = "ok" | "warn" | "danger";

// Сколько дней хватит ресурса (дробное число), или null, если он не убывает
function daysLeft(value: number, perDay: number): number | null {
  if (perDay >= 0) return null;
  return value / -perDay;
}

function formatDays(n: number): string {
  return n < 1 ? `${n.toFixed(1)} ${t("unit.dShort")}` : daysShort(Math.floor(n));
}

// Расход бывает дробным (нормы NASA пересчитаны в игровые единицы): показываем один знак после запятой, если он нужен
function formatDelta(perDay: number): string {
  const v = Math.round(Math.abs(perDay) * 10) / 10;
  if (v === 0) return "0";
  return `${perDay > 0 ? "+" : "−"}${v}`;
}

function levelOf(left: number | null, fraction: number): Level {
  if ((left !== null && left <= DANGER_DAYS) || fraction <= DANGER_FRACTION) return "danger";
  if ((left !== null && left <= WARN_DAYS) || fraction <= WARN_FRACTION) return "warn";
  return "ok";
}

export function ResourceBar({ resources, delta, capacity, otherDelta, isNight }: Props) {
  return (
    <ul className="resources" aria-label={t("res.aria")}>
      {ORDER.map((key) => {
        const value = Math.round(resources[key]);
        const perDay = delta[key] ?? 0;
        const other = otherDelta[key] ?? 0;
        // Прогноз по худшей из фаз суток: энергия днём растёт, но ночью её не хватит
        const worst = Math.min(perDay, other);
        const left = daysLeft(value, worst);
        const label = t(`res.${key}`);
        const percent = PERCENT.includes(key);
        const fraction = value / (percent ? 100 : Math.max(capacity[key], 1));
        const level = levelOf(left, fraction);
        const trend = perDay > 0 ? "up" : perDay < 0 ? "down" : "flat";
        const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "=";
        const dayRate = isNight ? other : perDay;
        const nightRate = isNight ? perDay : other;
        const nightDiffers = dayRate !== nightRate;

        return (
          <li
            key={key}
            className={`resource resource--${level}`}
            tabIndex={0}
            aria-label={`${label}: ${value}${percent ? t(`res.unit.${key}`) : ` / ${capacity[key]} ${t(`res.unit.${key}`)}`}${level !== "ok" ? `, ${t(`res.level.${level}`)}` : ""}`}
            data-full={!percent && value >= capacity[key] ? "" : undefined}
          >
            <ResourceIcon type={key} />
            <div className="resource__body">
              <span className="resource__value">
                <span key={value} className="resource__num">{value}</span>
                {percent ? (
                  t(`res.unit.${key}`)
                ) : (
                  <small className="resource__cap">
                    /{capacity[key]} {t(`res.unit.${key}`)}
                  </small>
                )}
                {level !== "ok" && (
                  <span className="resource__warn" role="img" aria-label={t(`res.level.${level}`)} title={t(`res.level.${level}`)}>
                    ⚠
                  </span>
                )}
              </span>
              <span className={`resource__delta ${perDay < 0 ? "minus" : perDay > 0 ? "plus" : ""}`}>
                <span className="resource__arrow" aria-label={t(`res.trend.${trend}`)}>{arrow}</span>{" "}
                <span className="resource__delta-text">
                  {left !== null && left <= WARN_DAYS
                    ? t("res.forDays", { days: formatDays(left) })
                    : trend === "flat"
                      ? t("res.stable")
                      : t("res.perDay", { delta: formatDelta(perDay) })}
                </span>
              </span>
            </div>
            <div className="resource__tip" role="tooltip">
              <strong>{label}</strong>
              <p>{t(`res.tip.${key}.what`)}</p>
              <p>{t(`res.tip.${key}.use`)}</p>
              <p className="resource__tipnote">
                {t(`res.trend.${trend}`)}
                {nightDiffers && (
                  <>
                    <br />☀ {t("res.perDay", { delta: formatDelta(dayRate) })} · ☾ {t("res.perDay", { delta: formatDelta(nightRate) })}
                  </>
                )}
              </p>
              {!PERCENT.includes(key) && value >= capacity[key] && <p className="resource__tipnote">{t("res.tip.cap")}</p>}
              {left !== null && (
                <p className="resource__tipnote">{t("res.tip.left", { days: formatDays(left) })}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
