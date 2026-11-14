// Процедурный ретро-звуковой движок на Web Audio API.
// Синтезирует все звуки в реальном времени, без внешних файлов.
// Полностью автономен, устойчив к политикам автовоспроизведения браузеров и безопасен для SSR/тестов.

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientRunning = false;
  private ambientPending = false;
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
        this.masterGain.connect(this.ctx.destination);
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
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime, 0.015);
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
    this.setMuted(next);
    if (!next) {
      // Подтверждающий чистый перезвон при включении звука
      this.playToggleSound();
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
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
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
      const now = ctx.currentTime;
      [523.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(master);

        osc.start(start);
        osc.stop(start + 0.22);
      });
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
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.08, ctx.currentTime);

      // Низкочастотный ровный тон 55 Гц (генератор станции)
      this.ambientOsc = ctx.createOscillator();
      this.ambientOsc.type = "sine";
      this.ambientOsc.frequency.setValueAtTime(55, ctx.currentTime);

      // Фильтрованный шелест вентиляции
      const noiseBuffer = this.createNoiseBuffer(ctx, 3);
      this.ambientNoise = ctx.createBufferSource();
      this.ambientNoise.buffer = noiseBuffer;
      this.ambientNoise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(140, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);

      this.ambientNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ambientGain);

      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.ambientOsc.start();
      this.ambientNoise.start();
      this.ambientRunning = true;
      this.ambientPending = false;
    } catch {
      this.ambientRunning = false;
    }
  }

  public stopAmbient() {
    this.ambientPending = false;
    if (!this.ambientRunning) return;
    try {
      this.ambientOsc?.stop();
      this.ambientNoise?.stop();
      this.ambientOsc?.disconnect();
      this.ambientNoise?.disconnect();
      this.ambientGain?.disconnect();
    } catch {
      // игнорируем ошибки остановки
    }
    this.ambientOsc = null;
    this.ambientNoise = null;
    this.ambientGain = null;
    this.ambientRunning = false;
  }
}

export const sound = new SoundEngine();
