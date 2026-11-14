#!/usr/bin/env node
// Качает РЕАЛЬНЫЕ солнечные вспышки из NASA DONKI и сохраняет в src/data/nasa/flares.json.
// Запускается ОДИН раз (результат лежит в репозитории, игре интернет не нужен):
//
//   node scripts/fetch-donki.mjs
//   node scripts/fetch-donki.mjs --from 2023-01-01 --to 2026-10-31 --min M1   (по умолчанию: с 2024-01-01 по сегодня, класс M5 и выше)
//
// Источник: DONKI (Space Weather Database Of Notifications, Knowledge, Information), NASA CCMC.
// Основной адрес работает без ключа. Запасной: NASA Open APIs (api.nasa.gov), ключ в NASA_API_KEY (по умолчанию DEMO_KEY).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/nasa/flares.json");
const CCMC = "https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR";
const API_NASA = "https://api.nasa.gov/DONKI/FLR";
const API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

// --- аргументы ---------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith("--") ? [[a.slice(2), all[i + 1]]] : [])),
);
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const from = new Date(args.from ?? "2024-01-01");
const to = new Date(args.to ?? iso(today));
const MIN_CLASS = (args.min ?? "M5").toUpperCase(); // C/M/X + число. Берём сильные вспышки: их мало и они зрелищные
const CHUNK_DAYS = 30; // DONKI отдаёт по умолчанию 30 дней, чанки надёжнее одного большого запроса

// --- класс вспышки -> число для сравнения (C1.0 < M1.0 < X1.0) -------------------
const LETTER_POWER = { A: 0, B: 1, C: 2, M: 3, X: 4 };
function classPower(classType) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/i.exec(classType ?? "");
  if (!m) return -1;
  return LETTER_POWER[m[1].toUpperCase()] * 1000 + parseFloat(m[2]);
}
const MIN_POWER = classPower(MIN_CLASS);
if (MIN_POWER < 0) {
  console.error(`Неверный --min "${args.min}". Пример: M1, M5.5, X1`);
  process.exit(1);
}

// --- сеть ------------------------------------------------------------------------
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : []; // DONKI на пустой период отдаёт пустое тело
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChunk(start, end) {
  const q = `startDate=${iso(start)}&endDate=${iso(end)}`;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await getJson(`${CCMC}?${q}`);
    } catch (err) {
      lastErr = err;
      process.stdout.write(`(попытка ${attempt}: ${err.message}) `);
      await sleep(1500 * attempt);
    }
  }
  // CCMC лежит: пробуем вход через NASA Open APIs
  try {
    return await getJson(`${API_NASA}?${q}&api_key=${API_KEY}`);
  } catch (err) {
    throw new Error(`DONKI недоступен для ${q}: CCMC: ${lastErr.message}; api.nasa.gov: ${err.message}`);
  }
}

// --- сборка ----------------------------------------------------------------------
const byId = new Map();
for (let start = new Date(from); start <= to; ) {
  const end = new Date(Math.min(start.getTime() + (CHUNK_DAYS - 1) * 86_400_000, to.getTime()));
  process.stdout.write(`${iso(start)} → ${iso(end)} … `);
  const rows = await fetchChunk(start, end);
  let kept = 0;
  for (const f of rows) {
    if (!f.flrID || classPower(f.classType) < MIN_POWER) continue;
    byId.set(f.flrID, {
      id: f.flrID,
      date: (f.peakTime ?? f.beginTime).slice(0, 10), // день пика вспышки, YYYY-MM-DD
      peakTime: f.peakTime ?? f.beginTime, // ISO UTC, например 2024-05-01T06:57Z
      class: f.classType, // например "X1.2"
      location: f.sourceLocation || null, // положение на диске Солнца, например "S15W76"
      activeRegion: f.activeRegionNum ?? null,
      link: f.link, // страница вспышки в DONKI: подпись источника в игре
      source: "NASA DONKI",
    });
    kept++;
  }
  console.log(`${rows.length} найдено, ${kept} ≥ ${MIN_CLASS}`);
  start = new Date(end.getTime() + 86_400_000);
  await sleep(250); // не долбим API
}

const flares = [...byId.values()].sort((a, b) => a.peakTime.localeCompare(b.peakTime));
if (flares.length === 0) {
  console.error("Ни одной вспышки не получили. Файл не перезаписан.");
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(flares, null, 2) + "\n");

const x = flares.filter((f) => f.class.startsWith("X")).length;
console.log(`\nГотово: ${flares.length} вспышек (из них класса X: ${x}) → ${OUT}`);
