import { useEffect, useReducer, useRef, useState } from "react";
import { useEffect, useReducer, useState } from "react";
import { reduce, initialState, dailyDelta, capacityOf, hasFreeCrew, DAY_MS, MISSION_DAYS, NIGHT_START } from "./engine/engine";
import { buildDebrief } from "./engine/debrief";
import { clearSave, loadGame, loadLang, saveGame, saveLang } from "./engine/storage";
import { openStream, sendAction } from "./net/online";
import type { Player, Session } from "./net/online";
import { MainMenu } from "./ui/MainMenu";
import { describeFlare } from "./engine/events";
import { canPlace, slotOf } from "./engine/placement";
import type { TileInfo } from "./engine/placement";
import modulesData from "./data/modules.json";
import eventsData from "./data/events.json";
import type { Action, EventDef, GameState, ModuleDef, ModuleType, Resources } from "./types";
import { days, LANGS, setLang, t } from "./i18n";
import type { Lang } from "./i18n";
import { Sky } from "./ui/Sky";
import LunarMap from "./ui/map/LunarMap";
import { ResourceBar } from "./ui/ResourceBar";
import { CrewPanel } from "./ui/CrewPanel";
import { SidePanel } from "./ui/SidePanel";
import { BuildMenu } from "./ui/BuildMenu";
import { Intro } from "./ui/Intro";
import { Prologue, Rocket } from "./ui/Prologue";
import { DayClock } from "./ui/DayClock";
import { TaskToast } from "./ui/TaskToast";
import { Avatar } from "./ui/CrewPanel";
import { CREW } from "./ui/crewData";
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

// Одиночная игра (новая или продолженная из сохранения) или совместная на сервере
type Mode = { kind: "solo"; resume: GameState | null } | { kind: "online"; session: Session };

// Время дня ведущий отправляет на сервер пачками, а не 10 раз в секунду
const ONLINE_TICK_MS = 500;
// Одиночную игру сохраняем не чаще, чем раз в столько мс: время идёт непрерывно
const SAVE_EVERY_MS = 2000;

function Game({ mode, onRestart, onMenu }: { mode: Mode; onRestart: () => void; onMenu: () => void }) {
  const online = mode.kind === "online" ? mode.session : null;
  // Совместная игра: та же игра получается из seed комнаты и всех действий, что уже случились до входа
  const [state, apply] = useReducer(reduce, undefined, () =>
    online
      ? online.actions.reduce(reduce, initialState(online.seed))
      : (mode.kind === "solo" && mode.resume) || initialState()
  );
  // В одиночной игре действие применяется сразу. В совместной уходит на сервер и применяется,
  // когда сервер разошлёт его всем: так у всех игроков один и тот же порядок действий
  const dispatch = (action: Action) => (online ? void sendAction(online, action) : apply(action));

  const [players, setPlayers] = useState<Player[]>(online?.players ?? []);
  const [hostId, setHostId] = useState<string | null>(online?.hostId ?? null);
  const [connected, setConnected] = useState(true);
  const isHost = !online || hostId === online.playerId;
  useEffect(() => {
    if (!online) return;
    return openStream(online, online.actions.length, {
      onAction: apply,
      onPlayers: (list, host) => {
        setPlayers(list);
        setHostId(host);
      },
      onConnection: setConnected,
    });
  }, [online]);

  const tickAcc = useRef(0);
  function handleTick(ms: number) {
    if (!online) return apply({ type: "tick", ms });
    tickAcc.current += ms;
    if (tickAcc.current < ONLINE_TICK_MS) return;
    void sendAction(online, { type: "tick", ms: tickAcc.current });
    tickAcc.current = 0;
  }

  // Модуль строит игрок с ролью из modules.json. Пока такой роли ни у кого нет, строить может любой
  const lockedBy = online
    ? (def: ModuleDef) =>
        def.builder && def.builder !== online.role && players.some((p) => p.role === def.builder) ? def.builder : null
    : undefined;

  // Сохранение одиночной игры: «Продолжить игру» в меню начнёт с этого места
  const latest = useRef(state);
  const lastSave = useRef(0);
  useEffect(() => {
    latest.current = state;
    if (online) return;
    if (state.status !== "playing") {
      clearSave();
      return;
    }
    const now = Date.now();
    if (now - lastSave.current >= SAVE_EVERY_MS) {
      saveGame(state);
      lastSave.current = now;
    }
  }, [state, online]);
  useEffect(() => {
    if (online) return;
    const flush = () => {
      if (latest.current.status === "playing") saveGame(latest.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [online]);
  // Сохраняем до перехода: меню сразу читает сохранение, чтобы показать «Продолжить игру»
  function toMenu() {
    if (!online && latest.current.status === "playing") saveGame(latest.current);
    onMenu();
  }
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
  // Время дня идёт, только пока игрок ничем не занят: ни события, ни правил, ни выбора места.
  // В совместной игре время общее: его двигает только ведущий и останавливает только событие
  const clockRunning = online
    ? isHost && connected && isPlaying && event === null
    : isPlaying && event === null && !rulesOpen && buildType === null;

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
            {online && (
              <span className="online-badge">
                {t("online.badge", { room: online.room, role: t(`role.${online.role}`) })} ·{" "}
                {t("online.players", { n: players.length })}
              </span>
            )}
          </div>
          <DayClock running={clockRunning} progress={state.clockMs / DAY_MS} onTick={handleTick}>
          <DayClock
            running={clockRunning}
            progress={state.clockMs / DAY_MS}
            onTick={(ms) => dispatch({ type: "tick", ms })}
          >
            <button className="btn btn--ghost btn--small" onClick={() => setRulesOpen(true)}>
              ? {t("app.rules")}
            </button>
            <button className="btn btn--ghost btn--small" onClick={toMenu}>
              {t("app.menu")}
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
        lockedBy={lockedBy}
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
            {event.id === "illness" && state.illness && (() => {
              // Кто заболел: портрет и имя, как при просьбе о задании
              const person = CREW.find((c) => c.id === state.illness!.crewId)!;
              return (
                <div className="modal__portrait">
                  <Avatar skin={person.skin} hair={person.hair} long={person.long} mood={-1} />
                </div>
              );
            })()}
            <h2 id="event-title">{t(`ev.${event.id}.title`)}</h2>
            <p>{t(`ev.${event.id}.text`, { name: state.illness ? t(`crew.n${state.illness.crewId}`) : "" })}</p>
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
          <div className={`modal ending ending--${state.status}`}>
            {state.status === "won" && <Rocket className="ending__rocket" flame />}
            <h2>{state.status === "won" ? t("app.win") : t("app.lose")}</h2>
            <p>{state.status === "won" ? t("app.winText") : t("app.loseText")}</p>
            <p className="muted">{t("app.daysOnMoon", { n: state.day })}</p>
            <ul className="debrief">
              {buildDebrief(state).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="modal__choices">
              {!online && (
                <button className="btn btn--primary" onClick={onRestart}>
                  {t("app.playAgain")}
                </button>
              )}
              <button className={`btn ${online ? "btn--primary" : "btn--ghost"}`} onClick={toMenu}>
                {t("app.toMenu")}
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
      {online && !connected && <div className="online-lost" role="alert">{t("online.lost")}</div>}
      <RotateHint />
    </div>
  );
}

type Stage = "menu" | "prologue" | "intro" | "game";

// Язык с прошлого раза. Если его нет или он неизвестен, остаётся язык по умолчанию из i18n
function restoreLang(): Lang | null {
  const saved = loadLang();
  const lang = LANGS.find((l) => l === saved) ?? null;
  if (lang) setLang(lang);
  return lang;
}
type Stage = "lang" | "prologue" | "intro" | "game";

export default function App() {
  const [stage, setStage] = useState<Stage>("menu");
  const [mode, setMode] = useState<Mode>({ kind: "solo", resume: null });
  // Новый ключ пересоздаёт Game с чистым состоянием, поэтому restart не нужен в движке
  const [runId, setRunId] = useState(0);
  // Нужен только чтобы перерисовать дерево после смены языка: сам язык хранится в i18n
  const [, setLangState] = useState<Lang | null>(restoreLang);
  // Сохранение читаем при каждом показе меню: игрок мог только что выйти из игры
  const saved = stage === "menu" ? loadGame() : null;

  function pickLang(lang: Lang) {
    setLang(lang);
    saveLang(lang);
    setLangState(lang);
  }

  function start(next: Mode, from: Stage) {
    setMode(next);
    setRunId((id) => id + 1);
    setStage(from);
  }

  if (stage === "menu") {
    return (
      <div className="game">
        <Sky />
        <MainMenu
          savedDay={saved?.day ?? null}
          onLang={pickLang}
          onNewGame={() => {
            clearSave();
            start({ kind: "solo", resume: null }, "prologue");
          }}
          onContinue={() => saved && start({ kind: "solo", resume: saved }, "game")}
          onJoined={(session) => start({ kind: "online", session }, "game")}
        />
        <RotateHint />
      </div>
    );
    setStage("prologue");
  }

  if (stage === "game") {
    return (
      <Game
        key={runId}
        mode={mode}
        onRestart={() => {
          clearSave();
          start({ kind: "solo", resume: null }, "game");
        }}
        onMenu={() => setStage("menu")}
      />
    );
  }

  // Пролог — на весь экран со своим небом, остальное — поверх общего неба
  if (stage === "prologue") {
    return (
      <div className="game">
        <Prologue onDone={() => setStage("intro")} />
        <RotateHint />
      </div>
    );
  }

  // До начала новой игры показываем небо, а поверх него — правила
  // До начала игры показываем небо, а поверх него — выбор языка и правила
  return (
    <div className="game">
      <Sky />
      <Intro onStart={() => setStage("game")} />
      <RotateHint />
    </div>
  );
}
