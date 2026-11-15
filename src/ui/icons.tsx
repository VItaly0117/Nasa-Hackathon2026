import type { ResourceKey } from "@/types";

// Иконки ресурсов в стиле макета. TODO @Zakhar: можно заменить на свои из assets/icons/
export function ResourceIcon({ type, size = 28 }: { type: ResourceKey; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {type === "oxygen" && (
        <>
          <circle cx="12" cy="14" r="9" fill="none" stroke="#5aa9ff" strokeWidth="3.5" />
          <text x="20" y="28" fontSize="11" fontWeight="800" fill="#5aa9ff" fontFamily="Nunito, sans-serif">2</text>
        </>
      )}
      {type === "water" && (
        <>
          <path d="M16 3 C 10 12 7 16 7 21 a 9 9 0 0 0 18 0 C 25 16 22 12 16 3 Z" fill="#3b9cff" />
          <path d="M12 20 a 4 4 0 0 0 3 5" stroke="#bfe0ff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {type === "food" && (
        <>
          <path d="M16 9 C 9 6 4 11 5 18 c 1 7 6 11 11 9 c 5 2 10 -2 11 -9 c 1 -7 -4 -12 -11 -9 Z" fill="#e5484d" />
          <path d="M16 9 Q 16 5 18 3" stroke="#6b3a1f" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M17 6 Q 22 2 25 5 Q 21 8 17 6 Z" fill="#4caf50" />
          <ellipse cx="10" cy="15" rx="2" ry="3.5" fill="#ff9a9d" opacity="0.8" />
        </>
      )}
      {type === "energy" && (
        <path d="M19 2 L 7 18 h 8 l -3 12 L 25 13 h -8 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />
      )}
      {type === "health" && (
        <path d="M16 28 C 6 21 3 15 3 10 a 6.5 6.5 0 0 1 13 -1 a 6.5 6.5 0 0 1 13 1 c 0 5 -3 11 -13 18 Z" fill="#f2557a" />
      )}
      {type === "materials" && (
        <>
          <path d="M6 11 L16 6 L26 11 L16 16 Z" fill="#c9a26b" />
          <path d="M6 11 V22 L16 27 V16 Z" fill="#9c7443" />
          <path d="M26 11 V22 L16 27 V16 Z" fill="#b48a55" />
        </>
      )}
    </svg>
  );
}

export function MoonLogo({ size = 52 }: { size?: number }) {
  return (
    <svg viewBox="0 0 52 52" width={size} height={size} aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="#1d2a5c" stroke="#5b7fd6" strokeWidth="2" />
      <circle cx="26" cy="26" r="15" fill="#b9c6e8" />
      <circle cx="21" cy="21" r="4" fill="#93a3cf" />
      <circle cx="31" cy="30" r="3" fill="#93a3cf" />
      <ellipse cx="26" cy="26" rx="23" ry="7" fill="none" stroke="#7fa6f5" strokeWidth="1.5" transform="rotate(-20 26 26)" />
    </svg>
  );
}

// Иконка книжечки / справочника правил для кнопки «Правила»
export function BookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5 A 2.5 2.5 0 0 1 6.5 17 H 20" />
      <path d="M6.5 2 H 20 v 20 H 6.5 A 2.5 2.5 0 0 1 4 19.5 v -15 A 2.5 2.5 0 0 1 6.5 2 z" />
      <path d="M8 7 h 8 M8 11 h 6" strokeWidth="2" />
    </svg>
  );
}

// Иконки звука
export function SoundOnIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function SoundOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

// Иконки событий (минималистичные и понятные детям)
export function FlareBadgeIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="11" fill="#ffa726" />
      <circle cx="20" cy="20" r="8" fill="#ff7043" />
      <circle cx="17.5" cy="17.5" r="2.5" fill="#ffe082" opacity="0.9" />
      <g stroke="#ffa726" strokeWidth="2.8" strokeLinecap="round">
        <line x1="20" y1="3" x2="20" y2="6" />
        <line x1="20" y1="34" x2="20" y2="37" />
        <line x1="3" y1="20" x2="6" y2="20" />
        <line x1="34" y1="20" x2="37" y2="20" />
        <line x1="8" y1="8" x2="10.5" y2="10.5" />
        <line x1="29.5" y1="29.5" x2="32" y2="32" />
        <line x1="8" y1="32" x2="10.5" y2="29.5" />
        <line x1="29.5" y1="10.5" x2="32" y2="8" />
      </g>
    </svg>
  );
}

export function BreakdownBadgeIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M27 9 a 6.5 6.5 0 0 1 -4.2 8.5 l -9.5 9.5 a 2.5 2.5 0 0 1 -3.5 -3.5 l 9.5 -9.5 a 6.5 6.5 0 0 1 7.7 -5 z"
        fill="#4fc3f7"
        stroke="#81d4fa"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12.5" cy="27.5" r="1.8" fill="#1d2a5c" />
    </svg>
  );
}

export function AlertBadgeIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M20 5 L36 33 C37 35 35.5 37 33.5 37 L6.5 37 C4.5 37 3 35 4 33 L20 5 Z"
        fill="#f5b83d"
        stroke="#ffe082"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="18.5" y="16" width="3" height="9" rx="1.5" fill="#3b2405" />
      <circle cx="20" cy="30" r="1.7" fill="#3b2405" />
    </svg>
  );
}
