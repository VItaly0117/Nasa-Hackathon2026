// Фон станции: низкий гул, шелест вентиляции и тихая «музыка» из нескольких нот. Включается при старте миссии, на ночь становится глуше.
import { createNoiseBuffer } from "./noise";

// Что фону нужно от движка звука: контекст, общий выход и признак «звук выключен»
export type AmbientHost = {
  getContext(): AudioContext | null;
  currentContext(): AudioContext | null;
  master(): GainNode | null;
  isMuted(): boolean;
};

export class Ambient {
  private host: AmbientHost;

  constructor(host: AmbientHost) {
    this.host = host;
  }

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

// Переводит фон станции в более холодный ночной профиль без перезапуска аудио.
  public setNightMode(night: boolean) {
    this.ambientNight = night;
    const ctx = this.host.currentContext();
    if (!ctx || !this.ambientOsc || !this.ambientHarmonicGain || !this.ambientNoiseGain) return;
    const now = ctx.currentTime;
    this.ambientOsc.frequency.setTargetAtTime(night ? 41.2 : 55, now, 2.8);
    this.ambientHarmonicGain.gain.setTargetAtTime(night ? 0.006 : 0.012, now, 2.4);
    this.ambientNoiseGain.gain.setTargetAtTime(night ? 0.018 : 0.028, now, 2.8);
  }

  private scheduleAmbientMusic(ctx: AudioContext) {
    if (!this.ambientRunning || this.host.isMuted() || !this.ambientMusicGain) return;
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

// 11. Фоновый атмосферный гул жилого отсека (Ambient Cabin Hum)
  public startAmbient() {
    if (this.ambientRunning || typeof window === "undefined" || this.host.isMuted()) return;
    if (this.ambientStopTimer !== null) {
      window.clearTimeout(this.ambientStopTimer);
      this.ambientStopTimer = null;
    }
    const ctx = this.host.getContext();
    const master = this.host.master();
    if (!ctx || !master) {
      this.ambientPending = true;
      return;
    }

    if (ctx.state === "suspended") {
      this.ambientPending = true;
      ctx.resume().then(() => {
        if (this.ambientPending && !this.host.isMuted()) {
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
      const noiseBuffer = createNoiseBuffer(ctx, 18);
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
      this.ambientGain.connect(master);

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
    const ctx = this.host.currentContext();
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

  // Контекст «проснулся» после жеста игрока: если фон ждал разрешения, запускаем
  public resumePending() {
    if (this.ambientPending && !this.host.isMuted()) {
      this.ambientPending = false;
      this.startAmbient();
    }
  }
}
