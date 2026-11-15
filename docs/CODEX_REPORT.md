# Codex infrastructure report

## Status

T1 suites were generated through `lcode` after selecting `gpt-5.6-terra` from `codex debug models`. The first lcode attempt found a bad relative import in `content.test.ts`; its retry fixed it. No raw proxy, credentials, or quota-guard bypass were used.

This branch remains based on `origin/main` and is named `codex/infra`. No files in `src/` were changed. T1 and T2 are green; T3 and T4 have not started.

## Completed work

- T1: 8 Vitest suites, 79 tests total. `npm run test:unit`, `npm run check`, and `npm run build` pass. All 66 legacy checks have exact one-to-one named tests.
- T2: Added shared protocol constants/message types, migrated the room server to TypeScript, and added five integration tests that spawn the Node 22 server. Tests cover roles, host permissions, every allowed action, invalid names, unknown actions, and equality with `src/types.ts` `Action`.
- `npm run check` now runs all 84 Vitest tests (79 engine + 5 online); `npm run server` starts `server/index.ts` directly.

## Completed preparation

- Installed exact dev dependency `vitest@5.1.0` and added `npm run test:unit`.
- Added `vitest.config.ts` for `tests/**/*.test.ts`.
- Added `tests/helpers/engine.ts` as the single import seam for engine modules.
- Added `tests/helpers/scenarios.ts` for deterministic scripted mission scenarios.
- `npm run check` now runs the engine and online Vitest suites.
- Removed `scripts/run-checks.mjs` after verifying one-to-one coverage; left `src/engine/checks.ts` untouched as required.
- Removed the regex-based `scripts/run-online-checks.mjs`; its checks now run in `tests/online/server.test.ts`.
- Updated the current developer documentation with the new test commands and suite location.
- `npm run check` and `npm run build` pass after the T1 integration.

## Test mapping

| Старая проверка | Новый тест |
|---|---|
| debrief.json без опечаток | `tests/engine/content.test.ts` |
| Без построек миссию не пройти | `tests/engine/economy.test.ts` |
| Риск без построек заканчивается раньше, чем осторожность | `tests/engine/economy.test.ts` |
| Подготовленная база проходит миссию | `tests/engine/economy.test.ts` |
| Подготовленная база сохраняет здоровье (80+) | `tests/engine/economy.test.ts` |
| Без убежища вспышка стоит здоровья | `tests/engine/economy.test.ts` |
| Без батарей лунная ночь оставляет базу без энергии | `tests/engine/economy.test.ts` |
| В экипаже ровно инженер, учёный, врач и техник | `tests/engine/build-and-crew.test.ts` |
| Убежище и медпункт строит врач | `tests/engine/build-and-crew.test.ts` |
| Каждую стройку ведёт отдельный член экипажа, и все члены заняты | `tests/engine/build-and-crew.test.ts` |
| Когда все заняты, пятый модуль не ставится | `tests/engine/build-and-crew.test.ts` |
| Стройка не списывает ресурсы повторно и модуль в стройке ничего не даёт | `tests/engine/build-and-crew.test.ts` |
| За минуту без 0,1 с стройка ещё идёт | `tests/engine/build-and-crew.test.ts` |
| Ровно за 60 с игрового времени модуль готов, а строитель свободен | `tests/engine/build-and-crew.test.ts` |
| Полный день по часам = следующий день | `tests/engine/build-and-crew.test.ts` |
| Полдня по часам день не меняет | `tests/engine/build-and-crew.test.ts` |
| На 6-й день ломается жизнеобеспечение | `tests/engine/build-and-crew.test.ts` |
| Починка кликом стоит столько же, сколько выбор «починить» в окне (цена из events.json) | `tests/engine/build-and-crew.test.ts` |
| Починка при открытом окне поломки закрывает окно и списывает цену | `tests/engine/build-and-crew.test.ts` |
| Починили сразу: в разборе «починили», без «не починили» | `tests/engine/build-and-crew.test.ts` |
| Отложили, потом починили: в разборе «починили позже», без «не починили» и без «починили сразу» | `tests/engine/build-and-crew.test.ts` |
| Отложили и не починили: в разборе только «не починили» | `tests/engine/build-and-crew.test.ts` |
| После конца игры починка и исследование ничего не меняют | `tests/engine/build-and-crew.test.ts` |
| Исследование: верный ответ даёт +24 энергии и +12 материалов, неверный только +8 энергии | `tests/engine/research.test.ts` |
| Исследование выполняется один раз | `tests/engine/research.test.ts` |
| Разведка льда: верный ответ даёт воду и энергию, неверный немного материалов; оба один раз и независимо от пыли | `tests/engine/research.test.ts` |
| Награда за исследование не выходит за лимит хранения | `tests/engine/research.test.ts` |
| Подсказки в окнах событий совпадают с ценами в events.json | `tests/engine/content.test.ts` |
| У каждого источника на экране «Данные NASA» есть название и описание | `tests/engine/content.test.ts` |
| Факт NASA в итогах выбирается по seed: один seed даёт один факт, и текст у него есть | `tests/engine/debrief.test.ts` |
| «На отлично» только если экипаж не остался без ответа на большинство просьб | `tests/engine/debrief.test.ts` |
| В начале экипаж даёт 2 задания | `tests/engine/tasks.test.ts` |
| Задание просит член экипажа с подходящей ролью | `tests/engine/tasks.test.ts` |
| Новых заданий в день не больше 2 до 10-го дня и не больше 1 после | `tests/engine/tasks.test.ts` |
| Открытых заданий одновременно не больше 4 | `tests/engine/tasks.test.ts` |
| Срок задания про убежище = день вспышки | `tests/engine/tasks.test.ts` |
| Без построек задания просрочены, а настроение экипажа падает | `tests/engine/tasks.test.ts` |
| Построили теплицу: задание выполнено, настроение растёт | `tests/engine/tasks.test.ts` |
| Модуль в стройке задание ещё не закрывает | `tests/engine/tasks.test.ts` |
| У каждого задания есть текст и объяснение | `tests/engine/content.test.ts` |
| Во время стройки можно заболеть (нашёлся seed) | `tests/engine/illness.test.ts` |
| Событие болезни: строитель отмечен, стройка и часы стоят | `tests/engine/illness.test.ts` |
| Вылечить: −10 воды и −8 еды, стройка продолжается тем же человеком | `tests/engine/illness.test.ts` |
| С медпунктом лечение вдвое дешевле | `tests/engine/illness.test.ts` |
| Не лечить: больной выбывает на 2 дня, здоровье −5, стройку подхватывает другой | `tests/engine/illness.test.ts` |
| С медпунктом больной выбывает на 1 день | `tests/engine/illness.test.ts` |
| Через 2 дня больной выздоравливает и снова свободен | `tests/engine/illness.test.ts` |
| Если некому подхватить, стройка стоит и время её не идёт | `tests/engine/illness.test.ts` |
| Освободился человек: он подхватывает стройку, и она снова идёт | `tests/engine/illness.test.ts` |
| В первый день никто не заболевает | `tests/engine/illness.test.ts` |
| За миссию не больше 3 болезней и не чаще, чем раз в 5 дней (40 разных seed) | `tests/engine/illness.test.ts` |
| Один seed даёт одну и ту же игру | `tests/engine/illness.test.ts` |
| Разбор болезни: вылечил, не лечил, медпункт | `tests/engine/illness.test.ts` |
| Без склада вода не больше 100 | `tests/engine/economy.test.ts` |
| Со складом вода копится выше 100 | `tests/engine/economy.test.ts` |
| Склад добавляет место воде, еде и материалам, батарея энергии; кислород и здоровье всегда 100 | `tests/engine/economy.test.ts` |
| Разбор: подготовленная база | `tests/engine/debrief.test.ts` |
| Разбор: без убежища | `tests/engine/debrief.test.ts` |
| Разбор: без батарей | `tests/engine/debrief.test.ts` |
| Разбор: без построек | `tests/engine/debrief.test.ts` |
| Разбор: риск | `tests/engine/debrief.test.ts` |
| Разбор (idle): тексты без незаполненных {скобок} | `tests/engine/debrief.test.ts` |
| Разбор (careless): тексты без незаполненных {скобок} | `tests/engine/debrief.test.ts` |
| Разбор (prepared): тексты без незаполненных {скобок} | `tests/engine/debrief.test.ts` |
| Разбор (noShelter): тексты без незаполненных {скобок} | `tests/engine/debrief.test.ts` |
| Разбор (noBattery): тексты без незаполненных {скобок} | `tests/engine/debrief.test.ts` |

Все 66 legacy-проверок имеют тест с тем же названием; 13 дополнительных тестов покрывают сохранения, рекорды и дополнительные seed. Список legacy-проверок снят с baseline `origin/main` до замены раннера.

## Remaining work

- T3: add Chrome-channel Playwright smoke and 60-second performance specs and scripts; keep e2e outside `npm run check`.
- T4: add Vitest and optional e2e steps to `.github/workflows/ci.yml` without changing `deploy.yml`.

## Needs from Claude

In `src/net/online.ts`, replace the current imports and local declarations with this exact patch:

```diff
- import type { Action, Role } from "../types";
+ import type { Action } from "../types";
+ import { ROOM_NAME, type JoinResponse, type Player, type Role } from "../../shared/protocol.ts";
+ export { ROOM_NAME };
...
- export const ROOM_NAME = /^[A-Za-z]{1,20}$/;
...
- export type Player = { id: string; role: Role };
...
- const data = await res.json();
+ const data = (await res.json()) as JoinResponse;
```

The client currently has no local `ACTION_TYPES` or `ROLES` list to replace. Its `Role`, `Player`, room-name rule, and join response can use the shared contract as above. Add concrete `data-testid` requests for T3 only if role/text-based UI interaction proves insufficient.

## Local commands

- `npm run check` — Vitest and online checks.
- `npm run test:unit` — the 79 Vitest engine tests.
- `npm run test:online` — the 5 Node server integration tests.
- `npm run build` — TypeScript and production bundle.

## How to continue

T1 is committed. T2 is complete and ready for a separate commit after `npm run check` and `npm run build`. Continue T3–T4 as separate commits, using the CLI catalog-supported model `gpt-5.6-terra` through `lcode` for each task that includes tests. Run both gates after every commit.
