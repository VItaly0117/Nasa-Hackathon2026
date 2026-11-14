import type { CrewMember } from "../types";
import { moduleName, t } from "../i18n";
import { CREW } from "./crewData";
import { CollapseButton, startsCollapsed, useCollapsed } from "./Collapse";

// Экипаж пока декоративный: настроение и полоска берутся из общего здоровья.
// TODO @Regie: у каждого астронавта свои здоровье, усталость и задача
// Имена и роли лежат в словарях i18n: crew.n1..n4 и crew.r1..r4, а цвета — в crewData.ts

export function Avatar({ skin, hair, long, mood }: { skin: string; hair: string; long: boolean; mood: number }) {
  const mouth = mood > 0 ? "M15 25 Q20 29 25 25" : mood < 0 ? "M15 27 Q20 23 25 27" : "M15 26 H25";
  return (
    <svg viewBox="0 0 40 40" width="52" height="52" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#2a3a78" />
      {long && <path d="M8 22 Q6 8 20 7 Q34 8 32 22 L32 34 L8 34 Z" fill={hair} />}
      <path d="M10 40 Q10 31 20 31 Q30 31 30 40 Z" fill="#e8edf7" />
      <circle cx="20" cy="20" r="10" fill={skin} />
      <path d="M10 18 Q11 8 20 8 Q29 8 30 18 Q24 13 10 18 Z" fill={hair} />
      <circle cx="16.5" cy="20" r="1.4" fill="#2b1d1a" />
      <circle cx="23.5" cy="20" r="1.4" fill="#2b1d1a" />
      <path d={mouth} stroke="#7a3b2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Mood({ mood }: { mood: number }) {
  const color = mood > 0 ? "#4ade80" : mood < 0 ? "#ff7a7a" : "#fbbf24";
  const mouth = mood > 0 ? "M7 13 Q11 17 15 13" : mood < 0 ? "M7 15 Q11 11 15 15" : "M7 14 H15";
  const label = mood > 0 ? t("crew.moodGood") : mood < 0 ? t("crew.moodBad") : t("crew.moodTired");
  return (
    <svg viewBox="0 0 22 22" width="32" height="32" role="img" aria-label={label}>
      <circle cx="11" cy="11" r="10" fill={color} />
      <circle cx="8" cy="9" r="1.3" fill="#14301f" />
      <circle cx="14" cy="9" r="1.3" fill="#14301f" />
      <path d={mouth} stroke="#14301f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Настроение лица: от морали (задания), а при плохом здоровье не бывает весёлым
const moodOf = (morale: number, health: number) => (health < 40 ? -1 : morale >= 60 ? 1 : morale >= 30 ? 0 : -1);

export function CrewPanel({ health, crew }: { health: number; crew: CrewMember[] }) {
  const barColor = health >= 70 ? "#4ade80" : health >= 40 ? "#fbbf24" : "#ff7a7a";
  const [collapsed, toggle] = useCollapsed(startsCollapsed());

  return (
    <section className="hud-panel crew" aria-label={t("crew.aria")}>
      <div className="panel-head">
        <h2 className="hud-title">{t("crew.title", { n: CREW.length })}</h2>
        <CollapseButton collapsed={collapsed} onClick={toggle} />
      </div>
      {!collapsed && (
      <ul className="crew__list">
        {CREW.map((p) => {
          const mood = moodOf(crew.find((c) => c.id === p.id)?.morale ?? 70, health);
          return (
          <li key={p.id} className="crew__item">
            <Avatar skin={p.skin} hair={p.hair} long={p.long} mood={mood} />
            <div className="crew__info">
              <strong>{t(`crew.n${p.id}`)}</strong>
              <span className="crew__role">
                {t(`crew.r${p.id}`)} ·{" "}
                {(() => {
                  const status = crew.find((c) => c.id === p.id)?.status;
                  return status?.kind === "building" ? t("crew.building", { name: moduleName(status.module) }) : t("crew.free");
                })()}
              </span>
              <div className="crew__bar">
                <div style={{ width: `${health}%`, background: barColor }} />
              </div>
            </div>
            <Mood mood={mood} />
          </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
