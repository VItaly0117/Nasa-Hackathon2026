// Одиночные звуки игры: каждый строит свой кусочек Web Audio-графа и подключает его к общему выходу (master).
// Тембры и громкости подобраны мягкими, тактильными и кинематографичными: без резких пил, перегруза и высокого писка.
import { createNoiseBuffer } from "./noise";

// 1. Приятный тактильный щелчок кнопок и элементов (UI Click)
// Мягкий тактильный «ток» дорогого интерфейса: тёплое низкочастотное тело + деликатный щелчок без свиста
export function click(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;

  // Тёплый тактильный импульс кнопки (360 -> 200 Гц)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.024);

  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(0.32, now + 0.003);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  osc.connect(oscGain);
  oscGain.connect(master);

  // Мягкий высокотехнологичный щелчок (отфильтрованный щелчок переключателя)
  const snap = ctx.createOscillator();
  const snapGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  snap.type = "triangle";
  snap.frequency.setValueAtTime(1050, now);
  snap.frequency.exponentialRampToValueAtTime(460, now + 0.016);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1150, now);
  filter.Q.setValueAtTime(1.4, now);

  snapGain.gain.setValueAtTime(0.0001, now);
  snapGain.gain.linearRampToValueAtTime(0.14, now + 0.002);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  snap.connect(filter);
  filter.connect(snapGain);
  snapGain.connect(master);

  osc.start(now);
  snap.start(now);
  osc.stop(now + 0.045);
  snap.stop(now + 0.025);
}

// 2. Мягкий радио-чирп телеметрии (для пролога, субтитров и радиопередач)
export function radioChirp(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(940, now);
  osc.frequency.exponentialRampToValueAtTime(1240, now + 0.04);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1150, now);
  filter.Q.setValueAtTime(1.0, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.055);
}

// 3. Подтверждение критического решения экипажа / исследования: гармоничный аккорд
export function decisionConfirm(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const notes = [329.63, 493.88]; // Ми4, Си4 — чистая квинта NASA
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, now);

  notes.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.17);
  });
}

// 4. Новое задание: деликатный хрустальный перезвон
export function taskToast(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [587.33, 880.0].forEach((freq, i) => { // Ре5 -> Ля5
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.09;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.34);
  });
}

// 5. Начало стройки: плотный стыковочный замок и гидравлический фиксатор
export function buildStart(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;

  // Низкочастотный гидравлический фиксатор (140 -> 60 Гц)
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.11);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(450, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  // Механический металлический клик зажима
  const snap = ctx.createOscillator();
  const snapFilter = ctx.createBiquadFilter();
  const snapGain = ctx.createGain();

  snap.type = "triangle";
  snap.frequency.setValueAtTime(420, now);
  snap.frequency.exponentialRampToValueAtTime(180, now + 0.05);

  snapFilter.type = "bandpass";
  snapFilter.frequency.setValueAtTime(480, now);
  snapFilter.Q.setValueAtTime(1.8, now);

  snapGain.gain.setValueAtTime(0.0001, now);
  snapGain.gain.linearRampToValueAtTime(0.12, now + 0.004);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  snap.connect(snapFilter);
  snapFilter.connect(snapGain);
  snapGain.connect(master);

  osc.start(now);
  snap.start(now);
  osc.stop(now + 0.14);
  snap.stop(now + 0.07);
}

// 6. Импульс работы во время строительства (строительный ритм / сварка / монтаж)
export function constructionPulse(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;

  // 1. Механический монтажный щелчок / пневмозатяжка
  const tap = ctx.createOscillator();
  const tapGain = ctx.createGain();
  tap.type = "triangle";
  tap.frequency.setValueAtTime(170, now);
  tap.frequency.exponentialRampToValueAtTime(75, now + 0.04);

  tapGain.gain.setValueAtTime(0.0001, now);
  tapGain.gain.linearRampToValueAtTime(0.28, now + 0.004);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  tap.connect(tapGain);
  tapGain.connect(master);

  tap.start(now);
  tap.stop(now + 0.05);

  // 2. Мягкая лазерная сварка / нано-пайка (короткий мягкий шелест)
  const weldStart = now + 0.03;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.08);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(950, weldStart);
  filter.Q.setValueAtTime(1.6, weldStart);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, weldStart);
  noiseGain.gain.linearRampToValueAtTime(0.14, weldStart + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, weldStart + 0.065);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);

  noise.start(weldStart);
  noise.stop(weldStart + 0.07);
}

// 7. Завершение стройки: тёплый мажорный 3-нотный перезвон (До5 - Ми5 - Соль5)
export function buildComplete(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // До, Ми, Соль
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.085;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.45);
  });
}

// 8. Ремонт модуля: деликатные импульсы сервисного инструмента
export function repair(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;

  [0, 0.075].forEach((offset) => {
    const start = now + offset;

    // Мягкий шум напыления
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(820, start);
    filter.Q.setValueAtTime(1.5, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    noise.start(start);
    noise.stop(start + 0.08);

    // Тон электронного сервопривода
    const servo = ctx.createOscillator();
    const servoGain = ctx.createGain();
    servo.type = "sine";
    servo.frequency.setValueAtTime(220, start);
    servo.frequency.exponentialRampToValueAtTime(310, start + 0.06);

    servoGain.gain.setValueAtTime(0.0001, start);
    servoGain.gain.linearRampToValueAtTime(0.06, start + 0.01);
    servoGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);

    servo.connect(servoGain);
    servoGain.connect(master);

    servo.start(start);
    servo.stop(start + 0.07);
  });
}

// 9. Смена дня: мягкий аккорд восхода солнца
export function dayChange(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [440, 554.37, 659.25].forEach((freq) => { // Ля - До# - Ми (мажорный рассвет)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.75);
  });
}

// 10. Наступление лунной ночи: глубокий космический гул заката
export function nightfall(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 1.2);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(280, now);
  filter.frequency.exponentialRampToValueAtTime(70, now + 1.2);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 1.3);
}

// 11. Победа: гармоничный ретро-синт финал
export function victory(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const melody = [
    { f: 261.63, d: 0.14 }, // До4
    { f: 329.63, d: 0.14 }, // Ми4
    { f: 392.0, d: 0.14 },  // Соль4
    { f: 523.25, d: 0.2 },  // До5
    { f: 659.25, d: 0.55 }, // Ми5
  ];

  let offset = 0;
  melody.forEach((note) => {
    const start = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(note.f, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.d);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + note.d + 0.04);

    offset += note.d * 0.85;
  });
}

// 12. Поражение: спокойный нисходящий аккорд
export function defeat(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [220, 261.63, 311.13].forEach((freq) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 1.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 1.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 1.35);
  });
}

// 13. Подтверждающий двухнотный перезвон при включении звука (унмьют)
export function toggleSound(ctx: BaseAudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [523.25, 783.99].forEach((freq, idx) => { // До5 -> Соль5
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + idx * 0.075;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.24);
  });
}

// 14. Тревожная сирена: солнечная вспышка, поломка или болезнь
export function alarm(ctx: BaseAudioContext, master: GainNode, kind: "flare" | "breakdown" | "illness"): void {
  const now = ctx.currentTime;

  if (kind === "flare") {
    // Сирена солнечной вспышки: 3 мягких волнообразных сигнала
    for (let cycle = 0; cycle < 3; cycle++) {
      const start = now + cycle * 0.26;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(540, start);
      osc.frequency.setValueAtTime(420, start + 0.13);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1000, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.03);
      gain.gain.setValueAtTime(0.16, start + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.26);
    }
  } else if (kind === "breakdown") {
    // Предупреждение аварии жизнеобеспечения: двойной технологичный пинг
    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.12;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(620, start);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(620, start);
      filter.Q.setValueAtTime(2, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.095);
    }
  } else {
    // Болезнь астронавта: мягкий нисходящий тон
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.38);
  }
}

// 15. Звук таймера зворотного відліку («тік-так») для останніх 15 секунд дня
// Чіткий ігровий годинник:
// - 15..6 секунд: плавний ритмічний «тік» (вищий) і «так» (нижчий)
// - 5..1 секунд: прискорений подвійний «тік-так» із підвищенням тону, що зрозуміло підганяє дитину
export function timerTick(
  ctx: BaseAudioContext,
  master: GainNode,
  isTock = false,
  secondsLeft = 15
): void {
  const now = ctx.currentTime;
  const isUrgent = secondsLeft <= 5;
  const pitchShift = isUrgent ? (6 - secondsLeft) * 35 : 0; // плавне підвищення тону в останні 5 секунд

  if (!isUrgent) {
    // Звичайний ритмічний «тік» або «так» (15..6 секунд)
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const baseFreq = isTock ? 560 : 780; // «Так» нижчий (560 Гц), «Тік» вищий (780 Гц)
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.035);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(baseFreq, now);
    filter.Q.setValueAtTime(2.2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.05);
  } else {
    // Прискорений подвійний «тік-так» для останніх 5 секунд (5, 4, 3, 2, 1) — відчуття терміновості
    [0, 0.08].forEach((offset, idx) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const freq = (idx === 0 ? 840 : 620) + pitchShift;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, start + 0.035);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq, start);
      filter.Q.setValueAtTime(2.5, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.26, start + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.05);
    });
  }
}
