import { expect, test } from "@playwright/test";

// Автоматическая «оценка на слух» (на слух проверить нельзя): каждый звук рендерится офлайн через тот же выход, что и в игре,
// и проверяется по числам. Громкость не выше порога (не оглушает), не тише порога (слышно), нет «писка» (мало энергии выше 4 кГц),
// звук заканчивается (в конце тишина), нет сдвига нуля.
const LIMITS = { peakMax: 0.5, peakMin: 0.04, highShareMax: 0.05, tailMax: 0.01, durationMax: 2.5 };

test("все звуки в пределах громкости и без писка", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const effects = await import("/src/audio/effects.ts" as string);
    const { createOutputChain, MASTER_VOLUME } = await import("/src/audio/chain.ts" as string);
    const RATE = 44100;
    const SECONDS = 2.5;

    // Быстрое преобразование Фурье: доля энергии выше 4 кГц
    function highShare(data: Float32Array): number {
      const n = 16384;
      const re = new Float64Array(n);
      const im = new Float64Array(n);
      for (let i = 0; i < Math.min(n, data.length); i++) re[i] = data[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [re[i], re[j]] = [re[j], re[i]];
      }
      for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len) {
          for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(ang * k);
            const wi = Math.sin(ang * k);
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
            const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
            re[i + k] = ur + vr; im[i + k] = ui + vi;
            re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          }
        }
      }
      let total = 0, high = 0;
      for (let b = 1; b < n / 2; b++) {
        const e = re[b] * re[b] + im[b] * im[b];
        total += e;
        if ((b * RATE) / n > 4000) high += e;
      }
      return total ? high / total : 0;
    }

    const makers: Record<string, (ctx: OfflineAudioContext, master: GainNode) => void> = {
      click: effects.click, toggleSound: effects.toggleSound, radioChirp: effects.radioChirp, decisionConfirm: effects.decisionConfirm,
      taskToast: effects.taskToast, buildStart: effects.buildStart, constructionPulse: effects.constructionPulse, buildComplete: effects.buildComplete, repair: effects.repair,
      timerTick: (c, m) => effects.timerTick(c, m, false, 10),
      timerTickUrgent: (c, m) => effects.timerTick(c, m, false, 3),
      alarmFlare: (c, m) => effects.alarm(c, m, "flare"), alarmBreakdown: (c, m) => effects.alarm(c, m, "breakdown"), alarmIllness: (c, m) => effects.alarm(c, m, "illness"),
      dayChange: effects.dayChange, nightfall: effects.nightfall, victory: effects.victory, defeat: effects.defeat,
    };
    const out: Record<string, { peak: number; highShare: number; tail: number; dc: number }> = {};
    for (const [name, make] of Object.entries(makers)) {
      const ctx = new OfflineAudioContext(1, RATE * SECONDS, RATE);
      const { master } = createOutputChain(ctx, MASTER_VOLUME);
      make(ctx, master);
      const data = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, sum = 0, tail = 0;
      for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); sum += data[i]; }
      for (let i = data.length - RATE * 0.1; i < data.length; i++) tail = Math.max(tail, Math.abs(data[i]));
      out[name] = { peak, highShare: highShare(data), tail, dc: Math.abs(sum / data.length) };
    }
    return out;
  });

  const report = Object.entries(results).map(([n, r]) => `${n}: пик ${r.peak.toFixed(2)}, выше 4 кГц ${(100 * r.highShare).toFixed(1)}%, хвост ${r.tail.toFixed(3)}`);
  console.log(report.join("\n"));
  for (const [name, r] of Object.entries(results)) {
    expect(r.peak, `${name}: слишком громкий`).toBeLessThanOrEqual(LIMITS.peakMax);
    expect(r.peak, `${name}: почти не слышно`).toBeGreaterThanOrEqual(LIMITS.peakMin);
    expect(r.highShare, `${name}: писк (много выше 4 кГц)`).toBeLessThanOrEqual(LIMITS.highShareMax);
    expect(r.tail, `${name}: не заканчивается за ${LIMITS.durationMax} с`).toBeLessThanOrEqual(LIMITS.tailMax);
    expect(r.dc, `${name}: сдвиг нуля`).toBeLessThan(0.01);
  }
});
