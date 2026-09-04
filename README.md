# Cash Handling Terminal Quiz

A Windows 11 PowerShell practice quiz for teller-style cash handling. It generates random customer transactions and asks whether the customer paid the exact amount, needs change, or is short.

## Main features

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

- `Cash-Handling-Terminal-Quiz-v2.ps1` — runnable PowerShell quiz
- `Cash-Handling-Terminal-Quiz-v2-copy-paste.txt` — identical copy for opening and copying into PowerShell or another file
- `README-Cash-Handling-Terminal-Quiz-v2.md` — this guide

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
