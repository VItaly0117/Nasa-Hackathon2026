import { useEffect, useRef, useState } from "react";
import { sound } from "@/audio/audio";
import { clearSave, loadGame, loadLang, saveLang } from "@/session/storage";
import { createOnlineSession } from "@/session/online";
import { SessionProvider } from "@/session/react";
import { createSoloSession } from "@/session/solo";
import type { GameSession } from "@/session/types";
import type { GameMode, GameState } from "./types";
import { LANGS, setLang } from "@/i18n";
import type { Lang } from "@/i18n";
import { GameScreen } from "@/features/game/GameScreen";
import { Intro } from "@/features/story/Intro";
import { MainMenu } from "@/features/menu/MainMenu";
import { Prologue } from "@/features/story/Prologue";
import { RotateHint } from "@/ui/RotateHint";
import { Loader } from "@/ui/Loader";
import { preloadGame } from "@/ui/preload";
import { SourcesPanel } from "@/features/menu/SourcesPanel";
import "./styles/tokens.css";
import "./styles/index.css";

type Stage = "menu" | "prologue" | "intro" | "game";

const LEAVE_MS = 600; // сколько длится «отлёт» меню
const MIN_LOAD_MS = 900; // загрузка не мигает, даже если всё уже в кэше
const FADE_MS = 500; // плавное скрытие экрана загрузки

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Язык с прошлого раза. Если его нет или он неизвестен, остаётся язык по умолчанию из i18n
function restoreLang(): Lang | null {
  const saved = loadLang();
  const lang = LANGS.find((l) => l === saved) ?? null;
  if (lang) setLang(lang);
  return lang;
}

// Какие экраны и в каком порядке: меню, пролог, правила, игра. Саму игру ведёт сессия
export default function App() {
  const [leaving, setLeaving] = useState(false);
  const [loader, setLoader] = useState<{ progress: number; out: boolean } | null>(null);
  const busy = useRef(false);

  // Переход с анимацией: меню отлетает (если нужно), идёт загрузка, затем действие и плавное появление экрана
  async function transition(action: () => void, withLeave: boolean) {
    if (busy.current) return;
    busy.current = true;
    if (withLeave) {
      setLeaving(true);
      await wait(LEAVE_MS);
    }
    setLoader({ progress: 0, out: false });
    await Promise.all([preloadGame((progress) => setLoader({ progress, out: false })), wait(MIN_LOAD_MS)]);
    setLoader({ progress: 1, out: false });
    action();
    setLeaving(false);
    await wait(80);
    setLoader({ progress: 1, out: true });
    await wait(FADE_MS);
    setLoader(null);
    busy.current = false;
  }

  useEffect(() => {
    sound.startSpaceDrone();
  }, []);

  const [stage, setStage] = useState<Stage>("menu");
  const [session, setSession] = useState<GameSession | null>(null);
  // Новый ключ пересоздаёт экран игры с чистым интерфейсом (баннеры, выбранный модуль), когда начинается новая игра
  const [runId, setRunId] = useState(0);
  // Режим сложности текущей одиночной игры: «Заново» начинает в том же режиме
  const [difficulty, setDifficulty] = useState<GameMode>("normal");
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

  function startSolo(resume: GameState | null, from: Stage, mode: GameMode = difficulty) {
    setDifficulty(mode);
    setSession(createSoloSession(resume, mode));
    setRunId((id) => id + 1);
    setStage(from);
  }

  const screen = renderScreen();
  return (
    <>
      {screen}
      {loader && <Loader progress={loader.progress} leaving={loader.out} />}
    </>
  );

  function renderScreen() {
  if (stage === "menu") {
    return (
      <div className="game">
        <div className="backdrop" aria-hidden="true" />
        <MainMenu
          savedDay={saved?.day ?? null}
          onLang={pickLang}
          leaving={leaving}
          onNewGame={(mode) => {
            void transition(() => {
              clearSave();
              startSolo(null, "prologue", mode);
            }, true);
          }}
          onContinue={() => {
            if (saved) void transition(() => startSolo(saved, "game", saved.mode ?? "normal"), true);
          }}
          onJoined={(room) => {
            void transition(() => {
              setSession(createOnlineSession(room));
              setRunId((id) => id + 1);
              setStage("game");
            }, false);
          }}
          onSources={() => setSourcesOpen(true)}
        />
        {sourcesOpen && <SourcesPanel onClose={() => setSourcesOpen(false)} />}
        <RotateHint />
      </div>
    );
  }

  if (stage === "game" && session) {
    return (
      <SessionProvider key={runId} session={session}>
        <GameScreen
          onRestart={() => {
            clearSave();
            startSolo(null, "game");
          }}
          onMenu={() => setStage("menu")}
          onSources={() => setSourcesOpen(true)}
        />
        {sourcesOpen && <SourcesPanel onClose={() => setSourcesOpen(false)} />}
      </SessionProvider>
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
      <Intro onStart={() => void transition(() => setStage("game"), false)} />
      <RotateHint />
    </div>
  );
  }
}
