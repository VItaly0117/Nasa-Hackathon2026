import type { CrewMember } from "@/types";
import portrait1 from "@/assets/crew/crew1.webp";
import portrait2 from "@/assets/crew/crew2.webp";
import portrait3 from "@/assets/crew/crew3.webp";
import portrait4 from "@/assets/crew/crew4.webp";
import { moduleName, t, tDynamic } from "@/i18n";
import { CREW } from "@/ui/crewData";
import { CollapseButton } from "@/ui/Collapse";
import { useScrollMore } from "@/ui/useScrollMore";
import { startsCollapsed, useCollapsed } from "@/ui/useCollapsed";

// Экипаж пока декоративный: настроение и полоска берутся из общего здоровья.
// TODO @Regie: у каждого астронавта свои здоровье, усталость и задача
// Имена и роли лежат в словарях i18n: crew.n1..n4 и crew.r1..r4, а цвета — в crewData.ts

// Портрет астронавта: готовая картинка (src/assets/crew/crew<id>.webp). Когда плохо, портрет тускнеет
const PORTRAITS: Record<number, string> = { 1: portrait1, 2: portrait2, 3: portrait3, 4: portrait4 };

export function Avatar({ id, mood }: { id: number; mood: number }) {
  return (
    <img
      src={PORTRAITS[id]}
      width={52}
      height={52}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ borderRadius: 10, display: "block", objectFit: "cover", filter: mood < 0 ? "saturate(0.55) brightness(0.9)" : undefined }}
    />
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
  const scrollRef = useScrollMore<HTMLElement>();

  return (
    <section ref={scrollRef} className="hud-panel crew scroll-more" aria-label={t("crew.aria")}>
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
            <Avatar id={p.id} mood={mood} />
            <div className="crew__info">
              <strong>{tDynamic(`crew.n${p.id}`)}</strong>
              <span className="crew__role">
                {tDynamic(`crew.r${p.id}`)} ·{" "}
                {(() => {
                  const status = crew.find((c) => c.id === p.id)?.status;
                  return status?.kind === "building"
                    ? t("crew.building", { name: moduleName(status.module) })
                    : status?.kind === "sick"
                      ? t("crew.sick")
                      : t("crew.free");
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
