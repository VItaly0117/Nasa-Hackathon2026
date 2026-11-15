#!/usr/bin/env node
// Отчёт по балансу: роботы-игроки с разными стратегиями проходят миссию на многих seed.
// Числа игры не меняются: скрипт только считает и печатает таблицу (Markdown).
//
//   node scripts/balance-report.mjs [число seed, по умолчанию 200]

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2]) || 200;

const CAREFUL = { breakdown: "repair", flare: "hide", illness: "treat" };
const RECKLESS = { breakdown: "ignore", flare: "work", illness: "ignore" };
const PREPARED = {
  1: ["solar", "solar", "solar", "greenhouse"],
  2: ["rockMine", "iceMine"],
  3: ["shelter"],
  5: ["battery", "solar"],
  7: ["battery"],
  9: ["battery"],
  11: ["battery"],
};
const STRATEGIES = {
  "без построек, осторожно": { builds: {}, choices: CAREFUL },
  "без построек, рискованно": { builds: {}, choices: RECKLESS },
  "подготовка, осторожно": { builds: PREPARED, choices: CAREFUL },
  "подготовка, рискованно": { builds: PREPARED, choices: RECKLESS },
};
const SEEDS = Array.from({ length: N }, (_, i) => i + 1);

const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const engine = await server.ssrLoadModule("/src/engine/index.ts");
  const { initialState, reduce, MISSION_DAYS, canPlace, slotOf, MAP_ROWS, MAP_COLS } = engine;

  function tryBuild(state, type) {
    for (let row = 0; row < MAP_ROWS; row++)
      for (let col = 0; col < MAP_COLS; col++)
        if (canPlace(state, type, row, col)) return reduce(state, { type: "build", slot: slotOf(row, col), module: type });
    return state;
  }

  function play(strategy, seed) {
    let s = initialState(seed);
    const queue = [];
    let queuedDay = 0;
    for (let step = 0; step < MISSION_DAYS * 3 && s.status === "playing"; step++) {
      if (s.activeEvent) {
        s = reduce(s, { type: "resolveEvent", choice: strategy.choices[s.activeEvent] });
        continue;
      }
      if (queuedDay !== s.day) {
        queuedDay = s.day;
        queue.push(...(strategy.builds[s.day] ?? []));
      }
      for (let i = 0; i < queue.length; ) {
        const next = tryBuild(s, queue[i]);
        if (next === s) i++;
        else {
          s = next;
          queue.splice(i, 1);
        }
      }
      s = reduce(s, { type: "nextDay" });
    }
    return s;
  }

  const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;
  console.log(`| Стратегия | Побед | Среднее здоровье при победе | Средний день поражения | Главная причина поражения |`);
  console.log(`|---|---|---|---|---|`);
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const runs = SEEDS.map((seed) => play(strategy, seed));
    const won = runs.filter((s) => s.status === "won");
    const lost = runs.filter((s) => s.status !== "won");
    const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "—");
    // Причина: какие запасы к концу были на нуле (если их нет, значит добило иначе: вспышка, болезнь)
    const reasons = {};
    for (const s of lost) {
      const zero = ["oxygen", "water", "food", "energy"].filter((k) => s.resources[k] <= 0);
      const key = zero.length ? zero.join("+") : "вспышка или болезнь";
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    console.log(`| ${name} | ${pct(won.length, runs.length)} | ${avg(won.map((s) => s.resources.health))} | ${avg(lost.map((s) => s.day))} | ${top ? `${top[0]} (${pct(top[1], lost.length)} поражений)` : "—"} |`);
  }
} finally {
  await server.close();
}
