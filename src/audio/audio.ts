// Процедурный ретро-звуковой движок на Web Audio API.
// Синтезирует все звуки в реальном времени, без внешних файлов.
// Полностью автономен, устойчив к политикам автовоспроизведения браузеров и безопасен для SSR/тестов.

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientHarmonicGain: GainNode | null = null;
  private ambientNoiseGain: GainNode | null = null;
  private ambientMusicGain: GainNode | null = null;
  private ambientMusicTimer: number | null = null;
  private ambientMusicStep = 0;
  private ambientNight = false;
  private ambientRunning = false;
  private ambientPending = false;
  private ambientStopTimer: number | null = null;
  private muted = false;
  private listeners = new Set<MuteListener>();
  private masterVolume = 0.85; // Оптимальная слышимая громкость

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("moonbase:muted");
        this.muted = saved === "true";
      } catch {
        this.muted = false;
      }

      // Глобальный разблокировщик Web Audio по первому взаимодействию с любой частью страницы
      const unlock = () => {
        this.unlock();
      };
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("keydown", unlock, { passive: true });
      window.addEventListener("touchstart", unlock, { passive: true });
    }
  }

  // Ленивая инициализация AudioContext
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  // Разблокировка контекста по пользовательскому жесту
  public unlock() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (this.ambientPending && !this.muted) {
          this.ambientPending = false;
          this.startAmbient();
        }
      }).catch(() => {});
    } else if (this.ambientPending && !this.muted) {
      this.ambientPending = false;
      this.startAmbient();
    }
  }

  // Безопасный запуск звука: если контекст еще «спит», пробуждает его и воспроизводит сразу по готовности
  private runWithContext(fn: (ctx: AudioContext, master: GainNode) => void) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (!this.muted && this.masterGain && ctx.state === "running") {
          fn(ctx, this.masterGain);
        }
      }).catch(() => {});
    } else {
      fn(ctx, this.masterGain);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("moonbase:muted", String(mute));
      } catch {
        // игнорируем ошибки доступа к storage
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime, 0.045);
    }
    if (mute) {
      this.stopAmbient();
    } else {
      this.startAmbient();
    }
    this.notify();
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    // Разбудить Web Audio синхронно с кликом: это важно для autoplay-политик Safari.
    if (!next) this.unlock();
    this.setMuted(next);
    if (!next) {
      this.runWithContext((ctx, master) => this.scheduleToggleSound(ctx, master));
    }
    return this.muted;
  }

  public subscribe(fn: MuteListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this.muted);
  }

  // Генератор буфера шума (реголит, ветер, сварка)
  private createNoiseBuffer(ctx: AudioContext, seconds = 0.5): AudioBuffer {
    const bufferSize = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Генерируем розовый шум: он ближе к мягкому потоку воздуха, чем яркий белый шум.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    // Crossfade the loop endpoints to avoid an audible click every few seconds.
    const fade = Math.min(Math.floor(ctx.sampleRate * 0.08), Math.floor(bufferSize / 4));
    for (let i = 0; i < fade; i++) {
      const mix = i / fade;
      const head = data[i];
      const tailIndex = bufferSize - fade + i;
      const tail = data[tailIndex];
      const blended = tail * (1 - mix) + head * mix;
      data[i] = blended;
      data[tailIndex] = blended;
    }
    return buffer;
  }

  // 1. Короткий тактильный щелчок кнопок (UI Click)
  public playClick() {
    this.runWithContext((ctx, master) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.045);
    });
  }

  // Тестовый подтверждающий двухнотный перезвон (при включении звука)
  public playToggleSound() {
    this.runWithContext((ctx, master) => {
      this.scheduleToggleSound(ctx, master);
    });
  }

  private scheduleToggleSound(ctx: AudioContext, master: GainNode) {
      const now = ctx.currentTime;
      [659.25, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.24, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

        osc.connect(gain);
        gain.connect(master);

        osc.start(start);
        osc.stop(start + 0.26);
      });
  }

  // Мягкий радио-чирп телеметрии (для пролога и субтитров)
  public playRadioChirp() {
    this.runWithContext((ctx, master) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.055);
    });
  }

  // Короткий низкий радиоквиток для подтверждения критического решения экипажа.
  public playDecisionConfirm() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      const carrier = ctx.createOscillator();
      const tone = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(1180, now);
      carrier.frequency.exponentialRampToValueAtTime(920, now + 0.11);
      tone.type = "sine";
      tone.frequency.setValueAtTime(440, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2100, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.012);
      gain.gain.setValueAtTime(0.12, now + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      carrier.connect(filter);
      tone.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      carrier.start(now);
      tone.start(now);
      carrier.stop(now + 0.17);
      tone.stop(now + 0.17);
    });
  }

  // 2. Радиосигнал квиндар-тона Apollo (NASA Quindar Beep) при новом задании
  public playTaskToast() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2525, now);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2475, now + 0.07);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.015);
      gain.gain.setValueAtTime(0.45, now + 0.055);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.065);

      gain.gain.setValueAtTime(0.4, now + 0.07);
      gain.gain.setValueAtTime(0.4, now + 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(master);

      osc1.start(now);
      osc1.stop(now + 0.065);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.19);
    });
  }

  // 3. Начало стройки: механический удар монтажа и металлический отклик
  public playBuildStart() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(500, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  // 4. Завершение стройки: мажорный 3-нотный перезвон (C5 - E5 - G5)
  public playBuildComplete() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // До, Ми, Соль
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.09;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

        osc.connect(gain);
        gain.connect(master);

        osc.start(start);
        osc.stop(start + 0.35);
      });
    });
  }

  // 5. Ремонт модуля: электрическая дуга и звук инструмента
  public playRepair() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.22);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      noise.start(now);
      noise.stop(now + 0.21);
    });
  }

  // 6. Тревожная сирена: солнечная вспышка, поломка или болезнь
  public playAlarm(kind: "flare" | "breakdown" | "illness") {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;

      if (kind === "flare") {
        // Сирена солнечной вспышки
        for (let cycle = 0; cycle < 3; cycle++) {
          const start = now + cycle * 0.28;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(880, start);
          osc.frequency.setValueAtTime(587.33, start + 0.14);

          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1600, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
          gain.gain.setValueAtTime(0.5, start + 0.23);
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

          osc.type = "square";
          osc.frequency.setValueAtTime(980, start);

          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(2200, start);

          gain.gain.setValueAtTime(0.4, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);

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

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.39);
      }
    });
  }

  // 7. Смена дня: аккорд восхода
  public playDayChange() {
    this.runWithContext((ctx, master) => {
      const now = ctx.currentTime;
      [440, 659.25, 880].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.75);
      });
    });
  }

  // 8. Наступление лунной ночи: глубокий космический гул
  public playNightfall() {
    this.runWithContext((ctx, master) => {
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
      gain.gain.linearRampToValueAtTime(0.5, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 1.35);
    });
  }

  // Переводит фон станции в более холодный ночной профиль без перезапуска аудио.
  public setNightMode(night: boolean) {
    this.ambientNight = night;
    const ctx = this.ctx;
    if (!ctx || !this.ambientOsc || !this.ambientHarmonicGain || !this.ambientNoiseGain) return;
    const now = ctx.currentTime;
    this.ambientOsc.frequency.setTargetAtTime(night ? 41.2 : 55, now, 2.8);
    this.ambientHarmonicGain.gain.setTargetAtTime(night ? 0.006 : 0.012, now, 2.4);
    this.ambientNoiseGain.gain.setTargetAtTime(night ? 0.018 : 0.028, now, 2.8);
  }

  private scheduleAmbientMusic(ctx: AudioContext) {
    if (!this.ambientRunning || this.muted || !this.ambientMusicGain) return;
    const notes = this.ambientNight
      ? [55, 0, 65.41, 0, 73.42, 0, 65.41, 0]
      : [82.41, 0, 98, 0, 110, 0, 98, 0];
    const step = this.ambientMusicStep++ % notes.length;
    const frequency = notes[step];
    const now = ctx.currentTime;
    if (frequency > 0) {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const toneFilter = ctx.createBiquadFilter();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, now);
      toneFilter.type = "lowpass";
      toneFilter.frequency.setValueAtTime(this.ambientNight ? 220 : 320, now);
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(this.ambientNight ? 0.035 : 0.028, now + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      osc.connect(toneFilter);
      toneFilter.connect(noteGain);
      noteGain.connect(this.ambientMusicGain);
      osc.start(now);
      osc.stop(now + 0.75);
      osc.onended = () => {
        osc.disconnect();
        toneFilter.disconnect();
        noteGain.disconnect();
      };
    }
    this.ambientMusicTimer = window.setTimeout(() => this.scheduleAmbientMusic(ctx), 900);
  }

  // 9. Победа: победный 5-нотный ретро-синт арпеджио
  public playVictory() {
    this.runWithContext((ctx, master) => {
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
        gain.gain.linearRampToValueAtTime(0.45, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);

        osc.connect(gain);
        gain.connect(master);

        osc.start(start);
        osc.stop(start + note.d + 0.05);

        offset += note.d * 0.85;
      });
    });
  }

  // 10. Поражение: нисходящий минорный аккорд
  public playDefeat() {
    this.runWithContext((ctx, master) => {
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
        gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 1.55);
      });
    });
  }

  // 11. Фоновый атмосферный гул жилого отсека (Ambient Cabin Hum)
  public startAmbient() {
    if (this.ambientRunning || typeof window === "undefined" || this.muted) return;
    if (this.ambientStopTimer !== null) {
      window.clearTimeout(this.ambientStopTimer);
      this.ambientStopTimer = null;
    }
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) {
      this.ambientPending = true;
      return;
    }

    if (ctx.state === "suspended") {
      this.ambientPending = true;
      ctx.resume().then(() => {
        if (this.ambientPending && !this.muted) {
          this.ambientPending = false;
          this.startAmbient();
        }
      }).catch(() => {});
      return;
    }

    try {
      const now = ctx.currentTime;
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.0001, now);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.08, now + 1.8);

      this.ambientMusicGain = ctx.createGain();
      this.ambientMusicGain.gain.setValueAtTime(0.0001, now);
      this.ambientMusicGain.gain.exponentialRampToValueAtTime(0.42, now + 2.8);
      this.ambientMusicGain.connect(this.ambientGain);

      // Низкочастотный ровный тон 55 Гц (генератор станции)
      this.ambientOsc = ctx.createOscillator();
      this.ambientOsc.type = "sine";
      this.ambientOsc.frequency.setValueAtTime(this.ambientNight ? 41.2 : 55, ctx.currentTime);

      // Тихий второй обертон добавляет ощущение работающего оборудования, не превращая гул в музыку.
      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonic.type = "sine";
      harmonic.frequency.setValueAtTime(82.4, now);
      harmonicGain.gain.setValueAtTime(0.0001, now);
      harmonicGain.gain.exponentialRampToValueAtTime(this.ambientNight ? 0.006 : 0.012, now + 2.2);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(this.ambientGain);
      this.ambientHarmonicGain = harmonicGain;

      // Фильтрованный шелест вентиляции
      const noiseBuffer = this.createNoiseBuffer(ctx, 18);
      this.ambientNoise = ctx.createBufferSource();
      this.ambientNoise.buffer = noiseBuffer;
      this.ambientNoise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(170, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(this.ambientNight ? 0.018 : 0.028, now + 1.6);
      this.ambientNoiseGain = noiseGain;

      this.ambientNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ambientGain);

      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.ambientOsc.start();
      harmonic.start();
      this.ambientNoise.start();
      // Медленная модуляция только воздуха: низкочастотный корпус остаётся стабильным.
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.09, now);
      lfoGain.gain.setValueAtTime(0.0025, now);
      lfo.connect(lfoGain);
      lfoGain.connect(noiseGain.gain);
      lfo.start();
      this.ambientOsc.onended = () => { try { harmonic.stop(); lfo.stop(); } catch { /* already stopped */ } };
      this.ambientRunning = true;
      this.ambientPending = false;
      this.scheduleAmbientMusic(ctx);
    } catch {
      this.ambientRunning = false;
    }
  }

  public stopAmbient() {
    this.ambientPending = false;
    if (!this.ambientRunning) return;
    const osc = this.ambientOsc;
    const noise = this.ambientNoise;
    const gain = this.ambientGain;
    const harmonicGain = this.ambientHarmonicGain;
    const noiseGain = this.ambientNoiseGain;
    const musicGain = this.ambientMusicGain;
    const ctx = this.ctx;
    this.ambientOsc = null;
    this.ambientNoise = null;
    this.ambientGain = null;
    this.ambientHarmonicGain = null;
    this.ambientNoiseGain = null;
    this.ambientMusicGain = null;
    this.ambientRunning = false;
    this.ambientMusicStep = 0;
    if (this.ambientMusicTimer !== null) {
      window.clearTimeout(this.ambientMusicTimer);
      this.ambientMusicTimer = null;
    }
    try {
      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime);
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
        this.ambientStopTimer = window.setTimeout(() => {
          try {
            osc?.stop();
            noise?.stop();
            osc?.disconnect();
            noise?.disconnect();
            gain.disconnect();
            harmonicGain?.disconnect();
            noiseGain?.disconnect();
            musicGain?.disconnect();
          } catch { /* already stopped */ }
          this.ambientStopTimer = null;
        }, 450);
      }
    } catch {
      // игнорируем ошибки остановки
    }
  }
}

export const sound = new SoundEngine();
