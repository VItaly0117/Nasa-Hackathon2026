// Публичный API ядра игры. Снаружи (интерфейс, сессии, сервер) импортируем только отсюда: `../engine`.
// Всё остальное в engine/ внутреннее. Ядро чистое: без React, DOM, i18n и localStorage (см. scripts/check-architecture.mjs).

export { reduce } from "./reduce";
export { initialState } from "./state";
export { nextRandom } from "./random";

export { BUILD_MS, DAY_MS, ILLNESS_CHANCE, ILLNESS_GAP, MAX_ILLNESS, MISSION_DAYS, MODES, MODE_IDS, NIGHT_START, SHORTAGE_DAMAGE } from "./constants";
export { BASE_CAPACITY, capacityOf, clamp, dailyDelta, getDef, isWorking } from "./selectors";

export { REPAIR_COST } from "@/engine/actions/repair";
export { hasFreeCrew, pickBuilder } from "@/engine/systems/crew";
export { choiceCost, dayOfEvent, nextScheduledEvent } from "@/engine/systems/events";
export { allTasksDone } from "@/engine/systems/tasks";
export { summarizeDay } from "./daySummary";
export type { DaySummary, Setback, Verdict, VitalKey } from "./daySummary";

export { BUILD_RADIUS, canPlace, cellOf, getTileInfo, isNearBase, nearestGroundSlot, slotOf, MAP_COLS, MAP_LAYOUT, MAP_ROWS } from "./placement";
export type { Terrain, TileInfo } from "./placement";

export { analyzeMission, missionFact } from "./debrief";
export type { MissionAnalysis, ReportLine } from "./debrief";
