import type { GameState, ModuleType, PlacedModule } from "@/types";
import { DEBRIEF_DATA, FACT_NAMES, HINT_IDS, MISSION_FACTS, missionFact } from "./debrief";
import { buildReport } from "@/features/results/report";
import { days, getLang, setLang, t } from "@/i18n";
import type { Lang } from "@/i18n";
import { formatMsg } from "@/i18n/messages";
import { loadGame, saveGame } from "@/session/storage";
import { BUILD_MS, canPlace, capacityOf, choiceCost, dailyDelta, DAY_MS, dayOfEvent, getDef, ILLNESS_GAP, initialState, MAP_COLS, MAP_ROWS, MAX_ILLNESS, MISSION_DAYS, reduce, REPAIR_COST, slotOf } from "./index";
import eventsData from "@/content/events.json";
import sourcesData from "@/content/sources.json";
import consumptionData from "@/content/nasa/consumption.json";
import radiationData from "@/content/nasa/radiation.json";
import flaresData from "@/content/nasa/flares.json";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";
import { uk } from "@/i18n/uk";
import type { EventDef } from "@/types";
import { MAX_OPEN, MORALE_START, MORALE_STEP, reviewTasks, TASK_DEFS, tasksPerDay } from "@/engine/systems/tasks";

// Сценарии проверки баланса: «игрок-робот» проходит миссию по заданному плану.
// Запуск: node scripts/run-checks.mjs
// Если после правки цифр в modules.json / events.json сценарий падает, баланс сломан.

type Strategy = {
  // день → что строим в этот день (по порядку; на что не хватает ресурсов, пропускаем)
  builds: Record<number, ModuleType[]>;
  // событие → выбор игрока
  choices: Record<string, string>;
};

// Проверка debrief.json: опечатка в имени факта или id подсказки не должна пройти молча (это про данные и словари, поэтому живёт в проверках, а не в ядре)
export function validateDebriefData(): string[] {
  const problems: string[] = [];
  const DATA = DEBRIEF_DATA;
  const FACTS = MISSION_FACTS;
  const known = new Set<string>(FACT_NAMES);
  for (const item of [...DATA.verdicts, ...DATA.rules]) {
    for (const c of item.when) {
      if (!known.has(c.replace(/^!/, ""))) problems.push(`${item.id}: неизвестный факт "${c}"`);
    }
  }
  for (const rule of DATA.rules) {
    if (rule.hint && !HINT_IDS.includes(rule.hint)) problems.push(`${rule.id}: нет подсказки "${rule.hint}" в hints.json`);
  }
  // У каждого правила и вердикта должен быть текст. ru.ts базовый: uk.ts и en.ts сверяет с ним TypeScript
  const keys = [
    ...DATA.rules.map((r) => `debrief.rule.${r.id}`),
    ...DATA.verdicts.flatMap((v) => ["title", "summary", "rating"].map((f) => `debrief.verdict.${v.id}.${f}`)),
  ];
  for (const key of keys) if (!(key in ru)) problems.push(`нет текста "${key}" в словарях i18n`);
  // Тексты подсказок и фактов лежат в словарях: hint.<id> и fact.<id>
  for (const id of HINT_IDS) if (!(`hint.${id}` in ru)) problems.push(`нет текста "hint.${id}" в словарях i18n`);
  for (const f of FACTS) if (!(`fact.${f.id}` in ru)) problems.push(`нет текста "fact.${f.id}" в словарях i18n`);
  const ids = [...DATA.verdicts, ...DATA.rules].map((x) => x.id);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`повтор id "${id}"`);
  return problems;
}

export type CheckResult = { name: string; ok: boolean; detail: string };

// Ставит модуль на первую подходящую клетку. Если не хватает ресурсов, состояние не меняется
function tryBuild(state: GameState, type: ModuleType): GameState {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (canPlace(state, type, row, col)) return reduce(state, { type: "build", slot: slotOf(row, col), module: type });
    }
  }
  return state;
}

// Робот строит в порядке очереди. Если не хватает ресурсов или все заняты, модуль ждёт и строится, как только можно
export function playMission(strategy: Strategy, seed = 1): GameState {
  let s = initialState(seed); // фиксированный seed: болезни случаются одинаково, проверки не прыгают
  const queue: ModuleType[] = [];
  let queuedDay = 0;
  // запас по числу шагов, чтобы ошибка в движке не подвесила проверку
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

const CAREFUL = { breakdown: "repair", flare: "hide", illness: "treat" };
const RECKLESS = { breakdown: "ignore", flare: "work", illness: "ignore" };

// Ничего не строим, но на события отвечаем правильно
const IDLE: Strategy = { builds: {}, choices: CAREFUL };

// Ничего не строим и рискуем
const CARELESS: Strategy = { builds: {}, choices: RECKLESS };

// Готовимся ко всему: еда, энергия, убежище до вспышки, батареи до ночи
const PREPARED: Strategy = {
  builds: {
    // на старте панелей нет, а теплица и шахты много тратят: три панели и теплица в первый день
    1: ["solar", "solar", "solar", "greenhouse"],
    // карьер (убежище стоит 25 материалов, а с ракеты их 10) и лёд для воды
    2: ["rockMine", "iceMine"],
    // убежище должно успеть к вспышке на 9-й день
    3: ["shelter"],
    // батареи до ночи (14-й день), и панели, чтобы батареям было что копить
    5: ["battery", "solar"],
    7: ["battery"],
    9: ["battery"],
    11: ["battery"],
  },
  choices: CAREFUL,
};

// Всё как у подготовленной базы, но ни одной батареи: ночью панели не работают
const NO_BATTERY: Strategy = {
  builds: Object.fromEntries(Object.entries(PREPARED.builds).map(([day, list]) => [day, list.filter((t) => t !== "battery")])),
  choices: CAREFUL,
};

// Строим всё нужное, но без убежища: вспышку пережидаем за баками
const NO_SHELTER: Strategy = {
  builds: Object.fromEntries(Object.entries(PREPARED.builds).map(([day, list]) => [day, list.filter((t) => t !== "shelter")])),
  choices: CAREFUL,
};

function describe(state: GameState): string {
  const r = state.resources;
  return `${state.status}, день ${state.day}, O₂ ${r.oxygen} вода ${r.water} еда ${r.food} энергия ${r.energy} здоровье ${r.health}`;
}

export function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });

  const problems = validateDebriefData();
  check("debrief.json без опечаток", problems.length === 0, problems.join("; ") || "все факты и подсказки существуют");

  const idle = playMission(IDLE);
  check("Без построек миссию не пройти", idle.status === "lost", describe(idle));

  const careless = playMission(CARELESS);
  check("Риск без построек заканчивается раньше, чем осторожность", careless.status === "lost" && careless.day <= idle.day, describe(careless));

  const prepared = playMission(PREPARED);
  check("Подготовленная база проходит миссию", prepared.status === "won", describe(prepared));
  check("Подготовленная база сохраняет здоровье (80+)", prepared.resources.health >= 80, `здоровье ${prepared.resources.health}`);

  const noShelter = playMission(NO_SHELTER);
  check(
    "Без убежища вспышка стоит здоровья",
    noShelter.resources.health < prepared.resources.health,
    `без убежища ${noShelter.resources.health}, с убежищем ${prepared.resources.health}`,
  );

  const noBattery = playMission(NO_BATTERY);
  check(
    "Без батарей лунная ночь оставляет базу без энергии",
    noBattery.history.some((e) => e.kind === "blackout" && e.night),
    describe(noBattery),
  );

  // Стройка руками экипажа
  const fresh = initialState();
  check(
    "В экипаже ровно инженер, учёный, врач и техник",
    new Set(fresh.crew.map((c) => c.role)).size === 4 && fresh.crew.every((c) => ["engineer", "scientist", "doctor", "technician"].includes(c.role)),
    fresh.crew.map((c) => c.role).join(", "),
  );
  check(
    "Убежище и медпункт строит врач",
    getDef("shelter").builder === "doctor" && getDef("medbay").builder === "doctor",
    `убежище: ${getDef("shelter").builder}, медпункт: ${getDef("medbay").builder}`,
  );
  let busy = fresh;
  for (let i = 0; i < fresh.crew.length; i++) busy = tryBuild(busy, "solar");
  const allBusy = busy.crew.every((c) => c.status.kind === "building");
  check("Каждую стройку ведёт отдельный член экипажа, и все члены заняты", allBusy, busy.crew.map((c) => c.status.kind).join(", "));
  check("Когда все заняты, пятый модуль не ставится", tryBuild(busy, "solar") === busy, `модулей ${busy.modules.length}`);
  check(
    "Стройка не списывает ресурсы повторно и модуль в стройке ничего не даёт",
    dailyDelta(busy).energy === dailyDelta(fresh).energy,
    `энергия в день ${dailyDelta(busy).energy} (было ${dailyDelta(fresh).energy})`,
  );
  const almost = reduce(busy, { type: "tick", ms: BUILD_MS - 100 });
  check("За минуту без 0,1 с стройка ещё идёт", almost.crew.every((c) => c.status.kind === "building"), `занято ${almost.crew.filter((c) => c.status.kind === "building").length}`);
  const finished = reduce(almost, { type: "tick", ms: 100 });
  check(
    "Ровно за 60 с игрового времени модуль готов, а строитель свободен",
    finished.modules.every((m) => !m.build) && finished.crew.every((c) => c.status.kind === "free"),
    `свободных ${finished.crew.filter((c) => c.status.kind === "free").length}, строек ${finished.modules.filter((m) => m.build).length}`,
  );
  const oneDay = reduce(initialState(), { type: "tick", ms: DAY_MS });
  check("Полный день по часам = следующий день", oneDay.day === 2 && oneDay.clockMs === 0, `день ${oneDay.day}, часы ${oneDay.clockMs}`);
  const halfDay = reduce(initialState(), { type: "tick", ms: DAY_MS / 2 });
  check("Полдня по часам день не меняет", halfDay.day === 1 && halfDay.clockMs === DAY_MS / 2, `день ${halfDay.day}, часы ${halfDay.clockMs}`);

  // Ядро не зависит от языка: журнал и состояние одинаковы, на каком бы языке ни играл игрок
  const savedLang = getLang();
  const stateIn = (lang: Lang) => {
    setLang(lang);
    return JSON.stringify(playMission(PREPARED, 3));
  };
  const inRu = stateIn("ru");
  const inEn = stateIn("en");
  const inUk = stateIn("uk");
  setLang(savedLang);
  check("Состояние игры целиком (с журналом) не зависит от языка: ru, en и uk дают одно и то же", inRu === inEn && inEn === inUk, `совпало: ${inRu === inEn && inEn === inUk}, размер ${inRu.length}`);
  const entries = [prepared, idle, noShelter].flatMap((s) => [...s.log, ...s.pending.map((p) => ({ day: 0, ...p.reason }))]);
  const keys = [...new Set(entries.map((e) => e.key))];
  const broken: string[] = [];
  for (const lang of ["ru", "uk", "en"] as Lang[]) {
    setLang(lang);
    for (const e of entries) {
      const text = formatMsg(e);
      if (/[{}]/.test(text) || text === e.key) broken.push(`${lang}:${e.key}`);
    }
  }
  setLang(savedLang);
  check("Каждое сообщение журнала переводится на ru, uk и en без «дыр» в тексте", broken.length === 0, broken.length ? [...new Set(broken)].join(", ") : `${keys.length} видов сообщений`);

  // Склонение «дней» идёт от правил языка (Intl.PluralRules), а не от ручных остатков
  const expected: Record<Lang, string[]> = {
    ru: ["1 день", "2 дня", "5 дней", "11 дней", "21 день", "22 дня", "25 дней"],
    uk: ["1 день", "2 дні", "5 днів", "11 днів", "21 день", "22 дні", "25 днів"],
    en: ["1 day", "2 days", "5 days", "11 days", "21 days", "22 days", "25 days"],
  };
  const wrong: string[] = [];
  for (const lang of ["ru", "uk", "en"] as Lang[]) {
    setLang(lang);
    [1, 2, 5, 11, 21, 22, 25].forEach((n, i) => {
      if (days(n) !== expected[lang][i]) wrong.push(`${lang}:${n}=${days(n)}`);
    });
  }
  setLang(savedLang);
  check("Склонение «день/дня/дней» верно в ru, uk и en", wrong.length === 0, wrong.length ? wrong.join(", ") : "7 чисел × 3 языка");

  // Старые сохранения (до журнала на ключах) мигрируют и не теряют текст
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
  const modern = initialState(9);
  saveGame(modern);
  check("Сохранение текущей версии загружается без изменений", JSON.stringify(loadGame()) === JSON.stringify(modern), "совпало");
  const old = { ...modern, log: [{ day: 1, text: "Старая запись" }], pending: [{ inDays: 1, key: "health", amount: -25, reason: "Старая причина" }] };
  memory.set("moonbase:save", JSON.stringify({ version: 6, state: old }));
  const migrated = loadGame();
  check(
    "Сохранение версии 6 мигрирует: текст журнала и причин остаётся как есть",
    !!migrated && migrated.log[0].key === "log.legacy" && formatMsg(migrated.log[0]) === "Старая запись" && formatMsg(migrated.pending[0].reason) === "Старая причина",
    migrated ? `${migrated.log[0].key}` : "не загрузилось",
  );
  memory.set("moonbase:save", JSON.stringify({ version: 99, state: modern }));
  check("Сохранение из будущей версии не загружается", loadGame() === null, "null");
  delete (globalThis as { localStorage?: unknown }).localStorage;

  // Поломка и починка
  const breakdownOpen = (): GameState => {
    let s = initialState(1);
    for (let i = 0; i < 12 && s.activeEvent !== "breakdown"; i++) s = reduce(s, { type: "tick", ms: DAY_MS });
    return { ...s, resources: { ...s.resources, water: 50, energy: 50 } };
  };
  const lifeSupportOf = (s: GameState) => s.modules.find((m) => m.type === "lifeSupport")!;
  const atBreakdown = breakdownOpen();
  check("На 6-й день ломается жизнеобеспечение", atBreakdown.activeEvent === "breakdown" && lifeSupportOf(atBreakdown).broken, `день ${atBreakdown.day}`);
  check(
    "Починка кликом стоит столько же, сколько выбор «починить» в окне (цена из events.json)",
    JSON.stringify(REPAIR_COST) === JSON.stringify(choiceCost("breakdown", "repair")) && Object.keys(REPAIR_COST).length > 0,
    JSON.stringify(REPAIR_COST),
  );
  const fixedAtOnce = reduce(atBreakdown, { type: "repair", slot: lifeSupportOf(atBreakdown).slot });
  check(
    "Починка при открытом окне поломки закрывает окно и списывает цену",
    !lifeSupportOf(fixedAtOnce).broken && fixedAtOnce.activeEvent === null && atBreakdown.resources.water - fixedAtOnce.resources.water === (REPAIR_COST.water ?? 0),
    `вода −${atBreakdown.resources.water - fixedAtOnce.resources.water}`,
  );
  const postponed = reduce(atBreakdown, { type: "resolveEvent", choice: "ignore" });
  const fixedLater = reduce(postponed, { type: "repair", slot: lifeSupportOf(postponed).slot });
  const reportIds = (s: GameState) => {
    const r = buildReport(s);
    return [...r.hurt, ...r.helped].map((l) => l.id);
  };
  check("Починили сразу: в разборе «починили», без «не починили»", reportIds(fixedAtOnce).includes("breakdown-repaired") && !reportIds(fixedAtOnce).includes("breakdown-ignored"), reportIds(fixedAtOnce).join(", "));
  check(
    "Отложили, потом починили: в разборе «починили позже», без «не починили» и без «починили сразу»",
    reportIds(fixedLater).includes("breakdown-repaired-late") && !reportIds(fixedLater).includes("breakdown-ignored") && !reportIds(fixedLater).includes("breakdown-repaired"),
    reportIds(fixedLater).join(", "),
  );
  check("Отложили и не починили: в разборе только «не починили»", reportIds(postponed).includes("breakdown-ignored") && !reportIds(postponed).includes("breakdown-repaired-late"), reportIds(postponed).join(", "));
  const overBroken: GameState = { ...postponed, status: "lost" };
  const frozen =
    reduce(overBroken, { type: "repair", slot: lifeSupportOf(overBroken).slot }) === overBroken &&
    reduce(overBroken, { type: "research", id: "moonDust", answer: "shield" }) === overBroken;
  check("После конца игры починка и исследование ничего не меняют", frozen, frozen ? "состояние то же" : "состояние изменилось");

  // Научная экспедиция (исследование про лунную пыль)
  const base = initialState(1);
  const shield = reduce(base, { type: "research", id: "moonDust", answer: "shield" });
  const brush = reduce(base, { type: "research", id: "moonDust", answer: "brush" });
  check(
    "Исследование: верный ответ даёт +24 энергии и +12 материалов, неверный только +8 энергии",
    shield.resources.energy - base.resources.energy === 24 && shield.resources.materials - base.resources.materials === 12 && brush.resources.energy - base.resources.energy === 8 && brush.resources.materials === base.resources.materials,
    `верный: +${shield.resources.energy - base.resources.energy} энергии, +${shield.resources.materials - base.resources.materials} материалов; неверный: +${brush.resources.energy - base.resources.energy}`,
  );
  check("Исследование выполняется один раз", reduce(shield, { type: "research", id: "moonDust", answer: "shield" }) === shield && shield.research.filter((x) => x === "moonDust").length === 1, `выполнено: ${shield.research.join(", ")}`);
  // Второе исследование: разведка льда
  const iceRight = reduce(base, { type: "research", id: "iceScout", answer: "ice" });
  const iceWrong = reduce(base, { type: "research", id: "iceScout", answer: "rock" });
  check(
    "Разведка льда: верный ответ даёт воду и энергию, неверный немного материалов; оба один раз и независимо от пыли",
    iceRight.resources.water > base.resources.water && iceRight.resources.energy > base.resources.energy && iceWrong.resources.materials > base.resources.materials && iceWrong.resources.water === base.resources.water &&
      reduce(iceRight, { type: "research", id: "iceScout", answer: "ice" }) === iceRight && reduce(shield, { type: "research", id: "iceScout", answer: "ice" }) !== shield,
    `верный: вода +${iceRight.resources.water - base.resources.water}, энергия +${iceRight.resources.energy - base.resources.energy}; неверный: материалы +${iceWrong.resources.materials - base.resources.materials}`,
  );
  const nearFull = reduce({ ...base, resources: { ...base.resources, energy: 95 } }, { type: "research", id: "moonDust", answer: "shield" });
  check("Награда за исследование не выходит за лимит хранения", nearFull.resources.energy === capacityOf(base.modules).energy, `энергия ${nearFull.resources.energy}`);

  // Подсказка в окне события должна называть те же числа, что и цена в events.json (на всех трёх языках)
  const dicts: Record<string, Record<string, string>> = { ru, uk, en };
  const drift: string[] = [];
  for (const ev of eventsData as EventDef[]) {
    for (const ch of ev.choices) {
      const nums = new Set<number>();
      for (const cost of [ch.cost, ch.costWithout?.cost ?? {}]) for (const v of Object.values(cost)) if (v) nums.add(v);
      if (ch.rest) [ch.rest.days, ch.rest.daysWith].forEach((n) => nums.add(n));
      for (const [lang, dict] of Object.entries(dicts)) {
        const hint = dict[`ev.${ev.id}.${ch.id}.hint`] ?? "";
        for (const n of nums) if (!new RegExp(`(^|\\D)${n}(\\D|$)`).test(hint)) drift.push(`${lang} ${ev.id}.${ch.id}: нет числа ${n}`);
      }
    }
  }
  check("Подсказки в окнах событий совпадают с ценами в events.json", drift.length === 0, drift.join("; ") || "ru, uk, en");

  // Итоговый экран: факты NASA и источники
  const noSourceText = (sourcesData as { id: string }[]).flatMap((x) => [`source.${x.id}.name`, `source.${x.id}.usedFor`]).filter((k) => !(k in ru));
  check("У каждого источника на экране «Данные NASA» есть название и описание", noSourceText.length === 0, noSourceText.join(", ") || `${(sourcesData as unknown[]).length} источников`);
  // Настоящие нормы NASA на человека: только числа из брифа, с источником и ссылкой
  const real = consumptionData.perCrewmemberPerDay;
  const realOk = Object.values(real).every((v) => typeof v === "number" && v > 0) && real.oxygenKgWithExercise > real.oxygenKgResting && consumptionData.url.startsWith("https://www.nasa.gov/");
  check("Нормы расхода NASA на человека заполнены (кислород, вода, еда) со ссылкой на источник", realOk, `кислород ${real.oxygenKgResting}–${real.oxygenKgWithExercise} кг, вода от ${real.potableWaterLitersMin} л, еда ${real.foodKcalAverage} ккал в сутки`);
  // Настоящие измерения RadLab: у каждого дня есть показания, средняя в разумных пределах, дата совпадает с вспышкой из DONKI
  const flareDates = new Set((flaresData as { date: string }[]).map((f) => f.date));
  const badRadiation = radiationData.days.filter((d) => !(d.samples > 0 && d.meanDoseRate > 0 && d.meanDoseRate < 1000 && d.maxDoseRate >= d.meanDoseRate && flareDates.has(d.date)));
  check("Данные RadLab: у каждого дня есть показания, и он совпадает со вспышкой DONKI", radiationData.days.length > 0 && badRadiation.length === 0, `${radiationData.days.length} дней, средняя ${radiationData.meanOfDailyMeans} мкГр/ч`);
  const facts = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => missionFact(initialState(seed)).id);
  check(
    "Факт NASA в итогах выбирается по seed: один seed даёт один факт, и текст у него есть",
    missionFact(initialState(3)).id === missionFact(initialState(3)).id && facts.every((id) => `fact.${id}` in ru),
    facts.join(", "),
  );
  const flawless = { ...prepared, tasks: prepared.tasks.map((x) => ({ ...x, status: "done" as const })) };
  const ignoredAsks = { ...prepared, tasks: prepared.tasks.map((x) => ({ ...x, status: "missed" as const })) };
  check(
    "«На отлично» только если экипаж не остался без ответа на большинство просьб",
    buildReport(flawless).rating === t("debrief.verdict.perfect.rating") && buildReport(ignoredAsks).rating !== t("debrief.verdict.perfect.rating"),
    `выполнены: ${buildReport(flawless).rating}, просрочены: ${buildReport(ignoredAsks).rating}`,
  );

  // Задания от экипажа
  const first = initialState();
  check("В начале экипаж даёт 2 задания", first.tasks.length === 2 && first.tasks.every((x) => x.status === "open"), first.tasks.map((x) => x.id).join(", "));
  check(
    "Задание просит член экипажа с подходящей ролью",
    first.tasks.every((x) => first.crew.find((c) => c.id === x.giver)?.role === TASK_DEFS.find((d) => d.id === x.id)!.role),
    first.tasks.map((x) => `${x.id}: ${first.crew.find((c) => c.id === x.giver)?.role}`).join(", "),
  );
  const perDay = new Map<number, number>();
  for (const x of idle.tasks) perDay.set(x.issuedDay, (perDay.get(x.issuedDay) ?? 0) + 1);
  check(
    "Новых заданий в день не больше 2 до 10-го дня и не больше 1 после",
    [...perDay].every(([day, n]) => n <= tasksPerDay(day)),
    [...perDay].map(([d, n]) => `${d}:${n}`).join(" "),
  );
  let maxOpen = 0;
  let walk = initialState();
  for (let i = 0; i < MISSION_DAYS && walk.status === "playing"; i++) {
    if (walk.activeEvent) walk = reduce(walk, { type: "resolveEvent", choice: walk.activeEvent === "flare" ? "hide" : "repair" });
    walk = reduce(walk, { type: "nextDay" });
    maxOpen = Math.max(maxOpen, walk.tasks.filter((x) => x.status === "open").length);
  }
  check(`Открытых заданий одновременно не больше ${MAX_OPEN}`, maxOpen <= MAX_OPEN, `максимум ${maxOpen}`);
  const shelterTask = idle.tasks.find((x) => x.id === "shelter");
  check("Срок задания про убежище = день вспышки", shelterTask?.deadline === dayOfEvent("flare"), `срок ${shelterTask?.deadline}, вспышка ${dayOfEvent("flare")}`);
  check("Без построек задания просрочены, а настроение экипажа падает", idle.tasks.some((x) => x.status === "missed") && idle.crew.every((c) => c.morale < MORALE_START), `настроение ${idle.crew.map((c) => c.morale).join(",")}`);
  const greenhouseDone = reviewTasks({ ...first, modules: [...first.modules, { slot: slotOf(0, 0), type: "greenhouse", broken: false }] });
  check(
    "Построили теплицу: задание выполнено, настроение растёт",
    greenhouseDone.tasks.find((x) => x.id === "greenhouse")?.status === "done" && greenhouseDone.crew.every((c) => c.morale === MORALE_START + MORALE_STEP),
    `настроение ${greenhouseDone.crew.map((c) => c.morale).join(",")}`,
  );
  const unfinished = reviewTasks({ ...first, modules: [...first.modules, { slot: slotOf(0, 0), type: "greenhouse", broken: false, build: { leftMs: 1, totalMs: 1, crewId: 1 } }] });
  check("Модуль в стройке задание ещё не закрывает", unfinished.tasks.find((x) => x.id === "greenhouse")?.status === "open", "статус open");
  const noText = TASK_DEFS.flatMap((d) => [`task.${d.id}`, `task.${d.id}.why`]).filter((k) => !(k in ru));
  check("У каждого задания есть текст и объяснение", noText.length === 0, noText.join(", ") || `${TASK_DEFS.length} заданий`);

  // Болезнь во время стройки
  // seed, при котором строитель панелей на 2-й день заболевает посреди стройки
  const illnessAt = (seed: number): GameState => {
    let s = reduce(initialState(seed), { type: "tick", ms: DAY_MS }); // день 2
    s = tryBuild(s, "solar");
    return reduce(s, { type: "tick", ms: BUILD_MS });
  };
  let sickSeed = 0;
  for (let seed = 1; seed < 500 && !sickSeed; seed++) if (illnessAt(seed).activeEvent === "illness") sickSeed = seed;
  check("Во время стройки можно заболеть (нашёлся seed)", sickSeed > 0, `seed ${sickSeed}`);

  const sick = illnessAt(sickSeed);
  const patient = sick.illness!.crewId;
  const building = (s: GameState) => s.modules.find((m) => m.build);
  check(
    "Событие болезни: строитель отмечен, стройка и часы стоят",
    sick.activeEvent === "illness" && building(sick)?.build?.crewId === patient && sick.status === "playing",
    `заболел ${patient}, осталось ${building(sick)?.build?.leftMs} мс`,
  );
  const medbay = { slot: slotOf(1, 0), type: "medbay" as const, broken: false };
  const withMedbay = (s: GameState): GameState => ({ ...s, modules: [...s.modules, medbay] });

  const treated = reduce(sick, { type: "resolveEvent", choice: "treat" });
  check(
    "Вылечить: −10 воды и −8 еды, стройка продолжается тем же человеком",
    sick.resources.water - treated.resources.water === 10 && sick.resources.food - treated.resources.food === 8 && building(treated)?.build?.crewId === patient && treated.activeEvent === null && treated.illness === null,
    `вода −${sick.resources.water - treated.resources.water}, еда −${sick.resources.food - treated.resources.food}`,
  );
  const treatedMed = reduce(withMedbay(sick), { type: "resolveEvent", choice: "treat" });
  check(
    "С медпунктом лечение вдвое дешевле",
    sick.resources.water - treatedMed.resources.water === 5 && sick.resources.food - treatedMed.resources.food === 4,
    `вода −${sick.resources.water - treatedMed.resources.water}, еда −${sick.resources.food - treatedMed.resources.food}`,
  );

  const ignored = reduce(sick, { type: "resolveEvent", choice: "ignore" });
  const patientAfter = ignored.crew.find((c) => c.id === patient)!.status;
  check(
    "Не лечить: больной выбывает на 2 дня, здоровье −5, стройку подхватывает другой",
    patientAfter.kind === "sick" && patientAfter.leftMs === 2 * DAY_MS && sick.resources.health - ignored.resources.health === 5 && building(ignored)?.build?.crewId !== null && building(ignored)?.build?.crewId !== patient,
    `статус ${patientAfter.kind}, строитель ${building(ignored)?.build?.crewId}`,
  );
  const ignoredMed = reduce(withMedbay(sick), { type: "resolveEvent", choice: "ignore" });
  const medStatus = ignoredMed.crew.find((c) => c.id === patient)!.status;
  check("С медпунктом больной выбывает на 1 день", medStatus.kind === "sick" && medStatus.leftMs === DAY_MS, `статус ${medStatus.kind}`);

  const recovered = reduce(ignored, { type: "tick", ms: 2 * DAY_MS });
  check(
    "Через 2 дня больной выздоравливает и снова свободен",
    recovered.crew.find((c) => c.id === patient)!.status.kind === "free" && recovered.log.some((e) => e.key === "log.recovered" && e.params?.name === patient),
    `статус ${recovered.crew.find((c) => c.id === patient)!.status.kind}`,
  );

  // Все остальные заняты: стройка стоит и ждёт, потом её подхватывает освободившийся
  const everyoneElseBusy: GameState = { ...sick, crew: sick.crew.map((c) => (c.id === patient ? c : { ...c, status: { kind: "building", slot: 999, module: "solar" } })) };
  const waiting = reduce(everyoneElseBusy, { type: "resolveEvent", choice: "ignore" });
  const stalled = reduce(waiting, { type: "tick", ms: 5000 });
  check(
    "Если некому подхватить, стройка стоит и время её не идёт",
    building(waiting)?.build?.crewId === null && building(stalled)?.build?.leftMs === building(waiting)?.build?.leftMs,
    `осталось ${building(stalled)?.build?.leftMs} мс`,
  );
  const helperId = stalled.crew.find((c) => c.id !== patient)!.id; // любой, кроме больного
  const freed = reduce({ ...stalled, crew: stalled.crew.map((c) => (c.id === helperId ? { ...c, status: { kind: "free" } } : c)) }, { type: "tick", ms: 100 });
  check(
    "Освободился человек: он подхватывает стройку, и она снова идёт",
    building(freed)?.build?.crewId !== null && (building(freed)?.build?.leftMs ?? 0) < (building(stalled)?.build?.leftMs ?? 0),
    `строитель ${building(freed)?.build?.crewId}`,
  );

  // Ограничения и повторяемость
  let tooEarly = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const day1 = reduce(tryBuild(initialState(seed), "solar"), { type: "tick", ms: DAY_MS - 1 });
    if (day1.activeEvent === "illness") tooEarly++;
  }
  check("В первый день никто не заболевает", tooEarly === 0, `случаев ${tooEarly}`);
  let worst = { count: 0, minGap: Infinity };
  for (let seed = 1; seed <= 40; seed++) {
    const run = playMission(PREPARED, seed);
    const days = run.history.filter((h) => h.kind === "choice" && h.event === "illness").map((h) => h.day);
    worst = { count: Math.max(worst.count, days.length), minGap: Math.min(worst.minGap, ...days.slice(1).map((d, i) => d - days[i])) };
  }
  check(
    `За миссию не больше ${MAX_ILLNESS} болезней и не чаще, чем раз в ${ILLNESS_GAP} дней (40 разных seed)`,
    worst.count <= MAX_ILLNESS && worst.minGap >= ILLNESS_GAP,
    `максимум ${worst.count}, минимальный промежуток ${worst.minGap === Infinity ? "—" : worst.minGap}`,
  );
  check("Один seed даёт одну и ту же игру", JSON.stringify(playMission(PREPARED, 7)) === JSON.stringify(playMission(PREPARED, 7)), "две партии совпали");
  const withMedbayBuilt: GameState = { ...treated, history: [...treated.history, { day: 2, kind: "built", module: "medbay" }] };
  check(
    "Разбор болезни: вылечил, не лечил, медпункт",
    buildReport(treated).helped.some((l) => l.id === "illness-treated") &&
      buildReport(ignored).hurt.some((l) => l.id === "illness-ignored") &&
      buildReport(withMedbayBuilt).helped.some((l) => l.id === "medbay-helped") &&
      !buildReport(treated).helped.some((l) => l.id === "medbay-helped"),
    "правила сработали",
  );

  // Лимит хранения: без склада лишнее пропадает, со складом копится
  const fullWater = (extra: PlacedModule[]): GameState => {
    const s = initialState();
    const mine: PlacedModule = { slot: slotOf(0, 0), type: "iceMine", broken: false };
    return { ...s, resources: { ...s.resources, water: 100 }, modules: [...s.modules, mine, ...extra] };
  };
  const storage: PlacedModule = { slot: slotOf(0, 1), type: "storage", broken: false };
  const battery: PlacedModule = { slot: slotOf(0, 2), type: "battery", broken: false };
  const noStorage = reduce(fullWater([]), { type: "nextDay" });
  const withStorage = reduce(fullWater([storage]), { type: "nextDay" });
  check("Без склада вода не больше 100", noStorage.resources.water <= 100, `вода ${noStorage.resources.water}`);
  check("Со складом вода копится выше 100", withStorage.resources.water > 100, `вода ${withStorage.resources.water}`);
  const capBase = capacityOf(initialState().modules);
  const capBoth = capacityOf([...initialState().modules, storage, battery]);
  check(
    "Склад добавляет место воде, еде и материалам, батарея энергии; кислород и здоровье всегда 100",
    capBase.water === 100 && capBoth.water > 100 && capBoth.food > 100 && capBoth.materials > 100 && capBoth.energy > 100 && capBoth.oxygen === 100 && capBoth.health === 100,
    JSON.stringify(capBoth),
  );

  // Разбор должен говорить о том, что реально случилось
  const ids = (s: GameState) => {
    const r = buildReport(s);
    return [...r.hurt, ...r.helped, ...r.facts].map((l) => l.id);
  };
  const expectLines = (name: string, s: GameState, expected: string[], forbidden: string[] = []) => {
    const got = ids(s);
    const missing = expected.filter((id) => !got.includes(id));
    const extra = forbidden.filter((id) => got.includes(id));
    check(
      name,
      missing.length === 0 && extra.length === 0,
      missing.length || extra.length ? `нет: ${missing.join(", ") || "—"}; лишние: ${extra.join(", ") || "—"}` : got.join(", "),
    );
  };

  expectLines("Разбор: подготовленная база", prepared, ["flare-shelter", "breakdown-repaired", "night-survived", "greenhouse-fed", "real-flare"], ["flare-worked", "no-builds", "water-out", "food-no-greenhouse", "oxygen-out", "night-no-battery"]);
  expectLines("Разбор: без убежища", noShelter, ["flare-no-shelter"], ["flare-shelter"]);
  expectLines("Разбор: без батарей", noBattery, ["night-no-battery"], ["night-survived"]);
  expectLines("Разбор: без построек", idle, ["no-builds"], ["night-survived", "greenhouse-fed"]);
  expectLines("Разбор: риск", careless, ["breakdown-ignored", "no-builds"], ["breakdown-repaired"]);

  for (const [name, s] of [["idle", idle], ["careless", careless], ["prepared", prepared], ["noShelter", noShelter], ["noBattery", noBattery]] as const) {
    const r = buildReport(s);
    const leftover = [r.title, r.summary, ...r.hurt.map((l) => l.text), ...r.helped.map((l) => l.text), ...r.facts.map((l) => l.text)].filter((t) => /[{}]/.test(t));
    check(`Разбор (${name}): тексты без незаполненных {скобок}`, leftover.length === 0, leftover.join(" | ") || r.title);
  }

  return results;
}
