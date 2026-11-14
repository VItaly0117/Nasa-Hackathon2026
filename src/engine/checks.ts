import type { GameState, ModuleType } from "../types";
import { buildReport, validateDebriefData } from "./debrief";
import { initialState, MISSION_DAYS, reduce } from "./engine";
import { canPlace, MAP_COLS, MAP_ROWS, slotOf } from "./placement";

// Сценарии проверки баланса: «игрок-робот» проходит миссию по заданному плану.
// Запуск: node scripts/run-checks.mjs
// Если после правки цифр в modules.json / events.json сценарий падает, баланс сломан.

type Strategy = {
  // день → что строим в этот день (по порядку; на что не хватает ресурсов, пропускаем)
  builds: Record<number, ModuleType[]>;
  // событие → выбор игрока
  choices: Record<string, string>;
};

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

export function playMission(strategy: Strategy): GameState {
  let s = initialState();
  // запас по числу шагов, чтобы ошибка в движке не подвесила проверку
  for (let step = 0; step < MISSION_DAYS * 3 && s.status === "playing"; step++) {
    if (s.activeEvent) {
      s = reduce(s, { type: "resolveEvent", choice: strategy.choices[s.activeEvent] });
      continue;
    }
    for (const type of strategy.builds[s.day] ?? []) s = tryBuild(s, type);
    s = reduce(s, { type: "nextDay" });
  }
  return s;
}

const CAREFUL = { breakdown: "repair", flare: "hide" };
const RECKLESS = { breakdown: "ignore", flare: "work" };

// Ничего не строим, но на события отвечаем правильно
const IDLE: Strategy = { builds: {}, choices: CAREFUL };

// Ничего не строим и рискуем
const CARELESS: Strategy = { builds: {}, choices: RECKLESS };

// Готовимся ко всему: еда, энергия, убежище до вспышки, батареи до ночи
const PREPARED: Strategy = {
  builds: {
    // карьер первым: убежище стоит 25 материалов, а с ракеты их только 20
    1: ["rockMine", "greenhouse", "lifeSupport", "solar"],
    2: ["solar"],
    3: ["solar"],
    4: ["lifeSupport"],
    5: ["shelter"],
    7: ["battery"],
    8: ["battery"],
    10: ["battery"],
    11: ["battery"],
    12: ["battery"],
  },
  choices: CAREFUL,
};

// Всё как у подготовленной базы, но ни одной батареи: ночью панели не работают
const NO_BATTERY: Strategy = {
  builds: Object.fromEntries(Object.entries(PREPARED.builds).map(([day, list]) => [day, list.filter((t) => t !== "battery")])),
  choices: CAREFUL,
};

// Строим всё нужное, но без убежища: вспышку пережидаем за баками
const NO_SHELTER: Strategy = { builds: { ...PREPARED.builds, 5: [] }, choices: CAREFUL };

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
  expectLines("Разбор: без построек", idle, ["no-builds"], ["night-survived", "greenhouse-fed", "night-no-battery"]);
  expectLines("Разбор: риск", careless, ["breakdown-ignored", "no-builds"], ["breakdown-repaired"]);

  for (const [name, s] of [["idle", idle], ["careless", careless], ["prepared", prepared], ["noShelter", noShelter], ["noBattery", noBattery]] as const) {
    const r = buildReport(s);
    const leftover = [r.title, r.summary, ...r.hurt.map((l) => l.text), ...r.helped.map((l) => l.text), ...r.facts.map((l) => l.text)].filter((t) => /[{}]/.test(t));
    check(`Разбор (${name}): тексты без незаполненных {скобок}`, leftover.length === 0, leftover.join(" | ") || r.title);
  }

  return results;
}
