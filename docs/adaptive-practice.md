# History-based practice

## Objective and acceptance

Offer explainable, local practice recommendations for Cash handling, Number memory,
Task simulation, and Error detection. Show recommendations on setup, results, and
history. Applying one starts a ten-round focused plan through normal quiz setup;
saved difficulty presets remain intact. The user can clear the plan or change setup.

Use at most the latest 120 reached rounds per module and difficulty. Separate
practice conditions (including guided cash, cash builder, requests, and sound).
Require five observations and two errors before identifying a weak spot. Unanswered
rounds remain wrong in the existing history statistics but are excluded from skill
diagnosis. Timeouts count as failed attempts and are identified explicitly.

Cash targets transaction types and amount bands. Memory targets actual digits at a
fixed value count, decimal mode, and timing. Tasks target workflow and step count.
Error detection targets puzzle family and clue count. New records capture precise
settings and outcomes; legacy records only support facts recoverable from their data.

Start one step below repeated difficulty, keeping other conditions stable. After
at least ten scored practice rounds across two completed sessions, with at least
90% overall accuracy and at least 80% in each session, suggest one small increase.
Five or more completed practice rounds below 70% support one small decrease.
Every suggestion gives counts, settings, evidence dates, and its progression rule.
These thresholds are product heuristics, not a validated cognitive assessment.

## Structure and style

Dependency-free ES modules: `adaptive-practice.mjs` owns pure analysis and plan
progression; `app.js` owns DOM, session settings and local history; `quiz-core.mjs`
owns generation and scoring. Follow existing two-space indentation and pure helpers:
`const correct = records.filter((record) => record.outcome === 'Correct').length;`

## Work and verification

1. Add unit cases and the pure recommendation engine.
2. Connect precise history capture, focused generation, and review/apply/clear UI.
3. Exercise plans, progression, refresh, storage, and responsive UI in isolated
   Playwright contexts, then run existing regression suites.

Commands: `node --test tests/*.test.mjs`; `node tests/browser-smoke.mjs` with
Playwright available on `NODE_PATH`; `git diff --check`.
There is no build step. Browser tests serve static assets over localhost.

## Boundaries

Preserve existing dirty work, history keys, scoring, refresh checkpoints, QRAlarm
session evidence, and saved presets. No external AI service, new dependency,
credentials, upload, publication, commit, or PowerShell behavior change is needed.
Keep new assets in the Pages file list so later deployments include the feature.
