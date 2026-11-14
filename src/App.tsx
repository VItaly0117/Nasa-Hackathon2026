import { useEffect, useReducer, useState } from "react";
import { reduce, initialState, dailyDelta, MISSION_DAYS, NIGHT_START } from "./engine/engine";
import { buildDebrief } from "./engine/debrief";
import { describeFlare } from "./engine/events";
import { canPlace, slotOf } from "./engine/placement";
import type { TileInfo } from "./engine/placement";
import modulesData from "./data/modules.json";
import eventsData from "./data/events.json";
import type { EventDef, ModuleDef, ModuleType, Resources } from "./types";
import { Sky } from "./ui/Sky";
import LunarMap from "./ui/map/LunarMap";
import { ResourceBar } from "./ui/ResourceBar";
import { CrewPanel } from "./ui/CrewPanel";
import { SidePanel } from "./ui/SidePanel";
import { BuildMenu } from "./ui/BuildMenu";
import { MoonLogo } from "./ui/icons";
import "./styles/tokens.css";
import "./App.css";

const MODULES = modulesData as ModuleDef[];
const EVENTS = eventsData as EventDef[];

function canAfford(resources: Resources, cost: Partial<Resources>) {
  return Object.entries(cost).every(
    ([key, value]) => resources[key as keyof Resources] >= (value ?? 0)
  );
}

function Game({ onRestart }: { onRestart: () => void }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  // Модуль, открытый в карточке справа
  const [selectedType, setSelectedType] = useState<ModuleType | null>("greenhouse");
  // Игрок выбирает место на карте: карта подсвечивает, куда можно поставить
  const [buildType, setBuildType] = useState<ModuleType | null>(null);

  const delta = dailyDelta(state);
  const event = EVENTS.find((e) => e.id === state.activeEvent) ?? null;
  const daysToNight = NIGHT_START - state.day;
  const isPlaying = state.status === "playing";

  // Esc отменяет постройку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuildType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSelectTile(tile: TileInfo) {
    if (!buildType || !canPlace(state, buildType, tile.row, tile.col)) return;
    dispatch({ type: "build", slot: slotOf(tile.row, tile.col), module: buildType });
    setBuildType(null);
  }

  return (
    <div className={`game ${state.isNight ? "game--night" : ""}`}>
      <Sky />

      <LunarMap
        modules={state.modules}
        defs={MODULES}
        isNight={state.isNight}
        buildType={buildType}
        canPlaceAt={(row, col) => buildType !== null && canPlace(state, buildType, row, col)}
        onSelectTile={handleSelectTile}
      />

      <header className="topbar">
        <div className="hud-panel base-badge">
          <MoonLogo />
          <div className="base-badge__text">
            <strong>Лунная база «Альфа-1»</strong>
            <span>
              День {state.day} из {MISSION_DAYS} ·{" "}
              {state.isNight
                ? "лунная ночь"
                : daysToNight > 0
                  ? `до ночи ${daysToNight} дн.`
                  : "лунный день"}
            </span>
          </div>
          <button
            className="btn btn--primary btn--next"
            onClick={() => dispatch({ type: "nextDay" })}
            disabled={!isPlaying || event !== null}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 3 L16 10 L5 17 Z" fill="currentColor" />
            </svg>
            Следующий день
          </button>
        </div>
        <ResourceBar resources={state.resources} delta={delta} />
      </header>

      <CrewPanel health={state.resources.health} />
      <SidePanel state={state} />

      <BuildMenu
        defs={MODULES}
        selected={selectedType}
        placing={buildType !== null}
        disabled={!isPlaying}
        isAffordable={(def) => canAfford(state.resources, def.cost)}
        onSelect={(type) => {
          setSelectedType(type);
          setBuildType(null);
        }}
        onStartBuild={() => setBuildType(selectedType)}
        onCancel={() => setBuildType(null)}
      />

      {event && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-labelledby="event-title">
            <h2 id="event-title">{event.title}</h2>
            <p>{event.text}</p>
            {event.id === "flare" && state.flare && (
              <p className="muted source">
                Настоящая вспышка: {describeFlare(state.flare)}. Источник:{" "}
                <a href={state.flare.link} target="_blank" rel="noreferrer">
                  {state.flare.source}
                </a>
              </p>
            )}
            <div className="modal__choices">
              {event.choices.map((choice) => (
                <button
                  key={choice.id}
                  className="btn btn--choice"
                  onClick={() => dispatch({ type: "resolveEvent", choice: choice.id })}
                >
                  <strong>{choice.label}</strong>
                  <span className="muted">{choice.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isPlaying && (
        <div className="overlay">
          <div className="modal">
            <h2>{state.status === "won" ? "Миссия выполнена!" : "Миссия провалена"}</h2>
            <p>Дней на Луне: {state.day}</p>
            <ul className="debrief">
              {buildDebrief(state).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="modal__choices">
              <button className="btn btn--primary" onClick={onRestart}>
                Сыграть ещё раз
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Новый ключ пересоздаёт Game с чистым состоянием, поэтому restart не нужен в движке
  const [runId, setRunId] = useState(0);
  return <Game key={runId} onRestart={() => setRunId((id) => id + 1)} />;
}
