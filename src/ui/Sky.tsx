// Звёздное небо и Земля над горизонтом. Звёзды считаются один раз и не прыгают между перерисовками
const rand = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const STARS = Array.from({ length: 110 }, (_, k) => ({
  x: rand(k + 1) * 100,
  y: rand(k + 501) * 38,
  r: k % 7 === 0 ? 1.6 : k % 3 === 0 ? 1.1 : 0.7,
  o: 0.35 + rand(k + 901) * 0.6,
}));

export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <svg className="sky__stars" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice">
        {STARS.map((s, k) => (
          <circle key={k} cx={s.x * 10} cy={s.y * 10} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}
      </svg>
      <div className="earth">
        <div className="earth__land earth__land--1" />
        <div className="earth__land earth__land--2" />
        <div className="earth__cloud" />
      </div>
    </div>
  );
}
