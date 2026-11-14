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

export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
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
