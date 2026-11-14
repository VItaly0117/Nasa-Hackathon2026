import type { ResourceKey } from "../types";

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
