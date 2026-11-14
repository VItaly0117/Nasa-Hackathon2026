import { useEffect, useState } from "react";
import { getLang, langName, t } from "@/i18n";
import type { Lang } from "@/i18n";
import { joinRoom, ROOM_NAME, SERVER_AVAILABLE } from "@/net/online";
import type { Session } from "@/net/online";
import { LangSelect } from "./LangSelect";
import { MoonLogo, SoundOffIcon, SoundOnIcon } from "@/ui/icons";
import { sound } from "@/audio/audio";
import "@/features/story/Intro.css";
import "./MainMenu.css";

type Props = {
  savedDay: number | null; // день сохранённой миссии или null, если продолжать нечего
  onLang: (lang: Lang) => void;
  onNewGame: () => void;
  onContinue: () => void;
  onJoined: (session: Session) => void;
  onSources: () => void; // открыть экран «Данные NASA»
};

// Начальный экран: название игры и кнопки. Выбор языка и вход на сервер открываются здесь же
export function MainMenu({ savedDay, onLang, onNewGame, onContinue, onJoined, onSources }: Props) {
  const [view, setView] = useState<"main" | "lang" | "server">("main");
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

  return (
    <div className="overlay">
      <div className="modal intro menu" role="dialog" aria-labelledby="menu-title">
        <MoonLogo size={88} />
        <h1 id="menu-title" className="menu__title">{t("app.title")}</h1>
        <p className="menu__tagline">{t("menu.tagline")}</p>
        <div className="menu__buttons">
          <button className="btn btn--ghost menu__btn" onClick={() => { sound.playClick(); setView("lang"); }}>
            {t("menu.language", { lang: langName(getLang()) })}
          </button>
          <button
            type="button"
            className="btn btn--ghost menu__btn"
            onClick={() => sound.toggleMute()}
            title={muted ? t("app.soundOff") : t("app.soundOn")}
          >
            {muted ? <SoundOffIcon size={20} /> : <SoundOnIcon size={20} />}
            <span>{muted ? t("app.soundOff") : t("app.soundOn")}</span>
          </button>
          <button className="btn btn--primary menu__btn" onClick={() => { sound.playClick(); onNewGame(); }}>
            {t("menu.newGame")}
          </button>
          <button
            className="btn btn--primary menu__btn"
            onClick={() => { sound.playClick(); onContinue(); }}
            disabled={savedDay === null}
          >
            {savedDay === null ? t("menu.continue") : t("menu.continueDay", { day: savedDay })}
          </button>
          <button className="btn btn--primary menu__btn" onClick={() => { sound.playClick(); setView("server"); }}>
            {t("menu.server")}
          </button>
          <button className="btn btn--ghost menu__btn" onClick={() => { sound.playClick(); onSources(); }}>
            {t("menu.sources")}
          </button>
        </div>
      </div>
    </div>
  );
}
