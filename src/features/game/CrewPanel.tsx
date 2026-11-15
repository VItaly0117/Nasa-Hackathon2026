import type { CrewMember } from "@/types";
import { moduleName, t, tDynamic } from "@/i18n";
import { CREW } from "@/ui/crewData";
import { CollapseButton } from "@/ui/Collapse";
import { startsCollapsed, useCollapsed } from "@/ui/useCollapsed";

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
      <title>{label}</title>
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
  const [collapsed, toggle] = useCollapsed(startsCollapsed(), "crew");

  return (
    <section className="hud-panel crew" aria-label={t("crew.aria")}>
      <div className="panel-head">
        <h2 className="hud-title">{t("crew.title", { n: CREW.length })}</h2>
        <CollapseButton collapsed={collapsed} onClick={toggle} />
      </div>
      {!collapsed && (
      <ul className="crew__list">
        {CREW.map((p) => {
          const member = crew.find((c) => c.id === p.id);
          const mood = member?.status.kind === "sick" ? -1 : moodOf(member?.morale ?? 70, health);
          return (
          <li key={p.id} className="crew__item">
            <Avatar skin={p.skin} hair={p.hair} long={p.long} mood={mood} />
            <div className="crew__info">
              <strong>{tDynamic(`crew.n${p.id}`)}</strong>
              <span className="crew__role">{tDynamic(`crew.r${p.id}`)}</span>
              {(() => {
                const status = member?.status;
                const kind = status?.kind ?? "free";
                const text =
                  status?.kind === "building"
                    ? t("crew.building", { name: moduleName(status.module) })
                    : status?.kind === "sick"
                      ? t("crew.sick")
                      : t("crew.free");
                return <span className={`crew__badge crew__badge--${kind}`}>{text}</span>;
              })()}
              <div className="crew__vital" role="progressbar" aria-label={t("crew.healthLabel")} title={t("crew.healthTip")}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(health)}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <path d="M10 17 C2 11 2 4.5 6.2 4.5 C8 4.5 9.3 5.6 10 7 C10.7 5.6 12 4.5 13.8 4.5 C18 4.5 18 11 10 17 Z" fill={barColor} />
                </svg>
                <div className="crew__bar">
                  <div style={{ width: `${health}%`, background: barColor }} />
                </div>
                <span className="crew__pct">{Math.round(health)}%</span>
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
