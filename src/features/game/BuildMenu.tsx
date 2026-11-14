import { useEffect, useRef } from "react";
import type { ModuleDef, ModuleType, Resources, ResourceKey, Role } from "@/types";
import { moduleDesc, moduleName, t, tDynamic } from "@/i18n";
import { ModulePreview } from "@/features/game/map/art";
import { ResourceIcon } from "@/ui/icons";
import { CollapseButton } from "@/ui/Collapse";
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
  const def = defs.find((d) => d.type === selected) ?? null;
  const lines = def ? perDayLines(def.perDay) : [];
  const locked = def && lockedBy ? lockedBy(def) : null;
  const affordable = def ? isAffordable(def) : false;
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
      <section className={`hud-panel build ${collapsed ? "build--collapsed" : ""}`} aria-label={t("build.aria")}>
        <div className="build__tabs">
          <span className="build__tab">
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
              <path d="M3 17 L11 9 M9 3 l8 8 l-3 3 l-8 -8 Z" stroke="#3b2a00" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            </svg>
            {t("build.tab")}
          </span>
          <span className="build__hint">
            {placing ? t("build.hintPlacing") : t("build.hintPick")}
          </span>
          {placing && (
            <button className="btn btn--ghost btn--small" onClick={onCancel}>
              {t("build.cancel")}
            </button>
          )}
          <CollapseButton collapsed={collapsed} onClick={toggle} />
        </div>
        {!collapsed && (
          <ul className="build__list">
            {defs.map((d) => (
              <li key={d.type}>
                <button
                  className={`card ${selected === d.type ? "card--selected" : ""}`}
                  onClick={() => onSelect(d.type)}
                  disabled={disabled}
                  aria-pressed={selected === d.type}
                >
                  <span className="card__name">{moduleName(d.type)}</span>
                  <ModulePreview type={d.type} size={70} />
                  <Cost cost={d.cost} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {def && !collapsed && (
        <section className="hud-panel detail" aria-label={t("build.moduleAria", { name: moduleName(def.type) })}>
          <div className="detail__top">
            <div className="detail__preview"><ModulePreview type={def.type} size={110} /></div>
            <div className="detail__info">
              <h2 className="hud-title">{moduleName(def.type)}</h2>
              <p>{moduleDesc(def.type)}</p>
              <ul className="detail__lines">
                {lines.map((l) => (
                  <li key={l.key} className={`detail__line ${l.plus ? "plus" : "minus"}`}>
                    <ResourceIcon type={l.key} size={20} />
                    <span className="detail__line-value">{l.sign}{l.amount}</span>
                    <span className="detail__line-label">{l.unit} / {t("unit.dShort")}</span>
                  </li>
                ))}
                {def.nightPerDay && <li className="detail__night">{t("build.night")}</li>}
              </ul>
            </div>
          </div>
          <div className="detail__cost">
            <span>{t("build.cost")}</span>
            <Cost cost={def.cost} />
          </div>
          {placing ? (
            <button className="btn btn--ghost" onClick={onCancel}>
              {t("build.cancel")}
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={onStartBuild}
              disabled={disabled || !affordable || crewBusy || locked !== null}
              title={crewBusy ? t("build.crewBusyHint") : undefined}
            >
              {locked
                ? t("online.lockedBy", { role: t(`role.${locked}`) })
                : crewBusy ? t("build.crewBusy") : affordable ? t("build.build") : t("build.cantAfford")}
            </button>
          )}
        </section>
      )}
    </>
  );
}
