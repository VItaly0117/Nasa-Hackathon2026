import { memo, useEffect, useRef } from "react";

// Живое небо поверх фоновой картинки: мерцающие звёзды, метеориты, комета и вращающаяся Земля.
// Рисуется на одном маленьком canvas только в верхней части карты (небо над горизонтом).
// Положение Земли на картинке: центр ≈ (47.5% ширины, 14% высоты картинки), радиус ≈ 11.5% ширины.
const EARTH = { x: 0.52, y: 307, r: 0.1225 }; // y и r — в пикселях canvas
const W = 1600;
const H = 416;
const HORIZON = 272; // ниже этой линии — горы: звёзды и облака туда не заходят
const SKY_FRACTION = 0.5; // какую долю видимой карты по высоте занимает canvas

type Star = { x: number; y: number; r: number; phase: number; speed: number };
type Streak = { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number };
type Comet = { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number; bend: number };

// Сонце условно за верхним левым краем кадра: хвост кометы всегда направлен ОТ Солнца (вправо-вниз),
// независимо от того, куда она летит. Так же в реальности.
const TAIL = { x: Math.cos(0.5), y: Math.sin(0.5) };

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// плавная S-образная кривая 0..1 — для мягкого появления и исчезновения
function smooth(v: number) {
  const c = Math.min(1, Math.max(0, v));
  return c * c * (3 - 2 * c);
}

function SkyFxImpl({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = EARTH.x * W;
    const cy = EARTH.y;
    const cr = EARTH.r * W;

    const stars: Star[] = Array.from({ length: 110 }, () => {
      let x = 0;
      let y = 0;
      do {
        x = rand(0, W);
        y = rand(0, 200);
      } while (Math.hypot(x - cx, y - cy) < cr + 6);
      return { x, y, r: rand(0.4, 1.5), phase: rand(0, 6.28), speed: rand(0.6, 2.2) };
    });
    const streaks: Streak[] = [];
    let comet: Comet | null = null;
    let nextMeteor = rand(3, 6);
    let nextComet = rand(4, 8); // первая комета — скоро, дальше редко
    let raf = 0;
    let last = performance.now();
    let t = 0;

    const spawnMeteor = () => {
      const ang = rand(0.4, 0.6); // вниз и вправо/влево
      const sp = rand(260, 400);
      const dir = Math.random() < 0.5 ? 1 : -1;
      streaks.push({
        x: dir === 1 ? rand(0, W * 0.6) : rand(W * 0.4, W),
        y: rand(-10, H * 0.2),
        vx: Math.cos(ang) * sp * dir,
        vy: Math.sin(ang) * sp,
        life: 0,
        max: rand(1.1, 1.9),
        len: rand(50, 100),
      });
    };

    // Комета: далёкий объект — летит очень медленно, почти горизонтально, выше горизонта
    const spawnComet = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      comet = {
        x: dir === 1 ? rand(-40, W * 0.25) : rand(W * 0.75, W + 40),
        y: rand(30, 120),
        vx: dir * rand(16, 26),
        vy: rand(-1, 3),
        life: 0,
        max: rand(45, 65),
        len: rand(150, 190),
        bend: rand(0.25, 0.4),
      };
    };

    const drawComet = (c: Comet) => {
      const k = c.life / c.max;
      // мягко проявляется и растворяется (по 15% времени), в середине пути ярче и хвост длиннее
      const fade = smooth(Math.min(k / 0.15, (1 - k) / 0.15, 1));
      const near = 0.65 + 0.35 * Math.sin(Math.PI * k);
      const len = c.len * near;
      const ux = TAIL.x;
      const uy = TAIL.y;
      const px = -uy;
      const py = ux;

      ctx.save();
      // комета далеко за Землёй — Земля её закрывает
      ctx.beginPath();
      ctx.rect(0, 0, W, HORIZON);
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.clip("evenodd");
      ctx.globalCompositeOperation = "lighter";

      // ионный хвост: тонкий, прямой, голубой
      const ex = c.x + ux * len;
      const ey = c.y + uy * len;
      const ig = ctx.createLinearGradient(c.x, c.y, ex, ey);
      ig.addColorStop(0, `rgba(175,220,255,${0.6 * fade})`);
      ig.addColorStop(1, "rgba(120,180,255,0)");
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(c.x + px * 3.5, c.y + py * 3.5);
      ctx.lineTo(ex, ey);
      ctx.lineTo(c.x - px * 3.5, c.y - py * 3.5);
      ctx.closePath();
      ctx.fill();

      // кома (мягкое свечение вокруг ядра) и само ядро
      const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 20);
      hg.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
      hg.addColorStop(0.3, `rgba(190,225,255,${0.35 * fade})`);
      hg.addColorStop(1, "rgba(150,200,255,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawEarthSpin = () => {
      // Вращение: облака и тень «ползут» по диску Земли слева направо и обрезаются кругом
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, cr - 1, 0, Math.PI * 2);
      ctx.clip();
      const shift = ((t * 6) % (cr * 2.6)) - cr * 1.3;
      for (let i = 0; i < 6; i++) {
        const bx = cx + shift + (i - 2.5) * cr * 0.55;
        const by = cy + Math.sin(i * 2.1) * cr * 0.55;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, cr * 0.5);
        g.addColorStop(0, "rgba(255,255,255,0.16)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
        // эллипс-облако
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(1.6, 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, cr * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, HORIZON);
      ctx.clip();

      for (const s of stars) {
        const a = reduce ? 0.7 : 0.45 + 0.55 * Math.abs(Math.sin(t * s.speed + s.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce) {
        drawEarthSpin();

        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          spawnMeteor();
          nextMeteor = rand(5, 12);
        }

        // одна комета за раз, между ними долгая пауза
        if (comet) {
          const c: Comet = comet;
          c.life += dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          if (c.life >= c.max) {
            comet = null;
            nextComet = rand(50, 90);
          } else {
            drawComet(c);
          }
        } else {
          nextComet -= dt;
          if (nextComet <= 0) spawnComet();
        }

        for (let i = streaks.length - 1; i >= 0; i--) {
          const s = streaks[i];
          s.life += dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const k = s.life / s.max;
          if (k >= 1 || s.y > HORIZON || s.x < -200 || s.x > W + 200) {
            streaks.splice(i, 1);
            continue;
          }
          // плавно вспыхивает и гаснет; у горизонта растворяется, а не обрывается
          const fade = Math.sin(Math.PI * k) * smooth((HORIZON - s.y) / 70) * 0.85;
          const sp = Math.hypot(s.vx, s.vy);
          const tx = s.x - (s.vx / sp) * s.len;
          const ty = s.y - (s.vy / sp) * s.len;
          const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
          g.addColorStop(0, `rgba(255,255,255,${fade})`);
          g.addColorStop(1, "rgba(255,200,150,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="map-sky-fx"
      width={W}
      height={H}
      style={{ width, height: height * SKY_FRACTION }}
      aria-hidden="true"
    />
  );
}

export const SkyFx = memo(SkyFxImpl);
