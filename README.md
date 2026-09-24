# Cash Handling Terminal Quiz

A Windows 11 PowerShell practice quiz for teller-style cash handling. It generates random customer transactions and asks whether the customer paid the exact amount, needs change, or is short.

## Main features

Cash handling offers **Guided practice** (customer dialogue, calculations, what to
say, and cash guidance) and **Test my knowledge** (timed answers with feedback).
Select the mode in browser setup, or choose G/T in PowerShell cash setup. Browser
guided practice is untimed; PowerShell provides an untimed walkthrough before the
configured answer timer. History labels the mode. See [mode details](docs/cash-session-modes.md).

The [browser edition](https://teo-selcuk.github.io/cash-handling-terminal-quiz/) also includes Number Memory, Task Simulation, 15 rotating Error Detection games, and Check & ID Fraud Inspection. Fraud Inspection generates fictional check and ID documents with selectable Easy, Medium, Hard, and Custom settings, zoomable SVG previews, exact-set scoring, clean cases, speed modes, local category history, and issue-by-issue feedback. During inspection, document fields have no answer-revealing highlights; learners inspect the details and select one or more issue labels or No Issues Found. After submission, feedback marks the actual issue fields. Its documents use invented training values and do not make authenticity decisions.

- Easy, Medium, and Hard difficulty levels
- Random customer totals and random cash combinations
- Bills: $100, $50, $20, $10, $5, and $1
- Coins: quarter, dime, nickel, and penny
- Adjustable number of questions
- Adjustable time limit for each question
- Typed answer mode
- Optional clickable denomination mode
- Suggested bill-and-coin breakdown after each answer
- Detailed CSV history with accuracy, timing, answers, and selected denominations
- Default history location in the Windows Downloads folder

## Files

- `Cash-Handling-Terminal-Quiz.ps1` — runnable PowerShell quiz
- `index.html`, `app.js`, `quiz-core.mjs`, and `style.css` — browser edition
- `README.md` — this guide

## Run the quiz

1. Download `Cash-Handling-Terminal-Quiz-v2.ps1`.
2. Open Windows PowerShell or PowerShell 7.
3. Run the file:

```powershell
& "$HOME\Downloads\Cash-Handling-Terminal-Quiz-v2.ps1"
```

If Windows blocks the script for the current terminal session, use:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "$HOME\Downloads\Cash-Handling-Terminal-Quiz-v2.ps1"
```

The execution-policy change above applies only to the current PowerShell window.

## Quiz data location

At startup, the quiz asks where to store its data.

Press **Enter** to use the recommended location:

```text
C:\Users\<your-user-name>\Downloads\Cash-Handling-Quiz-Data
```

The main history file is:

```text
Cash-Handling-Quiz-History.csv
```

You can type a different folder instead. If an older version of the history file is found, the script upgrades it and saves a dated legacy backup first.

## Answer note shown before every quiz

```text
E = Exact amount
C = Change
S = Short
```

In typed mode, examples are:

```text
E
C 12.35
S 4.10
```

- `E` means the customer gave the exact amount.
- `C 12.35` means give the customer `$12.35` in change.
- `S 4.10` means the customer is `$4.10` short.

During the questions, `E` means **Exact**, not Easy.

## Turn clickable bill/coin mode on or off

Each time you start a quiz, it asks:

```text
Use clickable bill/coin mode? [Y/N] [N]
```

- The default is **off**. Enter `N`, or press Enter, to keep the existing typed-answer flow.
- Enter `Y` to add a final cash-building step after your typed answer.
- In **Settings**, option `4` changes the saved default used at the next quiz setup. You can still override it for an individual quiz.

### Clickable mode workflow

For each question, a Windows cash-builder window opens.

The popup uses a high-contrast dark layout with separate **Bills** and **Coins** sections, large `+`/`-` controls, a prominent timer, and visible Enter/Esc keyboard hints.

1. Answer the transaction as usual: `E`, `C 12.35`, or `S 4.10`.
2. Click `+` and `-` beside individual bills and coins to build your declared amount.
3. The window automatically updates the selected total and whether it matches your declared amount.
4. Click **Submit cash construction** to have the quiz grade the result.

For a Change answer, the selected bills and coins represent what you would give back to the customer.

For a Short answer, they represent the additional cash the customer still needs to provide.

For an Exact answer, no bills or coins should be selected.

The quiz accepts any valid denomination combination whose total matches the correct amount. It does not require one specific combination. An incorrect selection is still submitted so the result, difference, and selected denominations are saved to history.

## Denominations in clickable mode

| Denomination | Value |
|---|---:|
| $100 bill | $100.00 |
| $50 bill | $50.00 |
| $20 bill | $20.00 |
| $10 bill | $10.00 |
| $5 bill | $5.00 |
| $1 bill | $1.00 |
| Quarter | $0.25 |
| Dime | $0.10 |
| Nickel | $0.05 |
| Penny | $0.01 |

All ten denominations are available in the clickable answer window, including during Easy mode. The cash the customer initially hands you still follows the selected difficulty's generation rules.

## Difficulty levels

### Easy

- Customer totals up to $200
- Quarter increments
- Simpler combinations
- Customer cash uses $20, $10, $5, $1, and quarters

### Medium

- Customer totals up to $1,000
- Exact cents
- All normal bill and coin denominations
- More mixed cash combinations

### Hard

- Customer totals up to $5,000
- Exact cents
- All normal bill and coin denominations
- Larger differences and more complicated combinations

## Feedback after each question

After you submit, the quiz shows:

- Required amount
- Selected amount and bill/coin breakdown
- Difference from the required amount when incorrect
- Correct or Incorrect
- An example correct breakdown
- The correct Change, Short, or Exact result
- How much cash the customer actually handed over
- How long you used

Example:

```text
One way to give the customer $27.35 in change:
1 x $20 bill, 1 x $5 bill, 2 x $1 bills, 1 x quarter, 1 x dime
```

For a shortage, the recommendation shows one possible combination the customer could still provide.

## History

Choose **View detailed history** from the main menu. The history records:

- Date and time
- Difficulty
- Answer mode
- Time limit and time used
- Amount owed
- Cash the customer handed over
- Correct answer
- Recommended denomination breakdown
- Your declared answer
- Your selected denomination total and breakdown
- Correct, incorrect, or timed-out result

Choose **Clear history** to delete the current CSV. The script requires you to type `CLEAR` before deleting it.

## Important behavior

- Question amounts are generated randomly.
- The time limit applies to both answer modes.
- Closing the clickable window stops the quiz safely.
- Completed questions remain in history if the quiz is stopped.
- The script stores data locally and does not need an online account.
- Clickable mode is intended for Windows 11 and uses the Windows Forms interface included with Windows PowerShell/.NET.

## Browser verification

The website offers **Practice recommendations** on setup, results, and history.
It uses local history to identify repeated trouble with cash amount bands and
transaction types, memory digit lengths, task workflows and step counts, and
error-detection puzzle families. Each plan shows the evidence, proposed settings,
and why the workload is reduced. Choose **Use practice plan**, review it, and
start a session. Saved difficulty presets are preserved; **Clear practice plan**
returns to the selected preset.

Recommendations require at least five comparable observations and two errors.
Unanswered rounds count against ordinary history accuracy but are excluded from
skill diagnosis. After sustained success across two completed practice sessions,
the next plan suggests one small increase. Older history supports only the details
it actually recorded. All analysis runs on this device without a GPT service or
API key. See [adaptive practice rules](docs/adaptive-practice.md).

Run `node --test tests/*.test.mjs` for all unit tests and
`node tests/browser-practice-checks.mjs` for focused practice acceptance, including
two complete ten-round sessions, progression after refresh, and responsive layouts.
The latter uses isolated fixture history and writes screenshots to `.artifacts/`.
Set `QUIZ_LIVE_URL` to the Pages URL to verify the deployed practice recommendations.

Run `node --test tests/web-quiz-core.test.mjs` for the core rules. With Playwright and its Chromium browser installed (and available through `NODE_PATH` if installed outside this repository), run `node tests/browser-smoke.mjs` for isolated, muted browser checks. Set `QUIZ_LIVE_URL` to the Pages URL to run the same checks against the published site.

The browser suite covers all four games and three difficulty presets at 320, 390, 768, 1024, and 1440 pixels, answer/timeout continuation, continuous audio cleanup, cash builder controls, customer bill requests, saved 100-digit memory values, and complete custom 10-step records/casework/invoice workflows. It checks overflow, compact touch targets, and readable task inputs. Each scenario uses fresh browser storage; screenshots go to the temporary directory.

The compact task layout includes 1024-pixel landscape tablets. Case notes remain accessible from the Verification tab so longer casework sequences can be completed without an extra, unrequested tab switch. These checks emulate viewport and touch behavior in Chromium; they do not replace physical iOS/Android device testing.

## Progress analytics

The browser History screen is a local **History | Progress | Charts | Attempts** workspace. It keeps existing saved attempts untouched and adds optional detail only to new attempts. A shared analytics module normalizes each record, treats missing legacy fields as “not recorded,” removes checkpoint/replacement duplicates, and then feeds the same filtered attempt set to metrics, charts, drill-downs, and the recommendation.

Choose a game tab to reveal filters that match that game’s actual work: cash denominations and piece count; memory digit load and mismatch positions; task workflow, steps, and action mistakes; or puzzle family, rule depth, and anomaly mistakes. Chart marks are keyboard-operable and open the exact contributing attempts. Charts include a table alternative and never pretend an old attempt recorded a newer mechanic.

Each populated chart has a value color scale beside it. The same value keeps the same hue when you zoom or pan; accuracy scales from 0% to 100%, and other measures scale from zero to the largest plotted tick. The difficulty summary uses the same accuracy scale. Date charts place observed days according to calendar time and connect successive observations without claiming that any attempts occurred between them. Speed versus accuracy uses the same card layout as the other charts. The exact values remain visible in labels and tables, so color is not required to read a result.

The performance report lets you combine two recorded conditions. Its percentage is correct matching attempts divided by all matching answered attempts, with the actual count and a 95% Wilson interval. The Strengths and Work on lists say how many attempts were correct, how many matched, how many percentage points higher or lower the result was, the comparison result and count, the estimated 95% accuracy range, and the supporting evidence. Response-time bands are 0–5, >5–10, >10–15, and >15 seconds; “correct by” 5/10/15 seconds uses all attempts with measured time as its denominator. Timed-out attempts count as unsuccessful; unanswered checkpoints and missing older fields are shown separately. Strengths and weaknesses compare with attempts from the same game, difficulty, and mode: 5–9 matches are early signals, while a recurring pattern requires at least 10 matches and 20 comparable attempts.

Each game has more specific diagrams. Cash shows $100 bill count, denominations, signed answer error, and recorded builder clicks. Its multiplication and addition figures are inferred denomination workloads, **not** observed mental calculations. Memory shows digit errors, omitted and extra digits, decimal errors, and partial recall. Task Simulation records compact counts of missing, extra, out-of-order, tab, and correction actions. Error Detection and Check & ID show missed plus false selections as the number of marks to fix. Fraud issue detection uses cases where an issue was present; false flags use cases where it was absent. Scatter Zoom in/out and drag selection operate on response-time seconds, and Reset restores the full range.

History presents one **Recommended Next Challenge** at a time. It requires repeated comparable evidence, explains the accuracy and/or speed gap, starts one relevant workload axis below the observed threshold, and records recovered challenges from immutable practice-attempt evidence. Applying a challenge updates normal setup controls; it does not rewrite saved presets. QR Alarm remains a collapsed `QR Alarm` section and continues to receive measurement-only history fields.

Run `node --test tests/progress-analytics.test.mjs tests/adaptive-practice.test.mjs` for the analytics and adaptation rules. The browser smoke check includes `tests/browser-progress-checks.mjs`; it verifies each game’s unique controls, quick ranges, chart controls, keyboard drill-down, and responsive layout when Playwright is available.

## QRAlarm performance connection

The browser quiz can provide saved performance evidence to QRAlarm while this
tab is open. Start the QRAlarm interactive CLI, configure a Cash Handling QR,
and run `info <QR ID> --connect`. Open its pairing link in this tab or paste it
into the QRAlarm connection panel. Approve the browser local-network permission
when prompted. The panel displays Connected, Reconnect required or Unavailable.
After a tab or QRAlarm restart, obtain a fresh link explicitly. The browser's
history identifier persists; pairing credentials remain only in memory and are
removed from the URL fragment.

The connection reads persisted local history, including reached-but-unanswered
questions and submitted replacements. Completed sessions save evidence version
2: stable game, difficulty, planned question count, start/completion timestamps,
elapsed session time and the settings captured at session start. Those settings
include Auto Continue, continuous-noise preference and maintained playback,
Cash Builder and customer build requests. Changing setup controls during a quiz
does not rewrite that snapshot. Older history is preserved but cannot prove
fields it did not save. Playback evidence describes application audio state,
not physical speaker volume.

QRAlarm requests measurement fields only; the bridge does not receive answer
text or serve files/commands. A storage failure is reported explicitly rather
than returned as an empty successful history. Each fresh unlock needs a matching
current response; previous successful responses do not authorize it.

The companion acceptance harness in QRAlarm's
`tests/integration/test_cash_browser.py` exercises this real writer and local
connection in a disposable Playwright context, including same-tab fragment
pairing, storage failure and reconnect. Enable `QRALARM_RUN_CASH_BROWSER=1` there.
The existing Node and browser suites remain the gameplay regression checks.
Local testing does not publish these companion files to GitHub Pages.
