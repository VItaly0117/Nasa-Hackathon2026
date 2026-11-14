// Экипаж пока декоративный: настроение и полоска берутся из общего здоровья.
// TODO @Regie: у каждого астронавта свои здоровье, усталость и задача

const CREW = [
  { name: "Алиса", role: "Инженер", skin: "#f1c7a5", hair: "#2b1d1a", long: true },
  { name: "Максим", role: "Учёный", skin: "#f3c9a8", hair: "#a2522a", long: false },
  { name: "София", role: "Врач", skin: "#e9b996", hair: "#3a2a24", long: true },
  { name: "Даниил", role: "Техник", skin: "#f5d1b3", hair: "#e0b45a", long: false },
];

function Avatar({ skin, hair, long, mood }: { skin: string; hair: string; long: boolean; mood: number }) {
  const mouth = mood > 0 ? "M15 25 Q20 29 25 25" : mood < 0 ? "M15 27 Q20 23 25 27" : "M15 26 H25";
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#2a3a78" />
      {long && <path d="M8 22 Q6 8 20 7 Q34 8 32 22 L32 34 L8 34 Z" fill={hair} />}
      <path d="M10 40 Q10 31 20 31 Q30 31 30 40 Z" fill="#e8edf7" />
      <circle cx="20" cy="20" r="10" fill={skin} />
      <path d="M10 18 Q11 8 20 8 Q29 8 30 18 Q24 13 10 18 Z" fill={hair} />
      <circle cx="16.5" cy="20" r="1.4" fill="#2b1d1a" />
      <circle cx="23.5" cy="20" r="1.4" fill="#2b1d1a" />
      <path d={mouth} stroke="#7a3b2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Mood({ mood }: { mood: number }) {
  const color = mood > 0 ? "#4ade80" : mood < 0 ? "#ff7a7a" : "#fbbf24";
  const mouth = mood > 0 ? "M7 13 Q11 17 15 13" : mood < 0 ? "M7 15 Q11 11 15 15" : "M7 14 H15";
  const label = mood > 0 ? "в хорошем настроении" : mood < 0 ? "плохо себя чувствует" : "устал";
  return (
    <svg viewBox="0 0 22 22" width="24" height="24" role="img" aria-label={label}>
      <circle cx="11" cy="11" r="10" fill={color} />
      <circle cx="8" cy="9" r="1.3" fill="#14301f" />
      <circle cx="14" cy="9" r="1.3" fill="#14301f" />
      <path d={mouth} stroke="#14301f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CrewPanel({ health }: { health: number }) {
  const mood = health >= 70 ? 1 : health >= 40 ? 0 : -1;
  const barColor = health >= 70 ? "#4ade80" : health >= 40 ? "#fbbf24" : "#ff7a7a";

  return (
    <section className="hud-panel crew" aria-label="Экипаж">
      <h2 className="hud-title">Экипаж ({CREW.length})</h2>
      <ul className="crew__list">
        {CREW.map((p) => (
          <li key={p.name} className="crew__item">
            <Avatar skin={p.skin} hair={p.hair} long={p.long} mood={mood} />
            <div className="crew__info">
              <strong>{p.name}</strong>
              <span className="crew__role">{p.role}</span>
              <div className="crew__bar">
                <div style={{ width: `${health}%`, background: barColor }} />
              </div>
            </div>
            <Mood mood={mood} />
          </li>
        ))}
      </ul>
    </section>
  );
}
