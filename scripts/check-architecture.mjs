#!/usr/bin/env node
// Границы слоёв (см. docs/ARCHITECTURE_REFACTOR.md). Читает импорты и падает, если кто-то нарушил правило.
// Тесты (checks.ts) в проверку не входят: они по определению видят все слои.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// слой по пути файла
const layerOf = (file) => relative(SRC, file).split("/")[0];

// какие слои запрещено импортировать из данного слоя
const FORBIDDEN = {
  engine: ["i18n", "ui", "audio", "net", "session", "features", "app"],
  // сессия (хранилище, сеть) знает про ядро и данные, но не про интерфейс и звук
  session: ["ui", "audio", "features", "app"],
};
const EXEMPT = new Set(["engine/checks.ts"]);

const IMPORT = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const problems = [];

for (const file of walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const rel = relative(SRC, file);
  if (EXEMPT.has(rel)) continue;
  const layer = layerOf(file);
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2];
    if (spec === "react" || spec.startsWith("react/") || spec.startsWith("react-dom")) {
      if (layer === "engine") problems.push(`${rel}: ядро не должно импортировать React (${spec})`);
      continue;
    }
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
    const resolved = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : resolve(dirname(file), spec);
    const target = layerOf(resolved);
    // снаружи ядро импортируется только через публичный API (engine/index.ts), а не по внутренним файлам
    const insideEngine = relative(join(SRC, "engine"), resolved);
    if (layer !== "engine" && target === "engine" && insideEngine && !insideEngine.startsWith("..") && insideEngine !== "index") {
      problems.push(`${rel}: ядро импортируется по внутреннему пути (${spec}), нужно из "@/engine"`);
    }
    if ((FORBIDDEN[layer] ?? []).includes(target)) problems.push(`${rel}: слой «${layer}» не должен импортировать слой «${target}» (${spec})`);
  }
}

if (problems.length) {
  console.error(`✗ Нарушены границы слоёв (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ Границы слоёв соблюдены: ядро чистое, сессия не знает про интерфейс, ядро импортируется через engine/index.ts");
