#!/usr/bin/env node
// «Золотой прогон»: страховка для рефакторинга. Игрок-робот проходит миссию на 20 seed × 3 стратегии,
// а итоговое состояние (без текстов журнала и причин отложенных эффектов: они зависят от языка) сворачивается в хеш.
// Если рефакторинг не менял поведение, хеши до и после совпадают.
//
//   node scripts/golden-replay.mjs --write   записать снимок в docs/baseline/golden.json
//   node scripts/golden-replay.mjs --check   сравнить с записанным снимком (код возврата 1 при расхождении)

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(root, "docs/baseline/golden.json");
const mode = process.argv.includes("--write") ? "write" : "check";

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
  idle: { builds: {}, choices: CAREFUL },
  careless: { builds: {}, choices: RECKLESS },
  prepared: { builds: PREPARED, choices: CAREFUL },
};
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

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

  // Проекция состояния, не зависящая от языка: без журнала и без текстов причин отложенных эффектов
  const project = (s) => {
    const { log: _log, ...rest } = s;
    return { ...rest, pending: s.pending.map(({ reason: _r, ...p }) => p) };
  };
  const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

  const runs = [];
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    for (const seed of SEEDS) {
      const s = play(strategy, seed);
      runs.push({ strategy: name, seed, hash: hash(project(s)), status: s.status, day: s.day, health: s.resources.health });
    }
  }

  if (mode === "write") {
    writeFileSync(FILE, JSON.stringify({ seeds: SEEDS.length, strategies: Object.keys(STRATEGIES), runs }, null, 1) + "\n");
    const wins = runs.filter((r) => r.status === "won").length;
    console.log(`Записано ${runs.length} прогонов в docs/baseline/golden.json (побед: ${wins}, поражений: ${runs.length - wins})`);
  } else {
    const saved = JSON.parse(readFileSync(FILE, "utf8"));
    const bad = runs.filter((r, i) => saved.runs[i]?.hash !== r.hash);
    if (bad.length) {
      console.error(`✗ Расхождение в ${bad.length} из ${runs.length} прогонов (поведение изменилось):`);
      for (const r of bad.slice(0, 8)) console.error(`  ${r.strategy} seed ${r.seed}: ${r.status}, день ${r.day}`);
      process.exitCode = 1;
    } else {
      console.log(`✓ Золотой прогон совпадает: ${runs.length} прогонов`);
    }
  }
} finally {
  await server.close();
}
