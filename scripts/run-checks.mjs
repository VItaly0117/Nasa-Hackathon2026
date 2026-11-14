#!/usr/bin/env node
// Прогоняет сценарии баланса из src/engine/checks.ts на настоящем движке, без браузера.
//
//   node scripts/run-checks.mjs            все проверки
//   node scripts/run-checks.mjs --report   дополнительно печатает итоговый разбор для каждого сценария
//
// Код возврата 1, если хоть одна проверка не прошла.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

let failed = 0;
try {
  const { runChecks } = await server.ssrLoadModule("/src/engine/checks.ts");
  for (const r of runChecks()) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}\n    ${r.detail}`);
  }

  if (process.argv.includes("--report")) {
    const { playMission } = await server.ssrLoadModule("/src/engine/checks.ts");
    const { buildReport } = await server.ssrLoadModule("/src/engine/debrief.ts");
    const scenarios = {
      "без построек": { builds: {}, choices: { breakdown: "repair", flare: "hide" } },
      "риск": { builds: {}, choices: { breakdown: "ignore", flare: "work" } },
    };
    for (const [name, strategy] of Object.entries(scenarios)) {
      const r = buildReport(playMission(strategy));
      console.log(`\n=== ${name}: ${r.title} [${r.rating}]\n${r.summary}`);
      for (const l of r.hurt) console.log(`  − ${l.text}`);
      for (const l of r.helped) console.log(`  + ${l.text}`);
      for (const l of r.facts) console.log(`  ★ ${l.text}${l.source ? ` (${l.source.label}: ${l.source.url})` : ""}`);
    }
  }
} finally {
  await server.close();
}

console.log(failed ? `\nНе прошло проверок: ${failed}` : "\nВсе проверки прошли");
process.exit(failed ? 1 : 0);
