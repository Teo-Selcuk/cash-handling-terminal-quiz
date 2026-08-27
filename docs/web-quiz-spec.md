# Browser Quiz and GitHub Pages Specification

## Objective

Add a fast, dependency-free browser edition of the Cash Handling Terminal Quiz while retaining `Cash-Handling-Terminal-Quiz.ps1` as the desktop edition. The site must work from GitHub Pages with no server, account, API, or build dependency. Quiz progress and history stay in the user's browser.

## Commands

- Test quiz rules: `& 'C:\Users\syg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/web-quiz-core.test.mjs`
- Run the existing PowerShell structural test: `& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File tests\Cash-Handling-Terminal-Quiz.Tests.ps1`

## Project Structure

- `index.html` - semantic, accessible application shell
- `style.css` - responsive, local styling
- `quiz-core.mjs` - pure money, question, scoring, history-export helpers
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

Unit tests cover denomination totals, money formatting, generated question invariants, answer scoring, and CSV creation. A browser smoke test verifies that the first quiz screen renders, a quiz can be completed, and history/export controls are reachable. The GitHub Pages workflow runs the Node tests before deployment.

## Boundaries

- Always: preserve the committed PowerShell edition; keep data local; test before committing; deploy only static files.
- Ask first: custom domain, analytics, logins, network APIs, or non-GitHub hosting.
- Never: commit secrets, vendor dependencies, generated history, or build output.

## Success Criteria

- The user can select Easy, Medium, or Hard; a question count; a time limit; and normal or cash-builder mode.
- Questions use the same ten denominations and Easy/Medium/Hard limits as the PowerShell quiz.
- Exact, change, and short answers are scored correctly; cash-builder totals are required only when selected.
- Results, session statistics, browser-local history, CSV export, and clear-history confirmation work without a server.
- The page is keyboard accessible and responsive from 320px wide upward.
- The deployment workflow tests the application, uploads the static artifact, and deploys it to GitHub Pages from `main`.

## Implementation Plan

1. Add and test pure quiz rules, including cents-only question generation and CSV export.
2. Add the responsive browser UI, timer, cash builder, feedback, and history screens.
3. Add the GitHub Pages workflow, then verify the committed site locally and after push.

## Deployment Reference

The workflow follows GitHub's documented Pages Actions sequence: check out the source, upload the static artifact, and deploy it with `actions/deploy-pages`.

Source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
