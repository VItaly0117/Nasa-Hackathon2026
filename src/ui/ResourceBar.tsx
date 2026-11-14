import type { ResourceKey, Resources } from "../types";
import { daysShort, t } from "../i18n";
import { ResourceIcon } from "./icons";
import "./ResourceBar.css";

type Props = {
  resources: Resources;
  delta: Partial<Resources>;
};

const ORDER: ResourceKey[] = ["oxygen", "water", "food", "energy", "health"];

const WARN_DAYS = 5;    // жёлтый, если ресурса хватит меньше чем на столько дней
const DANGER_DAYS = 2;  // красный

function daysLeft(value: number, perDay: number): number | null {
  if (perDay >= 0) return null;
  return Math.floor(value / -perDay);
}

function formatDelta(perDay: number): string {
  if (perDay > 0) return `+${perDay}`;
  if (perDay < 0) return `−${Math.abs(perDay)}`;
  return "0";
}

export function ResourceBar({ resources, delta }: Props) {
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
            title={left !== null ? t("res.leftTitle", { label, days: daysShort(left) }) : label}
          >
            <ResourceIcon type={key} />
            <div className="resource__body">
              <span className="resource__value">{value}%</span>
              <span className={`resource__delta ${perDay < 0 ? "minus" : perDay > 0 ? "plus" : ""}`}>
                {left !== null && left <= WARN_DAYS
                  ? t("res.forDays", { days: daysShort(left) })
                  : t("res.perDay", { delta: formatDelta(perDay) })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
