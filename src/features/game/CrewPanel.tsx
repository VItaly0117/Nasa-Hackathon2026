import { useState } from "react";
import type { CrewMember, ModuleType } from "@/types";
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

export type BrokenModule = { slot: number; type: ModuleType };

export function CrewPanel({
  health,
  crew,
  broken = [],
  canAffordRepair = true,
  onRepair,
}: {
  health: number;
  crew: CrewMember[];
  broken?: BrokenModule[];
  canAffordRepair?: boolean;
  onRepair?: (slot: number) => void;
}) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const barColor = health >= 70 ? "#4ade80" : health >= 40 ? "#fbbf24" : "#ff7a7a";
  const [collapsed, toggle] = useCollapsed(startsCollapsed());
  const scrollRef = useScrollMore<HTMLElement>();

  return (
    <section ref={scrollRef} className={`hud-panel crew scroll-more${collapsed ? " crew--collapsed" : ""}`} aria-label={t("crew.aria")}>
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
                  if (status?.kind === "building") return t("crew.building", { name: moduleName(status.module) });
                  if (status?.kind === "sick") return t("crew.sick");
                  return (
                    <button
                      type="button"
                      className="crew__free"
                      aria-expanded={menuFor === p.id}
                      title={t("crew.assign")}
                      onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                    >
                      {t("crew.free")} ▾
                    </button>
                  );
                })()}
              </span>
              <div className="crew__barrow" title={`${t("crew.healthBar")}: ${Math.round(health)}%`}>
                <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" className="crew__baricon">
                  <path d="M10 17 C2 11 3 4 7 4 C9 4 10 6 10 6 C10 6 11 4 13 4 C17 4 18 11 10 17 Z" fill={barColor} />
                </svg>
                <div
                  className="crew__bar"
                  role="meter"
                  aria-label={t("crew.healthBar")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(health)}
                >
                  <div style={{ width: `${health}%`, background: barColor }} />
                </div>
              </div>
              {menuFor === p.id && (
                <div className="crew__menu" role="menu" aria-label={t("crew.assign")}>
                  {broken.length === 0 ? (
                    <p className="crew__menu-empty">{t("crew.assignNone")}</p>
                  ) : (
                    broken.map((b) => (
                      <button
                        key={b.slot}
                        type="button"
                        role="menuitem"
                        className="crew__menu-item"
                        disabled={!canAffordRepair}
                        title={canAffordRepair ? undefined : t("crew.assignNoMoney")}
                        onClick={() => {
                          onRepair?.(b.slot);
                          setMenuFor(null);
                        }}
                      >
                        🔧 {t("crew.assignRepair", { name: moduleName(b.type) })}
                      </button>
                    ))
                  )}
                </div>
              )}
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
