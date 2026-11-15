// Процедурный ретро-звуковой движок на Web Audio API.
// Синтезирует все звуки в реальном времени, без внешних файлов.
// Полностью автономен, устойчив к политикам автовоспроизведения браузеров и безопасен для SSR/тестов.

import { createOutputChain, MASTER_VOLUME } from "./chain";
import * as effects from "./effects";

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private listeners = new Set<MuteListener>();
  private masterVolume = MASTER_VOLUME;

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
      ctx.resume().catch(() => {});
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
    this.notify();
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    // Разбудить Web Audio синхронно с кликом: это важно для autoplay-политик Safari.
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

  // --- Звуки (тембры и громкости в effects.ts) ---
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

}

export const sound = new SoundEngine();
