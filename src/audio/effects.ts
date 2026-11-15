// Одиночные звуки игры: каждый строит свой кусочек Web Audio-графа и подключает его к общему выходу (master).
// Тембры и громкости подобраны мягкими (см. docs/NIGHT_REPORT.md, «Звуки смягчены»): без резких пил, квадрата и высокого писка.
import { createNoiseBuffer } from "./noise";

// 1. Короткий тактильный щелчок кнопок (UI Click)
export function click(ctx: AudioContext, master: GainNode): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  osc.type = "sine";
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.08);
}

// Мягкий радио-чирп телеметрии (для пролога и субтитров)
export function radioChirp(ctx: AudioContext, master: GainNode): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  osc.type = "sine";
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(1100, now + 0.05);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.055);
}

// Короткий низкий радиоквиток для подтверждения критического решения экипажа.
export function decisionConfirm(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const carrier = ctx.createOscillator();
  const tone = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(660, now);
  carrier.frequency.exponentialRampToValueAtTime(520, now + 0.11);
  tone.type = "sine";
  tone.frequency.setValueAtTime(440, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
  gain.gain.setValueAtTime(0.08, now + 0.055);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  carrier.connect(filter);
  tone.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  carrier.start(now);
  tone.start(now);
  carrier.stop(now + 0.17);
  tone.stop(now + 0.17);
}

// 2. Новое задание: мягкий двухнотный «колокольчик» (раньше был резкий писк 2,5 кГц)
export function taskToast(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [784, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.11;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.42);
  });
}

// 3. Начало стройки: механический удар монтажа и металлический отклик
export function buildStart(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, now);
  filter.Q.setValueAtTime(1.2, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.26, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.15);
}

// 4. Завершение стройки: мажорный 3-нотный перезвон (C5 - E5 - G5)
export function buildComplete(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // До, Ми, Соль
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.09;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.48);
  });
}

// 5. Ремонт модуля: электрическая дуга и звук инструмента
export function repair(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.22);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1000, now);
  filter.Q.setValueAtTime(0.7, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  noise.start(now);
  noise.stop(now + 0.21);
}

// 7. Смена дня: аккорд восхода
export function dayChange(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [440, 659.25, 880].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.75);
  });
}

// 8. Наступление лунной ночи: глубокий космический гул
export function nightfall(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 1.35);
}

// 9. Победа: победный 5-нотный ретро-синт арпеджио
export function victory(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  const melody = [
    { f: 261.63, d: 0.15 }, // C4
    { f: 329.63, d: 0.15 }, // E4
    { f: 392.0, d: 0.15 },  // G4
    { f: 523.25, d: 0.22 }, // C5
    { f: 659.25, d: 0.6 },  // E5
  ];

  let offset = 0;
  melody.forEach((note) => {
    const start = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(note.f, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + note.d + 0.05);

    offset += note.d * 0.85;
  });
}

// 10. Поражение: нисходящий минорный аккорд
export function defeat(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [220, 261.63, 311.13].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 1.4);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 1.55);
  });
}

// Подтверждающий двухнотный перезвон при включении звука
export function toggleSound(ctx: AudioContext, master: GainNode): void {
  const now = ctx.currentTime;
  [659.25, 987.77].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + idx * 0.08;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + 0.26);
  });
}

// 6. Тревожная сирена: солнечная вспышка, поломка или болезнь
export function alarm(ctx: AudioContext, master: GainNode, kind: "flare" | "breakdown" | "illness"): void {
  const now = ctx.currentTime;

  if (kind === "flare") {
    // Сирена солнечной вспышки
    for (let cycle = 0; cycle < 3; cycle++) {
      const start = now + cycle * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, start);
      osc.frequency.setValueAtTime(494, start + 0.14);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.04);
      gain.gain.setValueAtTime(0.2, start + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.27);
    }
  } else if (kind === "breakdown") {
    // Двойной писк аварии жизнеобеспечения
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(740, start);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.1);
    }
  } else {
    // Болезнь астронавта
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.38);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(now + 0.39);
  }
}
