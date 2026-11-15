import { useEffect, useRef, useState } from "react";
import { CREW } from "@/ui/crewData";
import { moduleName, t, tDynamic } from "@/i18n";
import type { ModuleType } from "@/types";

// Место у модуля, куда астронавт идёт работать (координаты карты)
export type WalkTarget = { type: string; x: number; y: number };

const SPEED = 70;      // единиц карты в секунду
const SCALE = 1.6;     // размер астронавта относительно рисунка
const SPREAD = 26;     // чтобы астронавты у одного модуля не стояли друг на друге

// Астронавт сбоку, лицом вправо (влево его разворачивает scale в Walkers). Белый скафандр, большой синий визор,
// цветные детали (воротник, пояс, манжеты, точка на шлеме) своего цвета у каждого. Части с классами astro__* двигает Walkers
// напрямую в SVG на каждом кадре: ноги качаются вокруг бёдер (±3.5, -15), рука вокруг плеча (0, -31)
const LINE = { stroke: "#3a3358", strokeWidth: 0.9, strokeLinejoin: "round", strokeLinecap: "round" } as const;

function Leg({ x, boot, suit }: { x: number; boot: string; suit: string }) {
  return (
    <g {...LINE}>
      <rect x={x - 3.5} y="-16" width="7" height="12.5" rx="3.2" fill="url(#gAstroWhite)" />
      <rect x={x - 3.5} y="-7.5" width="7" height="2.6" fill={suit} />
      <path d={`M ${x - 4} -4 H ${x + 5.5} Q ${x + 7.5} -4 ${x + 7.5} -1.5 V 0 H ${x - 4} Z`} fill={boot} />
    </g>
  );
}

export function Astronaut({ suit, name }: { suit: string; name: string }) {
  return (
    <g>
      {/* Бейдж с именем над головой: рамка своего цвета, чтобы астронавтов различать издалека */}
      <g transform="translate(0, -96)">
        <rect className="astro__name-bg" x="-34" y="-13" width="68" height="22" rx="11" style={{ stroke: suit, strokeWidth: 2 }} />
        <text className="astro__name-tag" y="0">
          {name}
        </text>
      </g>
      <ellipse cx="0" cy="0" rx="13" ry="4.5" fill="#000" opacity="0.28" />
      <g className="astro">
        <g className="astro__legL"><Leg x={-3.5} boot="#8f96b3" suit={suit} /></g>
        {/* рюкзак за спиной */}
        <rect x="-17" y="-39" width="10" height="23" rx="4" fill="#cfd4e8" {...LINE} />
        <rect x="-15.5" y="-35" width="7" height="3" rx="1.5" fill={suit} opacity="0.9" />
        <g className="astro__legR"><Leg x={3.5} boot="#a9afc8" suit={suit} /></g>
        {/* туловище */}
        <g {...LINE}>
          <rect x="-10" y="-38" width="20" height="26" rx="8" fill="url(#gAstroWhite)" />
        </g>
        <rect x="-10" y="-21.5" width="20" height="4" fill={suit} stroke="#3a3358" strokeWidth="0.7" />
        <rect x="2" y="-33" width="6" height="5" rx="1.4" fill="#cfd4e8" stroke="#3a3358" strokeWidth="0.7" />
        <circle cx="4" cy="-30.5" r="0.8" fill="#6b7396" />
        <circle cx="6.2" cy="-30.5" r="0.8" fill="#6b7396" />
        {/* рука */}
        <g className="astro__arm" {...LINE}>
          <g transform="translate(0 -34)">
            <rect x="-3.3" y="-3" width="6.6" height="15" rx="3.3" fill="url(#gAstroWhite)" />
            <rect x="-3.3" y="7.4" width="6.6" height="2.4" fill={suit} />
            <circle cx="0" cy="12.8" r="3.3" fill="#a9afc8" />
          </g>
        </g>
        {/* шея и шлем */}
        <ellipse cx="0.5" cy="-37" rx="7" ry="2.4" fill={suit} stroke="#3a3358" strokeWidth="0.8" />
        <g {...LINE}>
          <circle cx="0.5" cy="-47" r="11.8" fill="url(#gAstroWhite)" />
        </g>
        <ellipse cx="6" cy="-47" rx="7" ry="7.4" fill="url(#gAstroVisor)" stroke="#2a2b52" strokeWidth="0.9" />
        <ellipse cx="8.2" cy="-50" rx="2.6" ry="1.7" fill="#ffffff" opacity="0.75" transform="rotate(-25 8.2 -50)" />
        <circle cx="-4.8" cy="-47" r="3" fill={suit} stroke="#3a3358" strokeWidth="0.8" />
        <circle className="astro__spark" cx="17" cy="-22" r="3.2" fill={suit} />
        {/* значок «болеет» над головой (показывается, пока астронавт отдыхает) */}
        <g className="astro__sick" display="none" transform="translate(12 -62)">
          <circle r="7" fill="#ffffff" stroke="#3a3358" strokeWidth="1" />
          <path d="M -1.8 -4.4 h 3.6 v 2.6 h 2.6 v 3.6 h -2.6 v 2.6 h -3.6 v -2.6 h -2.6 v -3.6 h 2.6 Z" fill="#e0243a" />
        </g>
      </g>
    </g>
  );
}

type Props = {
  targets: WalkTarget[];
  active: boolean; // false: игра на паузе или идёт событие, астронавты стоят
  sickIds?: number[]; // кто болеет: стоит на месте, не работает, над головой значок
};

// Маленькие астронавты ходят от модуля к модулю и «работают». Положение меняем напрямую в SVG,
// без перерисовки React на каждом кадре
export function Walkers({ targets, active, sickIds = [] }: Props) {
  const roots = useRef<(SVGGElement | null)[]>([]);
  // Над кем сейчас курсор (или кого коснулись): у него показываем подсказку
  const [hovered, setHovered] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  useEffect(() => {
    hoverRef.current = hovered;
  });
  const targetsRef = useRef(targets);
  const activeRef = useRef(active);
  const sickRef = useRef(sickIds);
  useEffect(() => {
    targetsRef.current = targets;
    activeRef.current = active;
    sickRef.current = sickIds;
  });

  useEffect(() => {
    const parts = CREW.map((_, i) => {
      const root = roots.current[i];
      return {
        root,
        flip: root?.querySelector<SVGGElement>(".astro") ?? null,
        legL: root?.querySelector<SVGGElement>(".astro__legL") ?? null,
        legR: root?.querySelector<SVGGElement>(".astro__legR") ?? null,
        arm: root?.querySelector<SVGGElement>(".astro__arm") ?? null,
        spark: root?.querySelector<SVGElement>(".astro__spark") ?? null,
        tip: root?.querySelector<SVGGElement>(".astro__tip") ?? null,
        sick: root?.querySelector<SVGGElement>(".astro__sick") ?? null,
      };
    });
    const st = CREW.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, ready: false, wait: 0, dir: 1, phase: Math.random() * 6, type: "", tip: "" }));

    // На старте каждый астронавт встаёт у своего объекта, а не все кучей у одного: подписи не накладываются
    const spawn = (i: number) => {
      const list = targetsRef.current;
      if (list.length === 0) return null;
      // тех, кому не хватило отдельного объекта, ставим рядом с чужим, но с заметным отступом
      const lap = Math.floor(i / list.length);
      const target = list[i % list.length];
      return { x: target.x + (lap % 2 ? 1 : -1) * lap * SPREAD * 1.8, y: target.y, type: target.type };
    };

    const choose = (i: number) => {
      const list = targetsRef.current;
      if (list.length === 0) return null;
      const mine = list.filter((t) => CREW[i].jobs.includes(t.type));
      const pool = mine.length > 0 && Math.random() < 0.75 ? mine : list;
      const target = pool[Math.floor(Math.random() * pool.length)];
      return { x: target.x + (i - 1.5) * SPREAD, y: target.y, type: target.type };
    };

    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = activeRef.current ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;

      st.forEach((s, i) => {
        const p = parts[i];
        if (!p.root) return;

        if (!s.ready) {
          const first = spawn(i);
          if (!first) return;
          s.x = s.tx = first.x;
          s.y = s.ty = first.y;
          s.type = first.type;
          s.wait = Math.random() * 3;
          s.ready = true;
        }

        // Больной не дееспособен: стоит на месте, новых целей не выбирает, не «работает»
        const sick = sickRef.current.includes(CREW[i].id);
        if (sick) {
          s.tx = s.x;
          s.ty = s.y;
          s.wait = 1;
        }
        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        const dist = Math.hypot(dx, dy);
        const walking = dist > 2;

        if (walking) {
          const step = Math.min(SPEED * dt, dist);
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
          if (Math.abs(dx) > 1) s.dir = dx > 0 ? 1 : -1;
          s.phase += dt * 11;
        } else {
          s.wait -= dt;
          s.phase += dt * 7;
          if (s.wait <= 0) {
            const next = choose(i);
            if (next) {
              s.tx = next.x;
              s.ty = next.y;
              s.type = next.type;
            }
            s.wait = 2.5 + Math.random() * 3.5;
          }
        }

        const swing = Math.sin(s.phase);
        const bob = walking ? -Math.abs(swing) * 2.2 : 0;
        p.root.setAttribute("transform", `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`);
        p.flip?.setAttribute("transform", `translate(0 ${bob.toFixed(1)}) scale(${s.dir * SCALE} ${SCALE})`);
        p.legL?.setAttribute("transform", `rotate(${walking ? swing * 34 : 0} -3.5 -15)`);
        p.legR?.setAttribute("transform", `rotate(${walking ? -swing * 34 : 0} 3.5 -15)`);
        // при ходьбе рука машет в такт ногам, на работе поднята и «стучит»
        // больной: руки опущены, работы нет
        p.arm?.setAttribute("transform", sick ? "rotate(-8 0 -31)" : walking ? `rotate(${-swing * 38} 0 -31)` : `rotate(${-115 + swing * 18} 0 -31)`);
        p.spark?.setAttribute("opacity", walking || sick ? "0" : (0.35 + 0.65 * Math.abs(Math.sin(s.phase * 1.5))).toFixed(2));
        p.sick?.setAttribute("display", sick ? "inline" : "none");
        p.flip?.setAttribute("opacity", sick ? "0.8" : "1");

        // Подсказка при наведении: куда идёт и над чем работает. Обновляем только у того, на кого навели
        if (p.tip && hoverRef.current === i) {
          const text = t(walking ? "walker.going" : "walker.working", { where: moduleName(s.type as ModuleType) });
          if (text !== s.tip) {
            s.tip = text;
            const label = p.tip.querySelector("text");
            const bg = p.tip.querySelector("rect");
            if (label) label.textContent = text;
            const w = Math.max(90, text.length * 7 + 22);
            bg?.setAttribute("x", String(-w / 2));
            bg?.setAttribute("width", String(w));
          }
        }
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <g>
      {CREW.map((c, i) => (
        <g
          key={c.id}
          ref={(el) => {
            roots.current[i] = el;
          }}
          transform="translate(-9999 -9999)"
        >
          <Astronaut suit={c.suit} name={tDynamic(`crew.n${c.id}`)} />
          {/* Невидимая зона над астронавтом: на неё наводят курсор или касаются */}
          <rect
            x="-24"
            y="-112"
            width="48"
            height="116"
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: "help" }}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
            onClick={() => setHovered((h) => (h === i ? null : i))}
          />
          <g
            className="astro__tip"
            style={{ transform: "translate(0px, -124px) scale(var(--inv-k, 1))" }}
            display={hovered === i ? undefined : "none"}
            pointerEvents="none"
          >
            <rect className="astro__name-bg" x="-45" y="-26" width="90" height="26" rx="8" />
            <text className="astro__name-tag" y="-13" style={{ fontSize: 13 }} />
          </g>
        </g>
      ))}
    </g>
  );
}
