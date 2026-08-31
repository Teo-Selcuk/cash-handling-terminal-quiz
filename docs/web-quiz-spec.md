# Browser Quiz and GitHub Pages Specification

## Objective

Maintain a fast, dependency-free browser edition of the Cash Handling Terminal Quiz while retaining `Cash-Handling-Terminal-Quiz.ps1` as the desktop edition. The site must work from GitHub Pages with no server, account, API, or build dependency. Quiz progress and history stay in the user's browser.

## Commands

- Test quiz rules: `& 'C:\Users\syg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/web-quiz-core.test.mjs`
- Run the existing PowerShell structural test: `& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File tests\Cash-Handling-Terminal-Quiz.Tests.ps1`

## Project Structure

- `index.html` - semantic, accessible application shell
- `style.css` - responsive, local styling
- `quiz-core.mjs` - pure money, cash/number/task generation, scoring, and history-export helpers
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

Unit tests cover denomination totals, money formatting, generated question invariants, cash/number/task scoring, task preset bounds, stable task targets, and CSV creation. Browser checks verify that each task briefing, demonstration, reset, recall, review, and summary transition works without console errors. The GitHub Pages workflow runs the Node tests before deployment.

## Boundaries

- Always: preserve the committed PowerShell edition; keep data local; test before committing; deploy only static files.
- Ask first: custom domain, analytics, logins, network APIs, or non-GitHub hosting.
- Never: commit secrets, vendor dependencies, generated history, or build output.

## Success Criteria

- The user can select Easy, Medium, or Hard; a question count; a time limit; and normal or cash-builder mode.
- Questions use the same ten denominations and Easy/Medium/Hard limits as the PowerShell quiz.
- Exact, change, and short answers are scored correctly; cash-builder totals are required only when selected.
- Results, session statistics, browser-local history, CSV export, and clear-history confirmation work without a server.
- A Task Simulation session generates synthetic records, case-management, and invoice-review workspaces from local data at every difficulty. It can use native dialogs, an opened secondary workspace tab, verification-and-retyping fields, dropdowns, checkboxes, and addition, multiplication, or division before an answer is entered. It presents a briefing, demonstrates the same declarative steps with a browser-native cursor animation, resets the workspace, and grades the recalled semantic action sequence only after Save or timeout.
- Task presets are locally editable and resettable for steps, rows, tabs, briefing time, recall time (including untimed practice), and demo speed. The Task Simulation setup contains only Rounds.
- Task controls use native tables and form elements, keyboard-operable tabs, end-only feedback, reduced-motion cursor fallback, and compact browser-local history fields.
- Error Detection is the fourth browser-only mode. Each timed round generates a self-contained terminal-audit card with a simple rule, fixed source facts, and selectable detail cards. A learner must flag every detail that violates the rule, or explicitly select that there are no errors; generated cards can contain zero, one, or multiple errors.
- Error Detection presets are saved and resettable per Easy, Medium, and Hard level. They control the number of details, maximum possible errors, and seconds per round. Difficulty changes error subtlety and the number of plausible distractors: Hard may use near-match arithmetic, transposed identifiers, and close validation values rather than merely a shorter timer.
- Error Detection scoring compares the exact flagged-detail set, records missed errors and false flags in local history/CSV, provides post-round feedback, and honors the shared optional auto-continue-on-timeout setting.
- The page is keyboard accessible and responsive from 320px wide upward.
- The deployment workflow tests the application, uploads the static artifact, and deploys it to GitHub Pages from `main`.

## Implementation Plan

1. Add and test pure quiz rules, including cents-only question generation and CSV export.
2. Add the responsive browser UI, timer, cash builder, feedback, history screens, and Task Simulation workflow.
3. Keep the task generator, demonstration, and scorer on one shared step contract; test its preset bounds, generated targets, timing, and end-only scoring.
4. Keep the Error Detection generator and scorer on one shared detail-card contract; test preset bounds, zero/one/many error cases, exact-set scoring, timing, and the browser controls.
5. Verify the committed site locally and after push.

## Deployment Reference

The workflow follows GitHub's documented Pages Actions sequence: check out the source, upload the static artifact, and deploy it with `actions/deploy-pages`.

Source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
