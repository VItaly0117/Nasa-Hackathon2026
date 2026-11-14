# Codex infrastructure report

## Status

Work is paused before T1 test generation because the required `lcode` delegation route currently rejects every tested Codex model with `model_not_found`. `lcode --quota` reports the Gemini/Claude weekly pool at 99–100% used and the Codex 5-hour window at 7% used. The Codex CLI default (`gpt-6.1-sol`), the locally documented former default (`gpt-6-sol`), and `gpt-5.3-codex`, `gpt-5.2-codex`, and `gpt-5.4` were rejected by the ChatGPT account. No model generation was completed; no raw proxy, credential, or quota-guard bypass was used.

This branch remains based on `origin/main` and is named `codex/infra`. No files in `src/` were changed. T2, T3, and T4 have not started.

## Completed preparation

- Installed exact dev dependency `vitest@5.1.0` and added `npm run test:unit`.
- Added `vitest.config.ts` for `tests/**/*.test.ts`.
- Added `tests/helpers/engine.ts` as the single import seam for engine modules.
- Added `tests/helpers/scenarios.ts` for deterministic scripted mission scenarios.
- Baseline and current `npm run check` pass, including all 66 legacy engine checks and the existing online checks.
- `npm run build` passes.

Vitest is intentionally not wired into `npm run check` yet: there are no generated Vitest suites, and the legacy runner remains the active protection until the full mapping is complete.

## Test mapping

Not completed. No old check has yet been ported; therefore no mapping rows are claimed and `scripts/run-checks.mjs` remains in place. The baseline run captured 66 passing checks. T1 must create and verify a one-to-one mapping for every emitted legacy check before replacing the runner.

## Remaining work

- T1: generate eight Vitest suites (economy, build-and-crew, tasks, illness, debrief, research, content, determinism), add save/load/records and multi-seed `missionFact`/`buildReport` coverage, document all 66 mappings, then switch `npm run check` and retire the old runner only after parity.
- T2: implement `shared/protocol.ts`, convert the server to TypeScript, replace regex online checks with Vitest server tests, and document the exact `src/net/online.ts` patch for Claude.
- T3: add Chrome-channel Playwright smoke and 60-second performance specs and scripts; keep e2e outside `npm run check`.
- T4: add Vitest and optional e2e steps to `.github/workflows/ci.yml` without changing `deploy.yml`.

## Needs from Claude

- No game-source edits are requested yet. After T2, this section should contain the exact protocol import/list patch for `src/net/online.ts` and any concrete selectors needed by e2e, if role/text-based interaction proves insufficient.

## Local commands

- `npm run check` — current legacy engine and online checks.
- `npm run test:unit` — Vitest (currently no suite files, until T1 resumes).
- `npm run build` — TypeScript and production bundle.

## How to continue

First restore a model slug supported by the authenticated Codex CLI (or wait for a delegated backend quota to recover), then rerun the required `lcode` test-writing jobs. Keep the current Vitest scaffold and central engine helper. Complete T1 and commit only after the full mapping is green; continue T2–T4 as separate commits, running `npm run check` and `npm run build` after each commit.
