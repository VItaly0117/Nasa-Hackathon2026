import type { ModuleDef, ModuleType, Resources, ResourceKey } from "../types";
import { ModulePreview } from "./map/art";
import { ResourceIcon } from "./icons";
import "./BuildMenu.css";

type Props = {
  defs: ModuleDef[];
  selected: ModuleType | null;   // какой модуль открыт в карточке справа
  placing: boolean;              // игрок сейчас выбирает место на карте
  disabled: boolean;
  isAffordable: (def: ModuleDef) => boolean;
  onSelect: (type: ModuleType) => void;
  onStartBuild: () => void;
  onCancel: () => void;
};

const SHORT: Record<ResourceKey, string> = {
  oxygen: "O₂",
  water: "воды",
  food: "еды",
  energy: "кВт",
  health: "здор.",
  materials: "мат.",
};

function Cost({ cost }: { cost: Partial<Resources> }) {
  const parts = Object.entries(cost).filter(([, value]) => value);
  if (parts.length === 0) return <span className="cost">бесплатно</span>;
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
      text: `${value! > 0 ? "+" : "−"}${Math.abs(value!)} ${SHORT[key as ResourceKey]} в день`,
    }));
}

export function BuildMenu({
  defs,
  selected,
  placing,
  disabled,
  isAffordable,
  onSelect,
  onStartBuild,
  onCancel,
}: Props) {
  const def = defs.find((d) => d.type === selected) ?? null;
  const lines = def ? perDayLines(def.perDay) : [];
  const affordable = def ? isAffordable(def) : false;

  return (
    <>
      <section className="hud-panel build" aria-label="Строительство">
        <div className="build__tabs">
          <span className="build__tab">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M3 17 L11 9 M9 3 l8 8 l-3 3 l-8 -8 Z" stroke="#3b2a00" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            </svg>
            Строительство
          </span>
          <span className="build__hint">
            {placing ? "Выбери зелёную клетку на карте" : "Выбери модуль"}
          </span>
        </div>
        <ul className="build__list">
          {defs.map((d) => (
            <li key={d.type}>
              <button
                className={`card ${selected === d.type ? "card--selected" : ""}`}
                onClick={() => onSelect(d.type)}
                disabled={disabled}
                aria-pressed={selected === d.type}
              >
                <span className="card__name">{d.name}</span>
                <ModulePreview type={d.type} size={78} />
                <Cost cost={d.cost} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {def && (
        <section className="hud-panel detail" aria-label={`Модуль ${def.name}`}>
          <div className="detail__top">
            <div className="detail__preview"><ModulePreview type={def.type} size={110} /></div>
            <div className="detail__info">
              <h2 className="hud-title">{def.name}</h2>
              {def.description && <p>{def.description}</p>}
              <ul className="detail__lines">
                {lines.map((l) => (
                  <li key={l.key} className={l.plus ? "plus" : "minus"}>
                    <ResourceIcon type={l.key} size={16} /> {l.text}
                  </li>
                ))}
                {def.nightPerDay && <li className="detail__night">Ночью работает иначе</li>}
              </ul>
            </div>
          </div>
          <div className="detail__cost">
            <span>Стоимость:</span>
            <Cost cost={def.cost} />
          </div>
          {placing ? (
            <button className="btn btn--ghost" onClick={onCancel}>
              Отменить постройку
            </button>
          ) : (
            <button className="btn btn--primary" onClick={onStartBuild} disabled={disabled || !affordable}>
              {affordable ? "Построить" : "Не хватает ресурсов"}
            </button>
          )}
        </section>
      )}
    </>
  );
}
