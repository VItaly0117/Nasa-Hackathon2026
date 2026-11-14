import type { GameState, ModuleType, PlacedModule } from "../types";
import { buildReport, validateDebriefData } from "./debrief";
import { BUILD_MS, capacityOf, dailyDelta, DAY_MS, initialState, MISSION_DAYS, reduce } from "./engine";
import { ru } from "../i18n/ru";
import { dayOfEvent } from "./events";
import { canPlace, MAP_COLS, MAP_ROWS, slotOf } from "./placement";
import { MAX_OPEN, MORALE_START, MORALE_STEP, reviewTasks, TASK_DEFS, tasksPerDay } from "./tasks";

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

// Робот строит в порядке очереди. Если не хватает ресурсов или все заняты, модуль ждёт и строится, как только можно
export function playMission(strategy: Strategy): GameState {
  let s = initialState();
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

const CAREFUL = { breakdown: "repair", flare: "hide" };
const RECKLESS = { breakdown: "ignore", flare: "work" };

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
  let busy = fresh;
  for (let i = 0; i < fresh.crew.length; i++) busy = tryBuild(busy, "solar");
  const allBusy = busy.crew.every((c) => c.status.kind === "building");
  check("Каждую стройку ведёт отдельный член экипажа, и все четверо заняты", allBusy, busy.crew.map((c) => c.status.kind).join(", "));
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
