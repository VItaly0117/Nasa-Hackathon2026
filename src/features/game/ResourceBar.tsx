import type { ResourceKey, Resources } from "@/types";
import { daysShort, t } from "@/i18n";
import { ResourceIcon } from "@/ui/icons";
import "./ResourceBar.css";

type Props = {
  resources: Resources;
  delta: Partial<Resources>;
  capacity: Resources; // сколько каждого ресурса помещается на базе (склад и батарея добавляют места)
};

// Кислород и здоровье остаются процентами, остальное в единицах с лимитом: «70/100 л»
const PERCENT: ResourceKey[] = ["oxygen", "health"];

const ORDER: ResourceKey[] = ["oxygen", "water", "food", "energy", "materials", "health"];

const WARN_DAYS = 5;    // жёлтый, если ресурса хватит меньше чем на столько дней
const DANGER_DAYS = 2;  // красный

function daysLeft(value: number, perDay: number): number | null {
  if (perDay >= 0) return null;
  return Math.floor(value / -perDay);
}

// Расход бывает дробным (нормы NASA пересчитаны в игровые единицы): показываем один знак после запятой, если он нужен
function formatDelta(perDay: number): string {
  const v = Math.round(Math.abs(perDay) * 10) / 10;
  if (v === 0) return "0";
  return `${perDay > 0 ? "+" : "−"}${v}`;
}

export function ResourceBar({ resources, delta, capacity }: Props) {
  return (
    <ul className="resources" aria-label={t("res.aria")}>
      {ORDER.map((key) => {
        const value = Math.round(resources[key]);
        const perDay = delta[key] ?? 0;
        const left = daysLeft(value, perDay);
        const label = t(`res.${key}`);
        const level =
          left !== null && left <= DANGER_DAYS ? "danger"
          : left !== null && left <= WARN_DAYS ? "warn"
          : "ok";

        return (
          <li
            key={key}
            className={`resource resource--${level}`}
            tabIndex={0}
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
              <span className={`resource__delta ${perDay < 0 ? "minus" : perDay > 0 ? "plus" : ""}`}>
                {left !== null && left <= WARN_DAYS
                  ? t("res.forDays", { days: daysShort(left) })
                  : t("res.perDay", { delta: formatDelta(perDay) })}
              </span>
            </div>
            <div className="resource__tip" role="tooltip">
              <strong>{label}</strong>
              <p>{t(`res.tip.${key}.what`)}</p>
              <p>{t(`res.tip.${key}.use`)}</p>
              {left !== null && (
                <p className="resource__tipnote">{t("res.tip.left", { days: daysShort(left) })}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
