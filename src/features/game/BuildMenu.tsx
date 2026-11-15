import { useEffect, useRef } from "react";
import type { ModuleDef, ModuleType, Resources, ResourceKey, Role } from "@/types";
import { moduleDesc, moduleName, t, tDynamic } from "@/i18n";
import { ModulePreview } from "@/features/game/map/art";
import { ResourceIcon } from "@/ui/icons";
import { startsCollapsed, useCollapsed } from "@/ui/useCollapsed";
import "./BuildMenu.css";

type Props = {
  defs: ModuleDef[];
  selected: ModuleType | null;   // последний выбранный модуль (подсветка карточки)
  placing: boolean;              // игрок сейчас выбирает место на карте
  disabled: boolean;
  crewBusy: boolean;             // все члены экипажа заняты стройкой: ставить нельзя
  isAffordable: (def: ModuleDef) => boolean;
  // Совместная игра: роль другого игрока, который строит этот модуль, или null, если строить можно самому
  lockedBy?: (def: ModuleDef) => Role | null;
  onSelect: (type: ModuleType) => void;
  onStartBuild: () => void;
  onCancel: () => void;
};

function Cost({ cost }: { cost: Partial<Resources> }) {
  const parts = Object.entries(cost).filter(([, value]) => value);
  if (parts.length === 0) return <span className="cost">{t("cost.free")}</span>;
  return (
    <span className="cost">
      {parts.map(([key, value]) => (
        <span key={key} className="cost__item">
          <ResourceIcon type={key as ResourceKey} size={18} />
          {value}
        </span>
      ))}
    </span>
  );
}

function perDayLines(perDay: Partial<Resources>) {
  return Object.entries(perDay)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      key: key as ResourceKey,
      plus: value! > 0,
      sign: value! > 0 ? "+" : "−",
      amount: Math.abs(value!),
      unit: tDynamic(`unit.${key}`),
      text: t("build.perDay", {
        sign: value! > 0 ? "+" : "−",
        n: Math.abs(value!),
        unit: tDynamic(`unit.${key}`),
      }),
    }));
}

export function BuildMenu({
  defs,
  selected,
  placing,
  disabled,
  crewBusy,
  isAffordable,
  lockedBy,
  onSelect,
  onStartBuild,
  onCancel,
}: Props) {
  // Карточка с подробностями плавно появляется над модулем (чистый CSS-hover); здесь только считаем сдвиг от краёв экрана
  const fitPopover = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const half = 190 + 8;
    const center = r.left + r.width / 2;
    const shift = Math.max(half - center, 0) || Math.min(window.innerWidth - 8 - half - center, 0);
    el.style.setProperty("--shift", `${shift}px`);
  };
  const [closed, toggle] = useCollapsed(startsCollapsed());
  // Пока игрок выбирает место на карте, список и карточка прячутся, чтобы не закрывать карту
  const collapsed = closed || placing;
  const wasPlacing = useRef(false);
  useEffect(() => {
    // После постройки или отмены меню остаётся свёрнутым, пока ребёнок сам его не откроет
    if (wasPlacing.current && !placing && !closed) toggle();
    wasPlacing.current = placing;
  }, [placing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="build-dock">
        <button
          className={`build-toggle ${!collapsed ? "build-toggle--open" : ""} ${placing ? "build-toggle--cancel" : ""}`}
          onClick={placing ? onCancel : toggle}
          aria-expanded={!collapsed}
          aria-label={placing ? t("build.cancel") : collapsed ? t("build.tab") : t("build.close")}
          title={placing ? t("build.cancel") : collapsed ? t("build.tab") : t("build.close")}
        >
          {collapsed && !placing ? (
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="24" height="24" aria-hidden="true">
              <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          <span className="build-toggle__label">{placing ? t("build.cancel") : collapsed ? t("build.tab") : t("build.close")}</span>
        </button>
      </div>
      {!collapsed && (
        <section className="hud-panel build" aria-label={t("build.aria")}>
          <ul className="build__list">
            {defs.map((d) => {
              const lk = lockedBy ? lockedBy(d) : null;
              const ok = isAffordable(d);
              const blocked = disabled || !ok || crewBusy || lk !== null;
              return (
                <li
                  key={d.type}
                  className="card-wrap"
                  onMouseEnter={(e) => fitPopover(e.currentTarget)}
                  onFocus={(e) => fitPopover(e.currentTarget)}
                >
                  <button
                    className={`card ${selected === d.type ? "card--selected" : ""} ${!ok ? "card--poor" : ""}`}
                    onClick={() => {
                      if (blocked) return;
                      onSelect(d.type);
                      onStartBuild();
                    }}
                    disabled={disabled}
                    aria-describedby={`detail-${d.type}`}
                  >
                    <span className="card__name">{moduleName(d.type)}</span>
                    <ModulePreview type={d.type} size={70} />
                    <Cost cost={d.cost} />
                  </button>
                  {(
                    <div id={`detail-${d.type}`} role="tooltip" className="detail">
                      <div className="detail__top">
                        <div className="detail__preview"><ModulePreview type={d.type} size={110} /></div>
                        <div className="detail__info">
                          <h2 className="hud-title">{moduleName(d.type)}</h2>
                          <p>{moduleDesc(d.type)}</p>
                        </div>
                      </div>
                      <ul className="detail__lines">
                        {perDayLines(d.perDay).map((l) => (
                          <li key={l.key} className={`detail__line ${l.plus ? "plus" : "minus"}`}>
                            <ResourceIcon type={l.key} size={20} />
                            <span className="detail__line-value">{l.sign}{l.amount}</span>
                            <span className="detail__line-label">{l.unit} / {t("unit.dShort")}</span>
                          </li>
                        ))}
                        {d.nightPerDay && <li className="detail__night">{t("build.night")}</li>}
                      </ul>
                      <div className="detail__cost">
                        <span>{t("build.cost")}</span>
                        <Cost cost={d.cost} />
                      </div>
                      {(lk || crewBusy || !ok) && (
                        <div className="detail__status">
                          {lk
                            ? t("online.lockedBy", { role: t(`role.${lk}`) })
                            : crewBusy ? t("build.crewBusy") : t("build.cantAfford")}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
