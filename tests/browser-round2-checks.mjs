import { checkSetupLayout } from './browser-setup-layout-checks.mjs';
import { checkHistoryLabels } from './browser-history-labels-checks.mjs';
import { checkExplanations } from './browser-explanations-checks.mjs';

// Round 2 acceptance checks: setup layout, history explanations, chart labels, goals, chess.
export async function checkRound2(browser, base) {
  await checkSetupLayout(browser, base);
  await checkHistoryLabels(browser, base);
  await checkExplanations(browser, base);
}
