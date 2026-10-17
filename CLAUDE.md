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
- New top-level modules must also be copied in `.github/workflows/deploy-pages.yml`
  and allowed in the static server list in `tests/browser-smoke.mjs`.

## Tests

- Unit tests (required gate): `node --test tests/*.test.mjs`
- Browser checks (need Playwright on `NODE_PATH`): `node tests/browser-smoke.mjs`.
  `QUIZ_FOCUSED=<name>` runs one focused group.

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
- Setup screen game cards share one width and height; long text wraps inside.
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
