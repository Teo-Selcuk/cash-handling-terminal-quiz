# Browser Quiz and GitHub Pages Specification

## Objective

Maintain a fast, dependency-free browser edition of the Cash Handling Terminal Quiz while retaining `Cash-Handling-Terminal-Quiz.ps1` as the desktop edition. The site must work from GitHub Pages with no server, account, API, or build dependency. Quiz progress and history stay in the user's browser.

## Commands

- Test quiz rules: `& 'C:\Users\syg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/web-quiz-core.test.mjs`
- Run the existing PowerShell structural test: `& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File tests\Cash-Handling-Terminal-Quiz.Tests.ps1`

## Project Structure

- `index.html` - semantic, accessible application shell
- `style.css` - responsive, local styling
- `quiz-core.mjs` - pure money, cash/number/task/puzzle generation, scoring, and history-export helpers
- `app.js` - DOM interaction and browser-local state
- `tests/web-quiz-core.test.mjs` - fast Node rule tests
- `.github/workflows/deploy-pages.yml` - test and GitHub Pages deployment

## Code Style

Business values use integer cents; no money calculations use floating point. Browser code is standard ES modules with no third-party runtime dependencies.

```js
const changeCents = tenderedCents - dueCents;
const isCorrect = answer.type === expectedType && answer.amountCents === expectedAmountCents;
```

## Testing Strategy

Unit tests cover denomination totals, money formatting, generated question invariants, cash/number/task/puzzle scoring, task preset bounds, stable task targets, CSV creation, and the off-by-default sound safety contract. Puzzle tests prove every generated anomaly is selectable, every family has a worked-rule example, and Easy/Medium/Hard add reasoning complexity rather than only reducing time. Browser checks verify each Error Detection briefing, example, timed puzzle, review, and summary transition without console errors. The GitHub Pages workflow runs the Node tests before deployment.

## Boundaries

- Always: preserve the committed PowerShell edition; keep data local; test before committing; deploy only static files.
- Ask first: custom domain, analytics, logins, network APIs, or non-GitHub hosting.
- Never: commit secrets, vendor dependencies, generated history, or build output.

## Success Criteria

- The user can select Easy, Medium, or Hard; a question count; a time limit; and normal or cash-builder mode.
- Questions use the same ten denominations and Easy/Medium/Hard limits as the PowerShell quiz.
- Exact, change, and short answers are scored correctly; cash-builder totals are required only when selected.
- Customer bill requests are an off-by-default cash-builder addition on change rounds. Requests rotate through exact named bills, named bills plus a remaining denomination, mixed bills, low bills, and high bills.
- A valid request is honored only when the selected bills meet its stated preference and the selected cash totals the required change. A mismatched or unsupported request can be flagged, or the learner can give the exact amount instead. The trainer never presents a $30 bill as an available denomination.
- Browser and PowerShell editions use the same request types, preserve the normal Exact/Change/Short behavior when the option is disabled, and record the request plus the learner's handling in history.
- Results, session statistics, browser-local history, CSV export, and clear-history confirmation work without a server.
- A Task Simulation session generates synthetic records, case-management, and invoice-review workspaces from local data at every difficulty. It can use native dialogs, an opened secondary workspace tab, verification-and-retyping fields, dropdowns, checkboxes, and addition, multiplication, or division before an answer is entered. It presents a briefing, demonstrates the same declarative steps with a browser-native cursor animation, resets the workspace, and grades the recalled semantic action sequence only after Save or timeout.
- Task presets are locally editable and resettable for steps, rows, tabs, briefing time, recall time (including untimed practice), and demo speed. The Task Simulation setup contains only Rounds.
- Task controls use native tables and form elements, keyboard-operable tabs, end-only feedback, reduced-motion cursor fallback, and compact browser-local history fields.
- Error Detection is the fourth browser-only mode. It is a varied anomaly-puzzle game, not a terminal-audit card. Every round starts with an untimed briefing that names the puzzle, explains its rule, and shows a worked valid/invalid example. The learner explicitly starts the timed hunt with Next.
- Puzzles rotate across at least five rule families: visual symbol matrices, number-transform machines, code/cipher checks, schedule/logic boards, and route networks. Visual families use inline accessible SVG/CSS patterns with text alternatives; no remote image assets or accounts are required.
- A learner must flag every anomalous clue, tile, connection, or row, or explicitly select that there are no anomalies. Generated puzzles can contain zero, one, or multiple anomalies, and scoring compares the exact selected set.
- Error Detection presets are saved and resettable per Easy, Medium, and Hard level. They control the number of selectable clues, maximum possible anomalies, and seconds per round. Easy uses a single rule and transparent changes; Medium combines rules and plausible near-misses; Hard combines dependent transformations, positional constraints, and near-match distractors rather than merely reducing the timer.
- Error Detection records the puzzle family, missed anomalies, false flags, and corrections in local history/CSV, provides post-round feedback, and honors the shared optional auto-continue-on-timeout setting.
- The page is keyboard accessible and responsive from 320px wide upward.
- One off-by-default browser-only distraction-sound option is available for all four practice modes. When enabled, its capped, level-changing synthetic noise begins at the first timed practice phase, continues through feedback and question transitions, and stops at results or an explicit exit. The site clearly states it cannot inspect Windows 11 system-mute state.
- The deployment workflow tests the application, uploads the static artifact, and deploys it to GitHub Pages from `main`.

## Implementation Plan

1. Add and test pure quiz rules, including cents-only question generation and CSV export.
2. Add and test customer-request generation, request validation, and an explicit invalid-request flag path before wiring either user interface.
3. Add the responsive browser UI, timer, cash builder, feedback, history screens, and Task Simulation workflow.
4. Mirror cash-builder customer-request behavior in the PowerShell edition, including safe persisted defaults and history fields.
5. Keep the task generator, demonstration, and scorer on one shared step contract; test its preset bounds, generated targets, timing, and end-only scoring.
6. Keep the Error Detection puzzle generator and scorer on one shared anomaly contract; test five puzzle families, rule walkthrough examples, zero/one/many anomaly cases, exact-set scoring, timing, responsive visual rendering, and browser controls.
7. Verify the committed site locally and after push.
8. Keep optional continuous distraction noise behind one off-by-default toggle, use a capped Web Audio gain with bounded level variation, begin audio setup only from Start quiz, and stop it at quiz results or exit.

## Deployment Reference

The workflow follows GitHub's documented Pages Actions sequence: check out the source, upload the static artifact, and deploy it with `actions/deploy-pages`.

Source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
