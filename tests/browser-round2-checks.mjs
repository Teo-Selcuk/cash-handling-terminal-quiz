import { checkSetupLayout } from './browser-setup-layout-checks.mjs';

// Round 2 acceptance checks: setup layout, history explanations, chart labels, goals, chess.
export async function checkRound2(browser, base) {
  await checkSetupLayout(browser, base);
}
