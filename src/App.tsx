import { useEffect, useReducer, useRef, useState } from "react";
import { canPlace, capacityOf, dailyDelta, DAY_MS, hasFreeCrew, initialState, MISSION_DAYS, NIGHT_START, reduce, REPAIR_COST, slotOf } from "./engine";
import type { TileInfo } from "./engine";
import { clearSave, loadGame, loadLang, loadRecords, recordFrom, saveGame, saveLang, saveRecord } from "./session/storage";
import type { GameRecord } from "./session/storage";
import { openStream, sendAction } from "./net/online";
import type { Player, Session } from "./net/online";
import { MainMenu } from "./ui/MainMenu";
import { ResultsScreen } from "./ui/ResultsScreen";
import { SourcesPanel } from "./ui/SourcesPanel";
import { describeFlare } from "./i18n/messages";
import modulesData from "./data/modules.json";
import eventsData from "./data/events.json";
import type { Action, EventDef, GameState, ModuleDef, ModuleType, Resources } from "./types";
import { days, LANGS, setLang, t } from "./i18n";
import type { Lang } from "./i18n";
import LunarMap from "./ui/map/LunarMap";
import { ResourceBar } from "./ui/ResourceBar";
import { CrewPanel } from "./ui/CrewPanel";
import { SidePanel } from "./ui/SidePanel";
import { BuildMenu } from "./ui/BuildMenu";
import { Intro } from "./ui/Intro";
import { Prologue } from "./ui/Prologue";
import { DayClock } from "./ui/DayClock";
import { TaskToast } from "./ui/TaskToast";
import { Avatar } from "./ui/CrewPanel";
import { CREW } from "./ui/crewData";
import { BookIcon, MoonLogo, SoundOffIcon, SoundOnIcon } from "./ui/icons";
import { sound } from "./audio/audio";
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

function Game({ mode, onRestart, onMenu, onSources }: { mode: Mode; onRestart: () => void; onMenu: () => void; onSources: () => void }) {
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
  const [muted, setMuted] = useState(() => sound.isMuted());
  const isHost = !online || hostId === online.playerId;

  useEffect(() => sound.subscribe(setMuted), []);

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
  const [surveyingIce, setSurveyingIce] = useState(false);
  // Правила, открытые во время игры
  const [rulesOpen, setRulesOpen] = useState(false);

  const delta = dailyDelta(state);
  const event = EVENTS.find((e) => e.id === state.activeEvent) ?? null;
  const daysToNight = NIGHT_START - state.day;
  const isPlaying = state.status === "playing";

  // Одиночная миссия закончилась: записываем результат один раз и запоминаем, лучший ли он
  const [record, setRecord] = useState<{ best: GameRecord; isNew: boolean } | null>(null);
  const recorded = useRef(false);
  useEffect(() => {
    if (online || isPlaying || recorded.current) return;
    recorded.current = true;
    const mine = recordFrom(state);
    const hadBefore = loadRecords().length > 0;
    const better = saveRecord(mine);
    setRecord({ best: loadRecords()[0] ?? mine, isNew: better && hadBefore });
  }, [online, isPlaying, state]);
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
    if (state.day === NIGHT_START) {
      sound.playNightfall();
    } else {
      sound.playDayChange();
    }
    const timer = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(timer);
  }, [state.day, state.isNight]);

  // Новые задания от экипажа: карточка с портретом на несколько секунд
  const [toastIds, setToastIds] = useState<string[]>([]);
  useEffect(() => {
    const fresh = state.tasks.filter((x) => x.issuedDay === state.day && x.status === "open").map((x) => x.id);
    setToastIds(fresh);
    if (fresh.length === 0) return;
    sound.playTaskToast();
    const timer = window.setTimeout(() => setToastIds([]), 9000);
    return () => window.clearTimeout(timer);
  }, [state.tasks, state.day]);

  // Звуковое оповещение о завершении стройки
  const prevBuildingCount = useRef(state.modules.filter((m) => m.build).length);
  useEffect(() => {
    const currentBuildingCount = state.modules.filter((m) => m.build).length;
    if (prevBuildingCount.current > currentBuildingCount) {
      sound.playBuildComplete();
    }
    prevBuildingCount.current = currentBuildingCount;
  }, [state.modules]);

  // Сирена при наступлении опасных событий (вспышка, поломка, болезнь)
  const prevEvent = useRef<string | null>(null);
  useEffect(() => {
    if (state.activeEvent && state.activeEvent !== prevEvent.current) {
      sound.playAlarm(state.activeEvent as "flare" | "breakdown" | "illness");
    }
    prevEvent.current = state.activeEvent;
  }, [state.activeEvent]);

  // Окончание миссии (победа или поражение)
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (prevStatus.current === "playing" && state.status !== "playing") {
      sound.stopAmbient();
      if (state.status === "won") sound.playVictory();
      else if (state.status === "lost") sound.playDefeat();
    }
    prevStatus.current = state.status;
  }, [state.status]);

  // Фоновый космический эмбиент станции
  useEffect(() => {
    sound.setNightMode(state.isNight);
  }, [state.isNight]);

  useEffect(() => {
    if (isPlaying) {
      sound.startAmbient();
    } else if (!isPlaying) {
      sound.stopAmbient();
    }
    return () => sound.stopAmbient();
  }, [isPlaying]);

  // Esc отменяет постройку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuildType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSelectTile(tile: TileInfo) {
    if (surveyingIce) {
      dispatch({ type: "research", id: "iceScout", answer: tile.terrain === "ice" ? "ice" : "rock" });
      setSurveyingIce(false);
      return;
    }
    if (!buildType || !hasFreeCrew(state) || !canPlace(state, buildType, tile.row, tile.col)) return;
    sound.playBuildStart();
    dispatch({ type: "build", slot: slotOf(tile.row, tile.col), module: buildType });
    setBuildType(null);
  }

  return (
    <div className={`game ${state.isNight ? "game--night" : ""}`}>
      <LunarMap
        modules={state.modules}
        defs={MODULES}
        isNight={state.isNight}
        buildType={buildType}
        surveyingIce={surveyingIce}
        crewActive={isPlaying && event === null}
        canPlaceAt={(row, col) => buildType !== null && canPlace(state, buildType, row, col)}
        canAffordRepair={canAfford(state.resources, REPAIR_COST)}
        onRepairModule={(slot) => {
          sound.playRepair();
          dispatch({ type: "repair", slot });
        }}
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
            <button
              type="button"
              className="btn btn--ghost btn--small btn--icon"
              onClick={() => sound.toggleMute()}
              aria-label={muted ? t("app.soundOff") : t("app.soundOn")}
              title={muted ? t("app.soundOff") : t("app.soundOn")}
            >
              {muted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
            </button>
            <button className="btn btn--ghost btn--small btn--help" onClick={() => { sound.playClick(); setRulesOpen(true); }}>
              <BookIcon size={18} />
              <span>{t("app.rules")}</span>
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => { sound.playClick(); toMenu(); }}>
              {t("app.menu")}
            </button>
          </DayClock>
        </div>
        <ResourceBar resources={state.resources} delta={delta} capacity={capacityOf(state.modules)} />
      </header>

      <CrewPanel health={state.resources.health} crew={state.crew} />
      <SidePanel
        state={state}
        surveyingIce={surveyingIce}
        onCancelIceSurvey={() => setSurveyingIce(false)}
        onStartIceSurvey={() => { setBuildType(null); setSurveyingIce(true); }}
        onResearch={(answer) => dispatch({ type: "research", id: "moonDust", answer })}
      />

      <BuildMenu
        defs={MODULES}
        selected={selectedType}
        placing={buildType !== null}
        disabled={!isPlaying}
        crewBusy={!hasFreeCrew(state)}
        isAffordable={(def) => canAfford(state.resources, def.cost)}
        lockedBy={lockedBy}
        onSelect={(type) => {
          sound.playClick();
          setSelectedType(type);
          setBuildType(null);
        }}
        onStartBuild={() => {
          sound.playClick();
          setBuildType(selectedType);
        }}
        onCancel={() => {
          sound.playClick();
          setBuildType(null);
        }}
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
                  onClick={() => {
                    sound.playDecisionConfirm();
                    dispatch({ type: "resolveEvent", choice: choice.id });
                  }}
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
        <ResultsScreen
          state={state}
          online={!!online}
          record={record}
          onRestart={() => {
            sound.playClick();
            onRestart();
          }}
          onMenu={() => {
            sound.playClick();
            toMenu();
          }}
          onSources={() => {
            sound.playClick();
            onSources();
          }}
        />
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

export default function App() {
  const [stage, setStage] = useState<Stage>("menu");
  const [mode, setMode] = useState<Mode>({ kind: "solo", resume: null });
  // Новый ключ пересоздаёт Game с чистым состоянием, поэтому restart не нужен в движке
  const [runId, setRunId] = useState(0);
  // Экран «Данные NASA» открывается из меню и из итогов
  const [sourcesOpen, setSourcesOpen] = useState(false);
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
        <div className="backdrop" aria-hidden="true" />
        <MainMenu
          savedDay={saved?.day ?? null}
          onLang={pickLang}
          onNewGame={() => {
            clearSave();
            start({ kind: "solo", resume: null }, "prologue");
          }}
          onContinue={() => saved && start({ kind: "solo", resume: saved }, "game")}
          onJoined={(session) => start({ kind: "online", session }, "game")}
          onSources={() => setSourcesOpen(true)}
        />
        {sourcesOpen && <SourcesPanel onClose={() => setSourcesOpen(false)} />}
        <RotateHint />
      </div>
    );
  }

  if (stage === "game") {
    return (
      <>
        <Game
          key={runId}
          mode={mode}
          onRestart={() => {
            clearSave();
            start({ kind: "solo", resume: null }, "game");
          }}
          onMenu={() => setStage("menu")}
          onSources={() => setSourcesOpen(true)}
        />
        {sourcesOpen && <SourcesPanel onClose={() => setSourcesOpen(false)} />}
      </>
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
  return (
    <div className="game">
      <div className="backdrop" aria-hidden="true" />
      <Intro onStart={() => setStage("game")} />
      <RotateHint />
    </div>
  );
}
