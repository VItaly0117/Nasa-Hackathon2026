import { useEffect, useReducer, useState } from "react";
import { reduce, initialState, dailyDelta, capacityOf, hasFreeCrew, DAY_MS, MISSION_DAYS, NIGHT_START } from "./engine/engine";
import { buildDebrief } from "./engine/debrief";
import { describeFlare } from "./engine/events";
import { canPlace, slotOf } from "./engine/placement";
import type { TileInfo } from "./engine/placement";
import modulesData from "./data/modules.json";
import eventsData from "./data/events.json";
import type { EventDef, ModuleDef, ModuleType, Resources } from "./types";
import { days, setLang, t } from "./i18n";
import type { Lang } from "./i18n";
import { Sky } from "./ui/Sky";
import LunarMap from "./ui/map/LunarMap";
import { ResourceBar } from "./ui/ResourceBar";
import { CrewPanel } from "./ui/CrewPanel";
import { SidePanel } from "./ui/SidePanel";
import { BuildMenu } from "./ui/BuildMenu";
import { LangSelect } from "./ui/LangSelect";
import { Intro } from "./ui/Intro";
import { DayClock } from "./ui/DayClock";
import { TaskToast } from "./ui/TaskToast";
import { MoonLogo } from "./ui/icons";
import "./styles/tokens.css";
import "./App.css";

// Тексты событий лежат в словарях i18n: ev.<id>.title / .text / .<choice>.label / .<choice>.hint
// Цены выборов лежат в events.json (тип EventDef в types.ts)

const MODULES = modulesData as ModuleDef[];
const EVENTS = eventsData as EventDef[];

function canAfford(resources: Resources, cost: Partial<Resources>) {
  return Object.entries(cost).every(
    ([key, value]) => resources[key as keyof Resources] >= (value ?? 0)
  );
}

// На телефоне в вертикальном положении CSS показывает эту подсказку поверх игры
function RotateHint() {
  return (
    <div className="rotate-hint" role="alert">
      <svg viewBox="0 0 48 48" width="72" height="72" aria-hidden="true">
        <rect x="14" y="4" width="20" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="24" cy="38" r="2" fill="currentColor" />
      </svg>
      {t("app.rotate")}
    </div>
  );
}

function Game({ onRestart }: { onRestart: () => void }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  // Модуль, открытый в карточке справа
  const [selectedType, setSelectedType] = useState<ModuleType | null>("greenhouse");
  // Игрок выбирает место на карте: карта подсвечивает, куда можно поставить
  const [buildType, setBuildType] = useState<ModuleType | null>(null);
  // Правила, открытые во время игры
  const [rulesOpen, setRulesOpen] = useState(false);

  const delta = dailyDelta(state);
  const event = EVENTS.find((e) => e.id === state.activeEvent) ?? null;
  const daysToNight = NIGHT_START - state.day;
  const isPlaying = state.status === "playing";
  // Время дня идёт, только пока игрок ничем не занят: ни события, ни правил, ни выбора места
  const clockRunning = isPlaying && event === null && !rulesOpen && buildType === null;

  // Баннер «День N» на несколько секунд при смене дня
  const [banner, setBanner] = useState<{ day: number; night: boolean } | null>(null);
  useEffect(() => {
    if (state.day === 1) return;
    setBanner({ day: state.day, night: state.isNight });
    const timer = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(timer);
  }, [state.day, state.isNight]);

  // Новые задания от экипажа: карточка с портретом на несколько секунд
  const [toastIds, setToastIds] = useState<string[]>([]);
  useEffect(() => {
    const fresh = state.tasks.filter((x) => x.issuedDay === state.day && x.status === "open").map((x) => x.id);
    setToastIds(fresh);
    if (fresh.length === 0) return;
    const timer = window.setTimeout(() => setToastIds([]), 9000);
    return () => window.clearTimeout(timer);
  }, [state.tasks, state.day]);

  // Esc отменяет постройку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuildType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSelectTile(tile: TileInfo) {
    if (!buildType || !hasFreeCrew(state) || !canPlace(state, buildType, tile.row, tile.col)) return;
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
        crewActive={isPlaying && event === null}
        canPlaceAt={(row, col) => buildType !== null && canPlace(state, buildType, row, col)}
        onSelectTile={handleSelectTile}
      />

      <header className="topbar">
        <div className="hud-panel base-badge">
          <MoonLogo />
          <div className="base-badge__text">
            <strong>{t("app.base")}</strong>
            <span>
              {t("app.dayOf", { day: state.day, total: MISSION_DAYS })} ·{" "}
              {state.isNight
                ? t("app.night")
                : daysToNight > 0
                  ? t("app.toNight", { days: days(daysToNight) })
                  : t("app.lunarDay")}
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
            {t("app.nextDay")}
          </button>
          <DayClock
            running={clockRunning}
            progress={state.clockMs / DAY_MS}
            onTick={(ms) => dispatch({ type: "tick", ms })}
          >
            <button className="btn btn--ghost btn--small" onClick={() => setRulesOpen(true)}>
              ? {t("app.rules")}
            </button>
          </DayClock>
        </div>
        <ResourceBar resources={state.resources} delta={delta} capacity={capacityOf(state.modules)} />
      </header>

      <CrewPanel health={state.resources.health} crew={state.crew} />
      <SidePanel state={state} />

      <BuildMenu
        defs={MODULES}
        selected={selectedType}
        placing={buildType !== null}
        disabled={!isPlaying}
        crewBusy={!hasFreeCrew(state)}
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
            <h2 id="event-title">{t(`ev.${event.id}.title`)}</h2>
            <p>{t(`ev.${event.id}.text`)}</p>
            {event.id === "flare" && state.flare && (
              <p className="muted source">
                {t("ev.flare.source", { flare: describeFlare(state.flare) })}{" "}
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
                  <strong>{t(`ev.${event.id}.${choice.id}.label`)}</strong>
                  <span className="muted">{t(`ev.${event.id}.${choice.id}.hint`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isPlaying && (
        <div className="overlay">
          <div className="modal">
            <h2>{state.status === "won" ? t("app.win") : t("app.lose")}</h2>
            <p>{t("app.daysOnMoon", { n: state.day })}</p>
            <ul className="debrief">
              {buildDebrief(state).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="modal__choices">
              <button className="btn btn--primary" onClick={onRestart}>
                {t("app.playAgain")}
              </button>
            </div>
          </div>
        </div>
      )}

      {banner && isPlaying && !event && (
        <div key={banner.day} className={`day-banner ${banner.night ? "day-banner--night" : ""}`} aria-live="polite">
          {t("app.dayOf", { day: banner.day, total: MISSION_DAYS })}
          {banner.night ? ` · ${t("app.night")}` : ""}
        </div>
      )}

      <TaskToast tasks={state.tasks.filter((x) => toastIds.includes(x.id))} onClose={() => setToastIds([])} />

      {rulesOpen && <Intro rulesOnly onStart={() => setRulesOpen(false)} />}
      <RotateHint />
    </div>
  );
}

type Stage = "lang" | "intro" | "game";

export default function App() {
  const [stage, setStage] = useState<Stage>("lang");
  // Новый ключ пересоздаёт Game с чистым состоянием, поэтому restart не нужен в движке
  const [runId, setRunId] = useState(0);
  // Нужен только чтобы перерисовать дерево после смены языка: сам язык хранится в i18n
  const [, setLangState] = useState<Lang | null>(null);

  function pickLang(lang: Lang) {
    setLang(lang);
    setLangState(lang);
    setStage("intro");
  }

  if (stage === "game") {
    return <Game key={runId} onRestart={() => setRunId((id) => id + 1)} />;
  }

  // До начала игры показываем небо, а поверх него — выбор языка и вступление
  return (
    <div className="game">
      <Sky />
      {stage === "lang" ? <LangSelect onPick={pickLang} /> : <Intro onStart={() => setStage("game")} />}
      {stage !== "lang" && <RotateHint />}
    </div>
  );
}
