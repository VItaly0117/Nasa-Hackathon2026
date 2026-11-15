import { useEffect, useState } from "react";
import { getLang, langName, t } from "@/i18n";
import type { Lang } from "@/i18n";
import { joinRoom, ROOM_NAME, SERVER_AVAILABLE } from "@/net/online";
import type { Session } from "@/net/online";
import { LangSelect } from "./LangSelect";
import { MoonLogo, SoundOffIcon, SoundOnIcon } from "@/ui/icons";
import { sound } from "@/audio/audio";
import "@/features/story/Intro.css";
import { MODE_IDS } from "@/engine";
import type { GameMode } from "@/types";
import "./MainMenu.css";

type Props = {
  savedDay: number | null; // день сохранённой миссии или null, если продолжать нечего
  onLang: (lang: Lang) => void;
  onNewGame: (mode: GameMode) => void;
  onContinue: () => void;
  onJoined: (session: Session) => void;
  onSources: () => void; // открыть экран «Данные NASA»
};

// Начальный экран: название игры и кнопки. Выбор языка и вход на сервер открываются здесь же
export function MainMenu({ savedDay, onLang, onNewGame, onContinue, onJoined, onSources }: Props) {
  const [view, setView] = useState<"main" | "lang" | "server" | "modes">("main");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(() => sound.isMuted());

  useEffect(() => sound.subscribe(setMuted), []);

  if (view === "lang") {
    return (
      <LangSelect
        onPick={(lang) => {
          sound.playClick();
          onLang(lang);
          setView("main");
        }}
      />
    );
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!ROOM_NAME.test(room)) {
      setError(t("server.badName"));
      return;
    }
    setJoining(true);
    setError(null);
    try {
      onJoined(await joinRoom(room));
    } catch {
      setError(t("server.unavailable"));
      setJoining(false);
    }
  }

  if (view === "server" && !SERVER_AVAILABLE) {
    return (
      <div className="overlay">
        <div className="modal intro menu" role="dialog" aria-labelledby="server-title">
          <h2 id="server-title">{t("server.title")}</h2>
          <p className="menu__hint">{t("server.staticOnly")}</p>
          <div className="intro__actions">
            <button type="button" className="btn btn--primary" onClick={() => setView("main")}>
              {t("server.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "server") {
    return (
      <div className="overlay">
        <form className="modal intro menu" aria-labelledby="server-title" onSubmit={join}>
          <h2 id="server-title">{t("server.title")}</h2>
          <p className="menu__hint">{t("server.hint")}</p>
          <label className="menu__label" htmlFor="server-name">{t("server.label")}</label>
          <input
            id="server-name"
            className="menu__input"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value.trim());
              setError(null);
            }}
            placeholder={t("server.placeholder")}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            aria-invalid={error !== null}
            aria-describedby={error ? "server-error" : undefined}
          />
          {error && <p id="server-error" className="menu__error" role="alert">{error}</p>}
          <div className="intro__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setView("main")}>
              {t("server.back")}
            </button>
            <button type="submit" className="btn btn--primary" disabled={joining || room === ""}>
              {joining ? t("server.joining") : t("server.join")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === "modes") {
    return (
      <div className="overlay">
        <div className="modal intro menu" role="dialog" aria-labelledby="modes-title">
          <h2 id="modes-title">{t("menu.modeTitle")}</h2>
          <div className="menu__buttons">
            {MODE_IDS.map((id) => (
              <button
                key={id}
                className="btn btn--primary menu__btn"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                onClick={() => { sound.playClick(); onNewGame(id); }}
              >
                <strong>{t(`mode.${id}.name`)}</strong>
                <span style={{ fontSize: "0.8em", fontWeight: 600, opacity: 0.8 }}>{t(`mode.${id}.desc`)}</span>
              </button>
            ))}
            <button className="btn btn--ghost menu__btn" onClick={() => setView("main")}>
              {t("menu.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mm">
      <div className="mm__box" role="dialog" aria-labelledby="menu-title">
        <MoonLogo size={96} />
        <h1 id="menu-title" className="mm__title">{t("app.title")}</h1>
        <p className="mm__tagline">{t("menu.tagline")}</p>

        <div className="mm__row">
          <button className="mm__pill" onClick={() => { sound.playClick(); setView("lang"); }}>
            <GlobeIcon />
            <span>{t("menu.language", { lang: langName(getLang()) })}</span>
            <ChevronIcon />
          </button>
          <button
            type="button"
            className="mm__pill"
            onClick={() => sound.toggleMute()}
            title={muted ? t("app.soundOff") : t("app.soundOn")}
          >
            {muted ? <SoundOffIcon size={20} /> : <SoundOnIcon size={20} />}
            <span>{muted ? t("menu.soundIsOff") : t("menu.soundIsOn")}</span>
          </button>
        </div>

        <button className="mm__btn mm__btn--new" onClick={() => { sound.playClick(); setView("modes"); }}>
          {t("menu.newGame")}
        </button>
        <button
          className="mm__btn mm__btn--olive"
          onClick={() => { sound.playClick(); onContinue(); }}
          disabled={savedDay === null}
        >
          {savedDay === null ? t("menu.continue") : t("menu.continueDay", { day: savedDay })}
        </button>
        <button className="mm__btn mm__btn--olive" onClick={() => { sound.playClick(); setView("server"); }}>
          {t("menu.server")}
        </button>
        <button className="mm__btn mm__btn--glass" onClick={() => { sound.playClick(); onSources(); }}>
          <DatabaseIcon />
          <span>{t("menu.sources")}</span>
        </button>
      </div>
    </div>
  );
}

// Маленькие иконки для кнопок главного экрана
function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <ellipse cx="12" cy="12" rx="4" ry="9.5" />
      <path d="M2.5 12 H21.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
