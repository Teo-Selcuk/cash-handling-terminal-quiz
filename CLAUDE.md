# CLAUDE.md

Project notes and working rules for agents editing this repository. This file
replaces `AGENTS.md`; keep every agent rule here so there is one source of truth.

## Project

- Browser quiz served as static files (GitHub Pages): `index.html`, `style.css`,
  `app.js`, and the `*.mjs` modules beside them. No build step.
- `Cash-Handling-Terminal-Quiz.ps1` is the separate Windows PowerShell edition.
- Games: Cash handling, Number memory, Task simulation, Error detection,
  Check & ID Fraud Inspection, Typing speed, Multitasker, Chess.
- History & Progress analytics live in `progress-analytics.mjs` (data) and
  `app.js` (rendering). Plain-language chart and table explanations live in
  `history-explanations.mjs`. Speed goals and progressive levels live in
  `speed-goals.mjs`.
- When a module changes, bump its `?v=` cache-bust query where it is imported,
  and bump `style.css?v=` / `app.js?v=` in `index.html`.
- Startup speed: `index.html` lists a `modulepreload` link for every module `app.js` loads (plus the Firebase SDK).
  A module must be imported under one `?v=` URL everywhere. Regenerate the links with
  `collectModuleGraph` from `scripts/module-graph.mjs`; `tests/performance.test.mjs` fails when they drift.
  The first screen must never wait on the Firebase network (`firebase-accounts.mjs` connects in the background).
  Analytics in `progress-analytics.mjs` are cached by record content; keep them pure.
- New top-level modules must also be copied in `.github/workflows/deploy-pages.yml`
  and allowed in the static server list in `tests/browser-smoke.mjs`.

## Tests

- Unit tests (required gate): `node --test tests/*.test.mjs`
- Browser checks (need Playwright on `NODE_PATH`): `node tests/browser-smoke.mjs`.
  `QUIZ_FOCUSED=<name>` runs one focused group.
- Sync and Fraud checks need the Firebase emulators and Java: `firebase emulators:start --only auth,firestore --project cash-handling-quiz`
  (ports are in `firebase.json`), then `QUIZ_EMULATORS=1 QUIZ_FOCUSED=firebase|fraud|sync-backlog node tests/browser-smoke.mjs`.

## Change rules

- Fix and improve only what the task lists. Do not change working behavior
  unless the task requires it.
- Old history records keep only the fields they saved. Charts must say how many
  attempts they used when a newer field is missing.
- Charts: one clear view per metric, no duplicate charts. Each data label sits on
  the row of the bar it describes. Totals for one metric must match across the
  page. Chart Appearance settings control every chart label (color, size, font);
  never hard-code dark text that can land on a dark background.
- Every chart and data table has a short "What this shows" explanation in simple
  words, shown or hidden with an info toggle.
- History page tables (not chart data tables) live in one "All tables" section, collapsed by default, with a table
  count in its header and Minimize/Expand all buttons. Tests that need a table must open it first
  (`openAllTables` in `tests/browser-all-tables-checks.mjs`) and find moved tables by `data-table-source`.
- Setup screen game cards share one width and height; long text wraps inside.
- Cash handling answer choices: picking Exact, Change, or Short (keypad `/ * -` or a click) never moves
  focus into the cash builder and never changes a bill or coin count. Change and Short move focus to the
  amount box (or keep it there); Exact turns the amount box off and focuses its choice. Switching choices
  keeps the typed amount and the cash builder counts. The keypad keys also work inside the amount box
  (`data-option-shortcuts="true"`), because `/ * -` are never valid amount characters.
- Cash amount boxes (the answer amount and the optional working fields) use `attachAmountFilter` from
  `amount-input.mjs`: digits and one decimal point, at most 2 decimal places, at most 10 characters.
  Invalid typed characters are blocked; pasted text keeps only valid characters, keeps the first point,
  and shows a message. A typed comma becomes the decimal point when there is none yet. A blank box or a
  lone "." is no answer, not $0.00 (`readAmountCents`). Bill and coin counts use +/- buttons, not typed
  fields; any typed count field would use `{ decimal: false }` (digits only).
- Speed goals: a round passes a goal when success rate >= 90% and average answer
  time <= the goal time (exact limits pass). Passing a goal unlocks the next;
  a level unlocks only after the previous level's goals pass.

## Auto-upload rule (commit and push)

After each completed change:

1. Run the unit tests. If any fail, do not commit or push; report the failures.
2. Commit with a message that names the changed section, for example
   `Setup layout: equal card sizes`.
3. Push to the branch this work uses (currently `codex/error-percentage-analytics`).
   `node scripts/auto-upload.mjs "<message>"` runs steps 1-3.
4. Never force-push and never rewrite existing history.
5. If the push fails (network, access, conflict), keep the local commit, report
   the error, and do not retry in a loop.
6. Never commit secrets, local settings, logs, or build output; keep them in
   `.gitignore`.
