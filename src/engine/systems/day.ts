import type { GameState, ResourceKey } from "@/types";
import { MISSION_DAYS, NIGHT_START, SHORTAGE_DAMAGE } from "@/engine/constants";
import { msg } from "@/engine/msg";
import { addTo, capacityOf, clamp, crewNeeds, moduleOutput, RESOURCE_KEYS } from "@/engine/selectors";
import { applyEventStart, eventForDay } from "./events";
import { issueTasks, reviewTasks } from "./tasks";

const VITAL: ResourceKey[] = ["oxygen", "water", "food"];

// Наступает новый день: экономика базы, отложенные последствия, ночь, задания, событие дня
export function nextDay(state: GameState): GameState {
  const resources = { ...state.resources };
  const log = [...state.log];
  const history = [...state.history];
  const day = state.day + 1;
  // Номер дня для журнала и истории. Последний шаг миссии относится к её последнему дню, а не к «дню 21»
  const stamp = Math.min(day, MISSION_DAYS);

  // Без энергии всё, что её потребляет, отключается
  const noPower = resources.energy <= 0;
  for (const module of state.modules) {
    const output = moduleOutput(module, state.isNight);
    if (noPower && (output.energy ?? 0) < 0) continue;
    addTo(resources, output);
  }
  if (noPower) {
    log.push({ day: stamp, ...msg("log.noPower") });
    history.push({ day: stamp, kind: "blackout", night: state.isNight });
  }
  addTo(resources, crewNeeds(state));
  const capacity = capacityOf(state.modules);
  for (const key of RESOURCE_KEYS) resources[key] = clamp(resources[key], capacity[key]);

  // Отложенные последствия
  const pending: GameState["pending"] = [];
  for (const effect of state.pending) {
    if (effect.inDays <= 1) {
      resources[effect.key] = clamp(resources[effect.key] + effect.amount, capacity[effect.key]);
      log.push({ day: stamp, ...effect.reason });
    } else {
      pending.push({ ...effect, inDays: effect.inDays - 1 });
    }
  }

  // Закончился жизненно важный ресурс — последствие наступит через 2 дня
  for (const key of VITAL) {
    if (resources[key] > 0) continue;
    const reason = msg("log.vitalHealth", { what: key, n: SHORTAGE_DAMAGE });
    // тот же ресурс уже ждёт своего урона: второй раз не добавляем
    if (pending.some((p) => p.reason.key === reason.key && p.reason.params?.what === key)) continue;
    pending.push({ inDays: 2, key: "health", amount: -SHORTAGE_DAMAGE, reason });
    log.push({ day: stamp, ...msg("log.vitalOut", { what: key }) });
    history.push({ day: stamp, kind: "shortage", resource: key });
  }

  if (day === NIGHT_START - 2) log.push({ day: stamp, ...msg("log.night2") });
  if (day === NIGHT_START) log.push({ day: stamp, ...msg("log.nightStart") });

  let next: GameState = {
    ...state,
    day: Math.min(day, MISSION_DAYS),
    isNight: day >= NIGHT_START,
    resources,
    pending,
    log,
    history,
  };

  if (resources.health <= 0) return { ...next, status: "lost" };
  if (day > MISSION_DAYS) return { ...next, status: "won" };

  // Новый день: проверяем задания и просим новые
  next = issueTasks(reviewTasks(next));

  const eventId = eventForDay(day);
  if (eventId) next = applyEventStart({ ...next, activeEvent: eventId }, eventId);
  return next;
}
