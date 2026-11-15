// Общий выход звука: громкость → мягкий срез верха → компрессор → колонки.
// Отдельным файлом, чтобы движок и проверка громкости (e2e/sound.spec.ts) строили один и тот же выход.

export const MASTER_VOLUME = 0.5; // Спокойная громкость: раньше 0.85, звуки были резкими
export const SOFTEN_HZ = 2800;

export type OutputChain = { master: GainNode; compressor: DynamicsCompressorNode };

export function createOutputChain(ctx: BaseAudioContext, volume: number): OutputChain {
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, t);
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, t);
  compressor.knee.setValueAtTime(12, t);
  compressor.ratio.setValueAtTime(4, t);
  compressor.attack.setValueAtTime(0.004, t);
  compressor.release.setValueAtTime(0.18, t);
  // Мягкий срез верха: убирает свист и «пластмассовую» резкость у всех звуков сразу
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.setValueAtTime(SOFTEN_HZ, t);
  soften.Q.setValueAtTime(0.5, t);
  master.connect(soften);
  soften.connect(compressor);
  compressor.connect(ctx.destination);
  return { master, compressor };
}
