import { useEffect, useRef, useState } from "react";
import type { ModuleDef, ModuleType, Resources, ResourceKey, Role } from "@/types";
import { moduleDesc, moduleName, t, tDynamic } from "@/i18n";
import { ModulePreview } from "@/features/game/map/art";
import { ResourceIcon } from "@/ui/icons";
import { startsCollapsed, useCollapsed } from "@/ui/useCollapsed";
import "./BuildMenu.css";

type Props = {
  defs: ModuleDef[];
  selected: ModuleType | null;   // какой модуль открыт в карточке справа
  placing: boolean;              // игрок сейчас выбирает место на карте
  disabled: boolean;
  crewBusy: boolean;             // все члены экипажа заняты стройкой: ставить нельзя
  isAffordable: (def: ModuleDef) => boolean;
  // Совместная игра: роль другого игрока, который строит этот модуль, или null, если строить можно самому
  lockedBy?: (def: ModuleDef) => Role | null;
  onSelect: (type: ModuleType) => void;
  onStartBuild: (type: ModuleType) => void;
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
  const [hovered, setHovered] = useState<ModuleType | null>(null);
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
        {placing && (
          <>
            <span className="build-dock__hint">{t("build.hintPlacing")}</span>
            <button className="btn btn--solid btn--cancel btn--small" onClick={onCancel}>
              {t("build.cancel")}
            </button>
          </>
        )}
        <button
          className={`build-toggle ${!collapsed ? "build-toggle--open" : ""}`}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("build.tab") : t("build.close")}
          title={collapsed ? t("build.tab") : t("build.close")}
        >
          {collapsed ? (
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="24" height="24" aria-hidden="true">
              <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          <span className="build-toggle__label">{collapsed ? t("build.tab") : t("build.close")}</span>
        </button>
      </div>
      {!collapsed && (
      <section className="hud-panel build" aria-label={t("build.aria")}>
        {(
          <ul className="build__list">
            {defs.map((d) => {
              const lines = perDayLines(d.perDay);
              const locked = lockedBy ? lockedBy(d) : null;
              const affordable = isAffordable(d);
              const blocked = disabled || !affordable || crewBusy || locked !== null;
              const status = locked
                ? t("online.lockedBy", { role: t(`role.${locked}`) })
                : crewBusy ? t("build.crewBusy") : !affordable ? t("build.cantAfford") : null;
              return (
              <li
                key={d.type}
                className="card-wrap"
                onMouseEnter={() => setHovered(d.type)}
                onMouseLeave={() => setHovered((h) => (h === d.type ? null : h))}
              >
                <button
                  className={`card ${selected === d.type ? "card--selected" : ""} ${!affordable ? "card--poor" : ""}`}
                  onClick={() => {
                    onSelect(d.type);
                    if (!blocked) onStartBuild(d.type);
                  }}
                  onFocus={() => setHovered(d.type)}
                  onBlur={() => setHovered((h) => (h === d.type ? null : h))}
                  disabled={disabled}
                  aria-pressed={selected === d.type}
                >
                  <span className="card__name">{moduleName(d.type)}</span>
                  <ModulePreview type={d.type} size={70} />
                  <Cost cost={d.cost} />
                </button>
                {hovered === d.type && (
                  <div className="detail" role="tooltip">
                    <h2 className="hud-title">{moduleName(d.type)}</h2>
                    <p>{moduleDesc(d.type)}</p>
                    <ul className="detail__lines">
                      {lines.map((l) => (
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
                    {status && <div className="detail__status">{status}</div>}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

    </>
  );
}
