import { LANGS, langName } from "@/i18n";
import type { Lang } from "@/i18n";
import { sound } from "@/audio/audio";
import { MoonLogo } from "@/ui/icons";
import "./MainMenu.css";

// Первый экран игры: заголовок сразу на всех языках, потому что язык ещё не выбран
export function LangSelect({ onPick }: { onPick: (lang: Lang) => void }) {
  return (
    <div className="mm">
      <div className="mm__box mm__box--modes" role="dialog" aria-labelledby="lang-title">
        <MoonLogo size={72} />
        <h1 id="lang-title" className="mm__title mm__title--lang">Оберіть мову · Choose your language · Выберите язык</h1>
        {LANGS.map((lang) => (
          <button
            key={lang}
            className="mm__btn mm__btn--new"
            lang={lang}
            onClick={() => {
              sound.playClick();
              onPick(lang);
            }}
          >
            {langName(lang)}
          </button>
        ))}
      </div>
    </div>
  );
}
