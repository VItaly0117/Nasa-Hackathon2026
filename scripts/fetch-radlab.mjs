#!/usr/bin/env node
// Качает РЕАЛЬНЫЕ измерения дозы радиации на МКС из NASA OSDR RadLab (Data API) и сохраняет сводку
// по дням в src/content/nasa/radiation.json. Берутся дни со вспышками из src/content/nasa/flares.json,
// на которые у RadLab есть измерения дозиметров DosTel (мощность поглощённой дозы, мкГр/час).
//
//   node scripts/fetch-radlab.mjs            все вспышки из flares.json
//   node scripts/fetch-radlab.mjs 2024-06    только даты, начинающиеся с этого префикса
//
// Документация API: https://visualization.osdr.nasa.gov/radlab/gui/data-api/
// Ничего не выдумываем: если на день данных нет, этого дня в файле нет.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FLARES = resolve(root, "src/content/nasa/flares.json");
const OUT = resolve(root, "src/content/nasa/radiation.json");
const API = "https://visualization.osdr.nasa.gov/radlab/api/";
const prefix = process.argv[2] ?? "";

const flares = JSON.parse(readFileSync(FLARES, "utf8"));
const dates = [...new Set(flares.map((f) => f.date))].filter((d) => d.startsWith(prefix)).sort();

// Один день: все показания DosTel на МКС, мощность поглощённой дозы в мкГр/час
async function fetchDay(date) {
  const url = `${API}?spacecraft=ISS&instrument=DosTel&timestamp>=${date}T00:00&timestamp<${date}T23:59:59&absorbed_dose_rate&format=tsv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const lines = (await res.text()).trim().split("\n").slice(1);
  const values = lines.map((l) => Number(l.split("\t")[2])).filter((v) => Number.isFinite(v));
  return values;
}

const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const days = [];
for (const date of dates) {
  try {
    const v = await fetchDay(date);
    if (v.length === 0) {
      console.log(`${date}: нет данных`);
      continue;
    }
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const strongest = flares.filter((f) => f.date === date).sort((a, b) => b.class.localeCompare(a.class))[0];
    days.push({ date, samples: v.length, meanDoseRate: round(mean), maxDoseRate: round(Math.max(...v)), flareClass: strongest.class });
    console.log(`${date}: ${v.length} показаний, средняя ${round(mean)} мкГр/ч`);
  } catch (e) {
    console.log(`${date}: ошибка ${e.message}`);
  }
}

const all = days.map((d) => d.meanDoseRate);
const out = {
  source: "NASA OSDR RadLab, Data API (дозиметры DosTel на МКС)",
  url: "https://visualization.osdr.nasa.gov/radlab/gui/data-api/",
  unit: "мкГр/час (мощность поглощённой дозы)",
  note: "Сводка по дням со вспышками DONKI, на которые у RadLab есть измерения. Дни без измерений не включены.",
  fetched: new Date().toISOString().slice(0, 10),
  daysCount: days.length,
  meanOfDailyMeans: all.length ? round(all.reduce((a, b) => a + b, 0) / all.length) : null,
  days,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nЗаписано ${days.length} дней в src/content/nasa/radiation.json`);
