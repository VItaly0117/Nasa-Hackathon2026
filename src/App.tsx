import { useState } from "react";
import { clearSave, loadGame, loadLang, saveLang } from "@/session/storage";
import { createOnlineSession } from "@/session/online";
import { SessionProvider } from "@/session/react";
import { createSoloSession } from "@/session/solo";
import type { GameSession } from "@/session/types";
import type { GameState } from "./types";
import { LANGS, setLang } from "@/i18n";
import type { Lang } from "@/i18n";
import { GameScreen } from "@/features/game/GameScreen";
import { Intro } from "@/features/story/Intro";
import { MainMenu } from "@/features/menu/MainMenu";
import { Prologue } from "@/features/story/Prologue";
import { RotateHint } from "@/ui/RotateHint";
import { SourcesPanel } from "@/features/menu/SourcesPanel";
import "./styles/tokens.css";
import "./styles/index.css";

type Stage = "menu" | "prologue" | "intro" | "game";

// Язык с прошлого раза. Если его нет или он неизвестен, остаётся язык по умолчанию из i18n
function restoreLang(): Lang | null {
  const saved = loadLang();
  const lang = LANGS.find((l) => l === saved) ?? null;
  if (lang) setLang(lang);
  return lang;
}

// Какие экраны и в каком порядке: меню, пролог, правила, игра. Саму игру ведёт сессия
export default function App() {
  const [stage, setStage] = useState<Stage>("menu");
  const [session, setSession] = useState<GameSession | null>(null);
  // Новый ключ пересоздаёт экран игры с чистым интерфейсом (баннеры, выбранный модуль), когда начинается новая игра
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

  function startSolo(resume: GameState | null, from: Stage) {
    setSession(createSoloSession(resume));
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
            startSolo(null, "prologue");
          }}
          onContinue={() => saved && startSolo(saved, "game")}
          onJoined={(room) => {
            setSession(createOnlineSession(room));
            setRunId((id) => id + 1);
            setStage("game");
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
      <Intro onStart={() => setStage("game")} />
      <RotateHint />
    </div>
  );
}
