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

Deployment uses the existing Pages workflow and existing runtime modules. Reverting
the release commit and redeploying restores the prior UI without deleting history.
