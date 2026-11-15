import { LANGS, langName } from "@/i18n";
import type { Lang } from "@/i18n";
import { MoonLogo } from "@/ui/icons";
import "@/features/story/Intro.css";

// Первый экран игры: заголовок сразу на всех языках, потому что язык ещё не выбран
export function LangSelect({ onPick }: { onPick: (lang: Lang) => void }) {
  return (
    <div className="overlay">
      <div className="modal intro intro--lang" role="dialog" aria-labelledby="lang-title">
        <MoonLogo size={72} />
        <h2 id="lang-title">Оберіть мову · Choose your language · Выберите язык</h2>
        <div className="lang-select">
          {LANGS.map((lang) => (
            <button key={lang} className="btn btn--primary lang-select__btn" lang={lang} onClick={() => onPick(lang)}>
              {langName(lang)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
