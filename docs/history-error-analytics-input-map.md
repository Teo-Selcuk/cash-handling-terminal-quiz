# History Error Analytics Input Map

Stage 1 analysis for error percentage analytics. This map follows the five browser games that write to the shared local-history model. It distinguishes what a record proves from what it does not prove; legacy rows remain usable without filling in absent values.

## Shared attempt contract

- `persistRecord` in `app.js` stores one round and shared settings/session evidence. In-progress checkpoints use `outcome: "Not answered"` and are replaced by the completed round with the same session/question key.
- Completed outcomes are `Correct`, `Incorrect`, or `Timed Out`. Overall error rate uses `(Incorrect + Timed Out) / completed attempts`; the timeout count is also shown separately. `Not answered` checkpoints are excluded from the numerator and denominator and disclosed as unfinished.
- Existing normalized rows in `progress-analytics.mjs` are the source for filtered reports. Error metrics must use the same already-filtered records as other History metrics, charts, details, and recommendations.
- Numeric magnitude is calculated only from saved numeric response pairs. Categorical choices and memory strings are never assigned a fabricated numeric distance.
- A category rate is defined over its opportunities, not all app attempts. Each table must show the corresponding numerator and denominator; sparse samples are labeled and not promoted as a confirmed strength/weakness.

## Cash Handling

**Mechanic and prompt.** `createQuestion` in `quiz-core.mjs` gives an amount due, cash received, the generated denomination breakdown, and optionally a customer bill request. The player selects Exact / Change / Short and, except for Exact, enters a dollar amount. Cash Builder adds denomination controls; customer requests may constrain a bill breakdown or ask the player to flag an impossible request.

**Recorded correct and user values.** `recordAnswer` in `app.js` saves `amountDueCents`, `cashGivenCents`, `cashTransactionType`, `changeOrShortfallCents`, `userAnswer`, `userDeclaredAmountCents`, tender denomination counts, builder total/breakdown, builder-match result, request kind/result, and timing/difficulty. Session settings are also saved as `settingsJson`. The generated tender is the customer's cash input, not the learner's bill-selection response.

**Error categories and opportunities.**

- Transaction recognition: each answered Exact / Change / Short prompt is one opportunity; wrong selected type is an error.
- Change/shortfall amount: each answered amount prompt is one opportunity; wrong declared cents is an amount error. Over/under direction is calculated from signed cents difference.
- Cash Builder total: only builder-enabled attempts are opportunities; compare selected total with the correct change/shortfall amount.
- Customer bill request: only prompts with a request are opportunities; use the saved handled/not-handled result.
- Per-denomination bill/coin errors: only strict, valid bill-list requests make an individual denomination count uniquely correct. For mixed/low/high style constraints, report the actual request-constraint result, not differences from an arbitrary sample breakdown. For ordinary builder questions, any breakdown with the correct total is valid, so per-denomination “error” is not measurable.
- Workload facets such as tender bills, coins, denominations, due amount, cash mode, difficulty, and timer are conditions to compare, not errors by themselves.

**Numeric magnitude.** Compare `userDeclaredAmountCents` with `changeOrShortfallCents`. Show signed and absolute cent differences and `abs(difference) / abs(correct cents)`. When the expected amount is zero, retain absolute cents and report percentage as N/A unless the difference is also zero (0%).

## Number Memory

**Mechanic and prompt.** `createMemoryChallenge` shows one or more digit strings (possibly with a decimal point) for a configured read duration; the player recalls each value in order before the write timer ends.

**Recorded correct and user values.** `recordMemoryAnswer` saves `expectedValues`, `answeredValues`, per-value digit counts, value count, decimal mode, read/write seconds, difficulty, elapsed response time, correct-value count, and legacy mismatch positions.

**Error categories and opportunities.** Compare strings by sequence/value, preserving leading zeros. A value sequence is an opportunity for wrong-value rate and a digit position is an opportunity for positional error rate. For each value retain wrong-position, missing-digit, extra-digit, and decimal-placement evidence separately; one response can have multiple. Break down by digit length, sequence position, display duration, response duration, and difficulty. Timeout is its own attempt-level error; it must not fabricate digit mismatches when no entry was submitted.

**Numeric magnitude.** A remembered digit sequence is categorical; arithmetic distance between the represented numbers is not meaningful. No numeric percentage deviation is reported.

## Task Simulation

**Mechanic and prompt.** `createTaskChallenge` creates an ordered action sequence for a Records, Casework, or Invoice workspace. The player observes a demo and repeats the required tab, field, checkbox, dialog, and save actions. Invoice tasks can include an arithmetic Final total field.

**Recorded correct and user values.** `recordTaskAttempt` currently saves workflow kind/size, step counts, action-type aggregates, missing/extra/out-of-order categories, difficulty, demo/briefing/recall settings, and timing. The challenge's expected steps and the actual action log are currently transient; new records need step-level evidence to measure which target field/action was missed or entered incorrectly. Do not reconstruct those actions from aggregate counts on old rows.

**Error categories and opportunities.** Each expected action is an opportunity. Keep missing, wrong value/target, extra, and out-of-order errors distinct and retain the target field/action label. Compare rates by Records/Casework/Invoice, action category, target field, expected step count, difficulty, and timer. Corrections/actions are workload, not errors without a mismatch to an expected step.

**Numeric magnitude.** Only a task step whose expected and submitted values are both explicit numeric operands (currently Invoice Final total) supports numeric deviation. Reference numbers, statuses, checkboxes, and sequence positions remain categorical. Save the expected/submitted values for new rows; older tasks have no step-level numeric pair.

## Error Detection

**Mechanic and prompt.** `createErrorDetectionChallenge` selects a puzzle family/rule and presents a set of clue details. Some details show a valid value; anomaly details show a changed value. The player marks a subset as anomalous, and `scoreErrorDetectionAttempt` requires an exact set.

**Recorded correct and user values.** The current record saves family, rule layers, clue count, expected anomaly IDs, selected IDs, missed IDs, false flags, and counts. It does not save all presented clue labels and expected/presented values. New rows need per-clue evidence to support raw clue-level rates; do not invent these labels/values for old rows.

**Error categories and opportunities.** Each presented clue is one classification opportunity: missed anomaly and false-positive selection remain distinct and can co-occur. Report by puzzle family, clue, rule layers, visual/analytical type, difficulty, and timer. An answer timeout is an attempt error but is not converted to a set of guessed clue mistakes.

**Numeric magnitude.** Puzzle answers are clue selections, so there is no numeric answer distance. Numeric-looking clue contents are evidence for the puzzle rule, not the player's numeric answer.

## Check & ID Fraud Inspection

**Mechanic and prompt.** `fraud-inspection.mjs` generates fictional checks and IDs with zero or more enabled issue categories. The player selects the suspected issue set; scoring distinguishes missed issues from false positives and clean-case recognition. Scenario fields include payee/name, written/numeric amounts, date, alteration, endorsements/maker signature, check/MICR/account/routing, and ID identity/date/photo details.

**Recorded correct and user values.** The record saves actual issue categories and explanations/regions, selected/found/missed/false-positive categories, per-enabled-category results, clean-case flags, category count, case difficulty, run mode, timer, and outcomes. Scenario documents are not fully serialized; only persisted issue evidence can support analytics.

**Error categories and opportunities.** For a category present in a case, a miss is a false negative; for an enabled absent category, a selection is a false positive. Keep those denominators separate and use per-category outcomes only when they were actually recorded. A case-level error is any non-exact issue-set answer or timeout. Break down by issue type/group, clean versus issue-bearing case, case difficulty, run mode, timer, and enabled categories.

**Numeric magnitude.** Fraud review selects categorical issue labels. Monetary/check/ID values are scenario evidence, not a numeric answer submitted by the learner; do not report numeric deviation.

## Implementation consequences

- Preserve existing accuracy and current History filters; add matching error-rate views with numerator/denominator disclosure.
- New instrumentation is additive on new records only: cash builder denomination maps when those counts are meaningful, task expected/action evidence, and error-detection per-clue evidence. Existing fields are used when sufficient; absent legacy metadata remains unavailable.
- Shared dimensions are only difficulty/time/date and correct/incorrect/timeout. All detailed category taxonomies are game-specific.
- Raw-input categories and input combinations need a minimum of five relevant opportunities before ranking in a strength/weakness list. The exact count is still shown below that threshold as a limited signal.
- Comparisons use matching opportunity rows (for example, only cash Change prompts when comparing change skill, only enabled/present fraud categories for miss rates). Sample Data uses the same calculation path and an explicit sample label without touching saved real history.
