// Процедурный звуковой движок лунной базы на Web Audio API.
// Синтезирует все звуки и фоновый эмбиент в реальном времени, без внешних файлов.
// Полностью автономен, устойчив к политикам автовоспроизведения браузеров и безопасен для SSR/тестов.

import { createOutputChain, MASTER_VOLUME } from "./chain";
import { createNoiseBuffer } from "./noise";
import * as effects from "./effects";

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private listeners = new Set<MuteListener>();
  private masterVolume = MASTER_VOLUME;

  // --- Фоновый космический гул (Cosmic Space Rumble / Ambient Drone) ---
  private spaceDroneWanted = true;
  private spaceDroneGain: GainNode | null = null;
  private spaceDroneNodes: { stop?: () => void; disconnect: () => void }[] = [];

  // --- Звуки во время строительства ---
  private buildingActive = false;
  private buildTimer: number | null = null;
  private buildHumGain: GainNode | null = null;
  private buildHumOsc: OscillatorNode | null = null;

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
        const chain = createOutputChain(this.ctx, this.muted ? 0 : this.masterVolume);
        this.masterGain = chain.master;
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
        if (!this.muted && this.masterGain) {
          if (this.spaceDroneWanted && !this.spaceDroneGain) {
            this.initSpaceDrone(ctx, this.masterGain);
          }
          if (this.buildingActive && !this.buildHumGain) {
            this.startBuildingLoop();
          }
        }
      }).catch(() => {});
    } else {
      if (!this.muted && this.masterGain) {
        if (this.spaceDroneWanted && !this.spaceDroneGain) {
          this.initSpaceDrone(ctx, this.masterGain);
        }
        if (this.buildingActive && !this.buildHumGain) {
          this.startBuildingLoop();
        }
      }
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
    if (!mute) {
      const ctx = this.getContext();
      if (ctx && this.masterGain) {
        if (this.spaceDroneWanted && !this.spaceDroneGain) {
          this.initSpaceDrone(ctx, this.masterGain);
        }
        if (this.buildingActive && !this.buildHumGain) {
          this.startBuildingLoop();
        }
      }
    }
    this.notify();
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    if (!next) this.unlock();
    this.setMuted(next);
    if (!next) {
      this.runWithContext(effects.toggleSound);
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

  // --- Фоновый космічний гул (Cosmic Ambient Space Rumble) ---
  public startSpaceDrone() {
    this.spaceDroneWanted = true;
    this.runWithContext((ctx, master) => {
      this.initSpaceDrone(ctx, master);
    });
  }

  public stopSpaceDrone() {
    this.spaceDroneWanted = false;
    this.teardownSpaceDrone();
  }

  public setSpaceDrone(enabled: boolean) {
    if (enabled) {
      this.startSpaceDrone();
    } else {
      this.stopSpaceDrone();
    }
  }

  private initSpaceDrone(ctx: AudioContext, master: GainNode) {
    if (this.spaceDroneGain || this.muted) return;
    try {
      const now = ctx.currentTime;
      const droneMaster = ctx.createGain();
      droneMaster.gain.setValueAtTime(0.0001, now);
      droneMaster.gain.linearRampToValueAtTime(0.42, now + 1.8); // Глибоке, виразне, але комфортне звучання
      droneMaster.connect(master);
      this.spaceDroneGain = droneMaster;

      const nodes: { stop?: () => void; disconnect: () => void }[] = [];

      // 1. Глибокий низькочастотний гул космічного корпусу (55 Гц і 56.5 Гц для повільного биття 1.5 Гц)
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = "lowpass";
      subFilter.frequency.setValueAtTime(140, now);
      subFilter.connect(droneMaster);
      nodes.push({ disconnect: () => subFilter.disconnect() });

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.28, now);
      subGain.connect(subFilter);
      nodes.push({ disconnect: () => subGain.disconnect() });

      [55, 56.5].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(subGain);
        osc.start(now);
        nodes.push({
          stop: () => { try { osc.stop(); } catch {} },
          disconnect: () => osc.disconnect(),
        });
      });

      // Додатковий теплий трикутний суб-тон (110 Гц)
      const subMid = ctx.createOscillator();
      const subMidGain = ctx.createGain();
      subMid.type = "triangle";
      subMid.frequency.setValueAtTime(110, now);
      subMidGain.gain.setValueAtTime(0.12, now);
      subMid.connect(subMidGain);
      subMidGain.connect(subFilter);
      subMid.start(now);
      nodes.push({
        stop: () => { try { subMid.stop(); } catch {} },
        disconnect: () => { subMid.disconnect(); subMidGain.disconnect(); },
      });

      // 2. Подих вакууму та сонячного вітру (рожевий шум з повільною LFO-фільтрацією)
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 4.0);
      noise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(160, now);
      noiseFilter.Q.setValueAtTime(1.8, now);

      // Повільний LFO (період ~16 сек): фільтр шуму плавно коливається між 90 і 250 Гц
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.06, now);
      lfoGain.gain.setValueAtTime(65, now);
      lfo.connect(lfoGain);
      lfoGain.connect(noiseFilter.frequency);
      lfo.start(now);
      nodes.push({
        stop: () => { try { lfo.stop(); } catch {} },
        disconnect: () => { lfo.disconnect(); lfoGain.disconnect(); },
      });

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(droneMaster);
      noise.start(now);
      nodes.push({
        stop: () => { try { noise.stop(); } catch {} },
        disconnect: () => { noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); },
      });

      // 3. Ембієнт-гармоніка відкритого космосу (квинта 146.8 Гц [Ре3] і 220 Гц [Ля3])
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.setValueAtTime(320, now);
      padFilter.connect(droneMaster);
      nodes.push({ disconnect: () => padFilter.disconnect() });

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.08, now);
      padGain.connect(padFilter);
      nodes.push({ disconnect: () => padGain.disconnect() });

      [146.83, 220.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(padGain);
        osc.start(now);
        nodes.push({
          stop: () => { try { osc.stop(); } catch {} },
          disconnect: () => osc.disconnect(),
        });
      });

      this.spaceDroneNodes = nodes;
    } catch {
      // Ігноруємо в разі обмежень середовища
    }
  }

  private teardownSpaceDrone() {
    if (!this.spaceDroneGain || !this.ctx) return;
    const gain = this.spaceDroneGain;
    const nodes = this.spaceDroneNodes;
    this.spaceDroneGain = null;
    this.spaceDroneNodes = [];

    const now = this.ctx.currentTime;
    try {
      gain.gain.setTargetAtTime(0.0001, now, 0.4);
    } catch {}

    setTimeout(() => {
      nodes.forEach((n) => {
        try { n.stop?.(); } catch {}
        try { n.disconnect(); } catch {}
      });
      try { gain.disconnect(); } catch {}
    }, 1200);
  }

  // --- Звуки під час будівництва ---
  public setBuildingActive(active: boolean) {
    if (this.buildingActive === active) return;
    this.buildingActive = active;

    if (active) {
      this.startBuildingLoop();
    } else {
      this.stopBuildingLoop();
    }
  }

  private startBuildingLoop() {
    if (!this.buildingActive || this.muted) return;

    this.runWithContext((ctx, master) => {
      // Неперервний низький гул будівельного генератора / сервоприводів
      if (!this.buildHumGain) {
        try {
          const now = ctx.currentTime;
          const humGain = ctx.createGain();
          humGain.gain.setValueAtTime(0.0001, now);
          humGain.gain.linearRampToValueAtTime(0.05, now + 0.25);

          const humOsc = ctx.createOscillator();
          humOsc.type = "sine";
          humOsc.frequency.setValueAtTime(110, now);

          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(220, now);

          humOsc.connect(filter);
          filter.connect(humGain);
          humGain.connect(master);
          humOsc.start(now);

          this.buildHumOsc = humOsc;
          this.buildHumGain = humGain;
        } catch {}
      }

      // Періодичні монтажні імпульси (пневмозатяжка та лазерна пайка)
      if (this.buildTimer === null) {
        const trigger = () => {
          if (!this.buildingActive) return;
          this.runWithContext(effects.constructionPulse);
          if (typeof window !== "undefined" && this.buildingActive) {
            this.buildTimer = window.setTimeout(trigger, 520);
          }
        };
        trigger();
      }
    });
  }

  private stopBuildingLoop() {
    if (this.buildTimer !== null) {
      if (typeof window !== "undefined") window.clearTimeout(this.buildTimer);
      this.buildTimer = null;
    }

    if (this.buildHumGain && this.ctx) {
      const humGain = this.buildHumGain;
      const humOsc = this.buildHumOsc;
      this.buildHumGain = null;
      this.buildHumOsc = null;

      try {
        humGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
      } catch {}

      setTimeout(() => {
        try { humOsc?.stop(); humOsc?.disconnect(); } catch {}
        try { humGain.disconnect(); } catch {}
      }, 300);
    }
  }

  // --- Звуки (тембри і гучності в effects.ts) ---
  public playClick() { this.runWithContext(effects.click); }
  public playToggleSound() { this.runWithContext(effects.toggleSound); }
  public playRadioChirp() { this.runWithContext(effects.radioChirp); }
  public playDecisionConfirm() { this.runWithContext(effects.decisionConfirm); }
  public playTaskToast() { this.runWithContext(effects.taskToast); }
  public playBuildStart() { this.runWithContext(effects.buildStart); }
  public playBuildComplete() { this.runWithContext(effects.buildComplete); }
  public playRepair() { this.runWithContext(effects.repair); }
  public playAlarm(kind: "flare" | "breakdown" | "illness") { this.runWithContext((ctx, master) => effects.alarm(ctx, master, kind)); }
  public playDayChange() { this.runWithContext(effects.dayChange); }
  public playNightfall() { this.runWithContext(effects.nightfall); }
  public playVictory() { this.runWithContext(effects.victory); }
  public playDefeat() { this.runWithContext(effects.defeat); }
  public playTimerTick(isTock = false, secondsLeft = 15) {
    this.runWithContext((ctx, master) => effects.timerTick(ctx, master, isTock, secondsLeft));
  }
}

export const sound = new SoundEngine();