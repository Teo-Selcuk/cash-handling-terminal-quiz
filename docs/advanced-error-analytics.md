# Detailed digit and arithmetic analytics

History uses the selected Real or Sample source and existing filters. Original
expected/entered strings and integer cents stay in history; analytics do not rewrite
old attempts. Unsupported legacy records and blank timeouts are disclosed and
excluded from detailed denominators. Existing overall error/timeout rates remain.

Digit positions compare from the beginning of each value, without guessing an
insertion alignment. Leading zeros remain significant. Missing expected digits are
positional errors; extra digits and decimal placement are separate. Length rates
count wrong values, position/region rates count expected digits. Confusion cells
count matched digit pairs; the diagonal is correct recall. Missing/extra digits
have no pair. Rankings require five opportunities; ties retain position order.
Position trends sort by date and include only recorded pairs.

Cash component classes (dollar-only, cent-only, both) are exclusive. Arithmetic
accuracy compares the entered amount with the target and is distinct from overall
transaction/builder accuracy. Exact amounts have no subtraction opportunity.
Change and Short use larger amount minus smaller amount. Addition metrics require
explicit saved addition operands and target; current cash gameplay asks subtraction.
Opposite-operation confusion requires exact equality with a distinct opposite result.
Cent confusion compares cents modulo 100 with the opposite cents operation.
Carry/borrow omission requires a crossing and the exact result one dollar below an
addition target or above a subtraction target. These are likely signatures, not
proof of mental reasoning, and overlap with component classes. Carry/borrow rates
use only crossing opportunities. Magnitude charts count answers including zero
error, while time charts count wrong numeric answers. Rates show two decimals at
most, with raw numerator/denominator tables.

Global table controls affect every currently mounted table/list on the page,
including chart data tables. Reset selects normal size (about 28 rows), preserving
data, filters, sorting, chart settings and individual controls. Table sizes survive
rerenders during the current page session. New tables default to normal.

## Value credit and memory load

Number Memory awards one point per round, prorated by fully correct values:
`correct values / expected values`. Decimal placement and leading zeros are part
of the value. Exact-round outcomes and streaks remain separate from fractional
points. Digit accuracy compares expected digit positions; extra digits and decimal
placement remain separately visible and make the whole value incorrect.

Feedback, session points, History, daily Progress, difficulty charts, response-time
charts and conditional performance comparisons use this same credit calculation.
Each round has equal weight in session accuracy; value and digit totals are also
shown separately. Intermediate scores retain full precision and are rounded only
for display. Unfinished checkpoints are excluded from memory score denominators.
For legacy history, stored string pairs take precedence; otherwise valid saved
correct-value/total-value counts support value credit only. Missing evidence is
disclosed and excluded rather than assigned a guessed digit score. Raw attempts
are preserved. The account sync layer carries those raw records across devices.

Value-position, digit-position and memory-load tables show observed errors and
opportunities. The value × digit heatmap shows an error percentage with its raw
digit denominator. Load rows distinguish difficulty, value count, actual lengths
and total digits. Compare value counts while keeping length fixed, and lengths
while keeping count fixed; observations alone do not prove a causal explanation.
Adjacent swapped digit patterns are reported without assuming the player's intent.

## Cash mistake possibilities and recorded working

The optional working form saves a cash total and up to three operand/operator/result
triples without validating or revealing answers during the active round. Blank or
incomplete triples provide no confirmed step evidence. A recorded arithmetic error
is confirmed only relative to the entered operands; a later mathematically correct
step can still carry forward an earlier wrong input. Active guided prompts explain
the method; worked answers remain in post-submission feedback.

When tender denominations reconcile with the saved tender total, integer-cent
hypotheses test one extra/missing piece, a misread denomination, an omitted term,
and two simultaneous count changes. A candidate is shown only if its resulting
change/shortfall matches the entered amount exactly. Hypothetical $2/$4 bill values
represent misreads, not available Cash Builder denominations. Multiple matches are
listed as possibilities. Counting stages refer to recorded tender terms, not the
order the player mentally used. No match means the cause remains unavailable.

Cash stage and cause counts distinguish confirmed working from inferred signatures.
Denomination confusion counts are overlapping matching attempts, not proved
confusion rates. Step accuracy trends require recorded work; legacy attempts cannot
provide first/second/third-step accuracy without it. Existing dollar/cent, operation,
carry/borrow and difficulty rates retain their supported denominators.

Verification includes partial credit from 1–12 values, zero/decimal/missing/extra
digit handling, cash count/denomination/opposite-operation/borrow signatures,
multiple explanations, recorded-step propagation, browser gameplay and local
Firebase emulator synchronization across two profiles, offline saving and reload.

Deployment uses the existing Pages workflow and existing runtime modules. Reverting
the release commit and redeploying restores the prior UI without deleting history.
