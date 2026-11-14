import type { CSSProperties } from "react";

// Живое звёздное небо: мерцают звёзды, пролетают метеоры и спутник, вращается Земля.
// Звёзды считаются один раз и не прыгают между перерисовками
const rand = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const STARS = Array.from({ length: 120 }, (_, k) => ({
  x: rand(k + 1) * 100,
  y: rand(k + 501) * 38,
  r: k % 7 === 0 ? 1.8 : k % 3 === 0 ? 1.2 : 0.8,
  o: 0.35 + rand(k + 901) * 0.6,
  dur: 2 + rand(k + 77) * 4,
  delay: rand(k + 313) * 6,
}));

const METEORS = [
  { top: 6, left: 70, delay: 3, dur: 9 },
  { top: 16, left: 30, delay: 11, dur: 13 },
  { top: 2, left: 90, delay: 18, dur: 17 },
];

// Кометы: яркая голова с длинным хвостом, летят по диагонали через всё небо
const COMETS = [
  { top: 4, left: 105, delay: 2, dur: 16, angle: -24, size: 1 },
  { top: 20, left: 112, delay: 9, dur: 22, angle: -18, size: 1.4 },
  { top: 9, left: 108, delay: 21, dur: 19, angle: -30, size: 0.8 },
];

// Крупные «искрящиеся» звёзды-крестики
const SPARKLES = Array.from({ length: 9 }, (_, k) => ({
  x: 5 + rand(k + 41) * 90,
  y: 3 + rand(k + 83) * 34,
  s: 10 + rand(k + 17) * 10,
  delay: rand(k + 29) * 7,
  dur: 3 + rand(k + 61) * 3,
  hue: k % 3 === 0 ? '#ffe9a8' : k % 3 === 1 ? '#bfe0ff' : '#ffffff',
}));

// Космическая пыль: медленно плывёт вверх и мерцает
const DUST = Array.from({ length: 22 }, (_, k) => ({
  x: rand(k + 7) * 100,
  size: 2 + rand(k + 19) * 3,
  delay: rand(k + 53) * 14,
  dur: 12 + rand(k + 97) * 14,
  drift: (rand(k + 131) - 0.5) * 80,
}));

export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="nebula nebula--1" />
      <div className="nebula nebula--2" />

      <svg className="sky__stars" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice">
        {STARS.map((s, k) => (
          <circle
            key={k}
            className="star"
            cx={s.x * 10}
            cy={s.y * 10}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
            style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          />
        ))}
      </svg>

      {METEORS.map((m, k) => (
        <span
          key={k}
          className="meteor"
          style={{ top: `${m.top}vh`, left: `${m.left}%`, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }}
        />
      ))}

      {SPARKLES.map((s, k) => (
        <span
          key={k}
          className="sparkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}vh`,
            width: s.s,
            height: s.s,
            color: s.hue,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}

      {COMETS.map((c, k) => (
        <div
          key={k}
          className="comet"
          style={
            {
              top: `${c.top}vh`,
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              '--a': `${c.angle}deg`,
              '--s': c.size,
            } as CSSProperties
          }
        >
          <span className="comet__tail" />
          <span className="comet__head" />
        </div>
      ))}

      <div className="planet">
        <div className="planet__ball" />
        <div className="planet__ring" />
      </div>

      <div className="rocket">
        <svg viewBox="0 0 48 24" width="48" height="24">
          <path d="M6 12 L0 7 L0 17 Z" fill="#ff9d3b" className="rocket__flame" />
          <rect x="6" y="6" width="26" height="12" rx="5" fill="#e8eefc" />
          <path d="M32 6 Q46 12 32 18 Z" fill="#ff5d5d" />
          <circle cx="22" cy="12" r="3" fill="#6ec1ff" stroke="#9aa7c7" strokeWidth="1" />
          <path d="M8 6 L4 1 L14 6 Z M8 18 L4 23 L14 18 Z" fill="#ff5d5d" />
        </svg>
      </div>

      <div className="ufo">
        <svg viewBox="0 0 50 26" width="50" height="26">
          <ellipse cx="25" cy="9" rx="9" ry="7" fill="#9fe6ff" opacity="0.8" />
          <ellipse cx="25" cy="15" rx="23" ry="7" fill="#aab4cc" />
          <circle cx="10" cy="16" r="1.8" fill="#ffe36b" className="ufo__light ufo__light--a" />
          <circle cx="25" cy="18" r="1.8" fill="#ffe36b" className="ufo__light ufo__light--b" />
          <circle cx="40" cy="16" r="1.8" fill="#ffe36b" className="ufo__light ufo__light--c" />
        </svg>
      </div>

      {DUST.map((d, k) => (
        <span
          key={k}
          className="dust"
          style={
            {
              left: `${d.x}%`,
              width: d.size,
              height: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
              '--dx': `${d.drift}px`,
            } as CSSProperties
          }
        />
      ))}

      <div className="satellite">
        <svg viewBox="0 0 60 24" width="60" height="24">
          <rect x="22" y="7" width="16" height="10" rx="2" fill="#cfd6e8" />
          <rect x="2" y="9" width="18" height="6" fill="#4a6fd0" />
          <rect x="40" y="9" width="18" height="6" fill="#4a6fd0" />
          <circle cx="30" cy="12" r="2" fill="#ff6b6b" className="satellite__light" />
        </svg>
      </div>

      <div className="earth">
        <div className="earth__spin">
          <div className="earth__land earth__land--1" />
          <div className="earth__land earth__land--2" />
          <div className="earth__land earth__land--3" />
          <div className="earth__land earth__land--1 earth__land--copy1" />
          <div className="earth__land earth__land--2 earth__land--copy2" />
          <div className="earth__land earth__land--3 earth__land--copy3" />
        </div>
        <div className="earth__cloud" />
      </div>
    </div>
  );
}
