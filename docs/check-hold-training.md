# Check acceptance and hold training

Turn on **Use Hold Types** in Check & ID Inspection setup. The existing issue-selection review remains part of each case. The decision area asks for a grouped item type and processing decision. Hold Type appears only after **Place Hold**. The app derives classification from the selected item and the business-day availability schedule from the case, then shows the calculated schedule. Placing a hold requires the trainee to confirm delivery of a Hold Notice. The saved answer retains the original scoring fields and required handling steps.

The fictional document identifies its issuer and item type. Cash, ACH and wire cases show transaction advices and cannot receive Reg CC holds. Foreign checks use a separate collection workflow without a receipt. Endorsements, LLC/joint payees, unpaid returns, TrueChecks recommendations, account history and emergency information can change the correct decision. A TrueChecks review recommendation alone does not impose a hold.

`check-holds.mjs` implements the Burke & Herbert training rules supplied in the task. Dollar thresholds are represented in cents. Large deposits use the **aggregate banking-day check amount**, and earlier checks consume the $300/$6,800 allowances before the current item. Availability answers use business-day offsets; they do not assert a calendar date or a holiday calendar.

New-account treatment lasts the first 30 days. Each customer's other transactional account must have been at B&H for at least 30 calendar days and existed within the 30 calendar days before opening. On-Us checks do not receive next-day treatment under this exception. Cases with repeated overdrafts state the bank's determination under the six-month lookback; the supplied material defines no numeric count. Large non-customer cases similarly state the bank's determination: approval limits are not used to invent a large-check threshold.

Acceptance/correction/escalation comes before availability. For simultaneous supported hold conditions the simulator selects emergency, reasonable cause, redeposited, new account, overdraft, then large deposit. The supplied material does not define combined-exception precedence, so generated cases use one exception at a time. Baseline no-hold check deposits use the first $300 same day and the remainder next day for next-day items or day 2 otherwise.

The expandable teller reference includes the payer account, prior check and signature, authorized business presenter, second-ID/history evidence where applicable, and TrueChecks / Alert Center details. Handling checkboxes record which required reviews the trainee performed.

Saved attempts retain the scenario, raw decision inputs, expected result, timing tiers and per-field evidence. History includes item/hold/action filters; Progress and Error Analysis include hold decision opportunities, raw-input errors and acceptance mistakes. Earlier history remains compatible. CSV exports serialize the additional structured fields as JSON.

Verification: `node --test tests/*.test.mjs`; with Playwright available on `NODE_PATH`, `QUIZ_FOCUSED=fraud node tests/browser-smoke.mjs` covers check/ID controls and hold decisions, and `QUIZ_FOCUSED=progress node tests/browser-smoke.mjs` covers progression and numeric labels.
