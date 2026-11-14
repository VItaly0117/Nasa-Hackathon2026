// Процедурный ретро-звуковой движок на Web Audio API.
// Работает без внешних файлов и библиотек: все звуки синтезируются в реальном времени.
// Безопасен для запуска вне браузера (тесты, SSR).

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientRunning = false;
  private muted = false;
  private listeners = new Set<MuteListener>();
  private masterVolume = 0.28; // мягкая базовая громкость

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("moonbase:muted");
        this.muted = saved === "true";
      } catch {
        this.muted = false;
      }
    }
  }

  // Ленивая инициализация AudioContext по первому клику игрока
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
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
        // игнорируем ошибки хранилища
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playClick();
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

  // Генератор белого шума в аудио-буфере (для эффектов сварки, ветра и шороха реголита)
  private createNoiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // 1. Короткий тактильный клик интерфейса
  public playClick() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.036);
  }

  // 2. Радиосигнал квиндар-тона (Apollo Quindar Beep) при получении нового задания
  public playTaskToast() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    // Знаменитые тоны связи NASA Apollo: 2525 Гц, за ним 2475 Гц
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(2525, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(2475, now + 0.06);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.setValueAtTime(0.15, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.055);

    gain.gain.setValueAtTime(0.12, now + 0.06);
    gain.gain.setValueAtTime(0.12, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + 0.055);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.16);
  }

  // 3. Начало стройки: механический щелчок монтажа и металлический отклик
  public playBuildStart() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, now);
    filter.Q.setValueAtTime(4, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 4. Завершение стройки: жизнеутверждающий трёхнотный перезвон (C5 - E5 - G5)
  public playBuildComplete() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // До, Ми, Соль второй октавы
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.09;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  // 5. Ремонт модуля: искрение и звук инструмента
  public playRepair() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;

    // Вспышка шума
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.19);
  }

  // 6. Тревожная сирена: солнечная вспышка, поломка или болезнь
  public playAlarm(kind: "flare" | "breakdown" | "illness") {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;

    if (kind === "flare") {
      // Мощная двухтональная космическая сирена (880 Гц / 587 Гц)
      for (let cycle = 0; cycle < 3; cycle++) {
        const start = now + cycle * 0.26;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, start);
        osc.frequency.setValueAtTime(587.33, start + 0.13);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.setValueAtTime(0.18, start + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.26);
      }
    } else if (kind === "breakdown") {
      // Предупреждающий частый двойной писк аварии жизнеобеспечения
      for (let i = 0; i < 2; i++) {
        const start = now + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(980, start);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2000, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.1);
      }
    } else {
      // Болезнь астронавта: нисходящий тревожный тон
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  // 7. Смена дня: мягкий космический аккорд восхода
  public playDayChange() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const freqs = [440, 659.25, 880]; // Ля мажорный призвук
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.65);
    });
  }

  // 8. Наступление лунной ночи: глубокий низкий космический гул
  public playNightfall() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.35);
  }

  // 9. Победа: победный 5-нотный ретро-синт арпеджио
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const melody = [
      { f: 261.63, d: 0.14 }, // C4
      { f: 329.63, d: 0.14 }, // E4
      { f: 392.0, d: 0.14 },  // G4
      { f: 523.25, d: 0.22 }, // C5
      { f: 659.25, d: 0.55 }, // E5
    ];

    let offset = 0;
    melody.forEach((note) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.f, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(start);
      osc.stop(start + note.d + 0.05);

      offset += note.d * 0.85;
    });
  }

  // 10. Поражение: меланхоличный спадающий минорный аккорд
  public playDefeat() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const chords = [220, 261.63, 311.13]; // Ля-минор/диссонанс
    chords.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 1.4);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 1.4);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 1.55);
    });
  }

  // 11. Фоновый атмосферный гул жилого отсека (Ambient Cabin Hum)
  public startAmbient() {
    if (this.ambientRunning || typeof window === "undefined") return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.018, ctx.currentTime);

      // Очень низкочастотный ровный тон 55 Гц (вибрация генератора станции)
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
      noiseFilter.frequency.setValueAtTime(120, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.012, ctx.currentTime);

      this.ambientNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ambientGain);

      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.ambientOsc.start();
      this.ambientNoise.start();
      this.ambientRunning = true;
    } catch {
      // Игнорируем в случае ограничений браузера
    }
  }

  public stopAmbient() {
    if (!this.ambientRunning) return;
    try {
      this.ambientOsc?.stop();
      this.ambientNoise?.stop();
      this.ambientOsc?.disconnect();
      this.ambientNoise?.disconnect();
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
