// Holds & Verification: multiple-choice questions built from the BHB Funds Availability Quick Reference
// Guide (Reg CC hold types, check types, release days, Xperience reasons) and the teller verification steps.
// Pure module: no DOM. Amounts stay in cents.

export const HOLDS_GAME = 'holds-verification';
export const HOLDS_GAME_NAME = 'Holds & Verification';

export const HOLD_LABELS = Object.freeze({
  large: 'Large Deposit', new: 'New Account', reasonable: 'Reasonable Cause', redeposited: 'Redeposited Item',
  overdraft: 'Repeated Overdraft / Currently Overdrafted', emergency: 'Emergency Situations',
});
export const NO_HOLD = 'No exception hold applies';
// The reason selected in Xperience for each hold type. Emergency Situations has no listed reason.
export const XPERIENCE_REASONS = Object.freeze({
  large: 'The checks you deposited on this day exceed $6,800.',
  new: 'This is a new account/new customer deposit per Reg CC.',
  reasonable: 'We have confidential information the check may not be paid.',
  redeposited: 'The check you deposited was previously returned unpaid.',
  overdraft: 'Your account has been overdrawn repeatedly in the last 6 months.',
});

export const ITEMS = Object.freeze({
  'on-us': { label: 'On-Us check', group: 'on-us' },
  cashier: { label: 'Cashier’s check', group: 'next-day' },
  official: { label: 'Official check', group: 'next-day' },
  officer: { label: 'Officer’s check', group: 'next-day' },
  fhlb: { label: 'Federal Home Loan Bank check', group: 'next-day' },
  reserve: { label: 'Federal Reserve Bank check', group: 'next-day' },
  treasury: { label: 'U.S. Treasury check', group: 'next-day' },
  postal: { label: 'U.S. Postal Service money order', group: 'next-day' },
  state: { label: 'State government check', group: 'next-day' },
  local: { label: 'County (local government) check', group: 'next-day' },
  personal: { label: 'Personal check drawn on another bank', group: 'non-next-day' },
  business: { label: 'Business check drawn on another bank', group: 'non-next-day' },
  payroll: { label: 'Payroll check from a private company', group: 'non-next-day' },
  'retail-mo': { label: 'Money order bought at a retail store (not USPS)', group: 'non-next-day' },
  'credit-union': { label: 'Personal check drawn on a federal credit union', group: 'non-next-day' },
  'state-bank': { label: 'Check drawn on a state-chartered bank', group: 'non-next-day' },
  foreign: { label: 'Check drawn on a foreign bank', group: 'foreign' },
  cash: { label: 'Cash', group: 'electronic' },
  ach: { label: 'ACH credit', group: 'electronic' },
  wire: { label: 'Incoming wire', group: 'electronic' },
});
const NEXT_DAY_CHECKS = ['on-us', 'cashier', 'official', 'officer', 'fhlb', 'reserve', 'treasury', 'postal', 'state', 'local'];
const NON_NEXT_DAY = ['personal', 'business', 'payroll', 'retail-mo', 'credit-union', 'state-bank'];
const TRICKY_NON_NEXT_DAY = ['retail-mo', 'credit-union', 'state-bank'];
const HOLDABLE = ['on-us', 'cashier', 'treasury', 'postal', 'state', 'fhlb', 'personal', 'business', 'payroll'];

export const CATEGORIES = Object.freeze({
  'item-type': { label: 'Check types', topic: 'holds' },
  'no-hold-items': { label: 'Never-hold items', topic: 'holds' },
  'hold-trigger': { label: 'Which hold applies', topic: 'holds' },
  'xperience-reason': { label: 'Xperience reasons', topic: 'holds' },
  availability: { label: 'Funds availability', topic: 'holds' },
  'hold-days': { label: 'Hold days entered', topic: 'holds' },
  'same-day': { label: '$300 same-day rule', topic: 'holds' },
  definitions: { label: 'Hold definitions', topic: 'holds' },
  'existing-customer': { label: 'Existing customer cashing', topic: 'verification' },
  'non-customer': { label: 'Non-customer on-us cashing', topic: 'verification' },
  'id-rules': { label: 'ID requirements', topic: 'verification' },
  'review-check': { label: 'Review Check list', topic: 'verification' },
  withdrawal: { label: 'Customer withdrawal', topic: 'verification' },
  'other-verifications': { label: 'Other verifications', topic: 'verification' },
  statements: { label: 'True or false rules', topic: 'mixed' },
});
export const TOPICS = Object.freeze({ all: 'Holds and verification', holds: 'Hold amounts and hold types', verification: 'Verification steps' });

export const HOLDS_PRESETS = Object.freeze({
  Easy: Object.freeze({ questionCount: 10, timeLimitSeconds: 60, optionCount: 3 }),
  Medium: Object.freeze({ questionCount: 12, timeLimitSeconds: 45, optionCount: 4 }),
  Hard: Object.freeze({ questionCount: 15, timeLimitSeconds: 35, optionCount: 5 }),
});
const LEVEL = Object.freeze({ Easy: 1, Medium: 2, Hard: 3 });

/** Clean saved or typed settings into a playable round. */
export function resolveHoldsSettings(input = {}) {
  const difficulty = Object.hasOwn(HOLDS_PRESETS, input.difficulty) ? input.difficulty : 'Easy';
  const preset = HOLDS_PRESETS[difficulty];
  const whole = (value, min, max, fallback) => Number.isFinite(Number(value)) && value !== '' && value !== null
    ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
  return {
    difficulty,
    questionCount: whole(input.questionCount, 1, 100, preset.questionCount),
    timeLimitSeconds: whole(input.timeLimitSeconds, 10, 300, preset.timeLimitSeconds),
    topic: Object.hasOwn(TOPICS, input.topic) ? input.topic : 'all',
    optionCount: preset.optionCount,
  };
}

export function money(cents) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
const ordinal = (day) => `${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}`;
export const dayText = (day) => day === 0 ? 'same day' : day === 1 ? 'next business day' : `${ordinal(day)} business day`;

/** Availability tiers per Table 2. `kind` is an ITEMS key; electronic and foreign items have no Reg CC schedule. */
export function holdSchedule(hold, kind, cents) {
  const group = ITEMS[kind]?.group;
  if (!['on-us', 'next-day', 'non-next-day'].includes(group) || !Object.hasOwn(HOLD_LABELS, hold)) return [];
  const tiers = [];
  const add = (amount, day) => { if (amount > 0) tiers.push({ cents: amount, day }); };
  const tiered = (middleDay, lastDay) => {
    const same = Math.min(cents, 30000);
    const middle = Math.min(cents - same, 650000);
    add(same, 0); add(middle, middleDay); add(cents - same - middle, lastDay);
  };
  if (hold === 'large') tiered(group === 'non-next-day' ? 2 : 1, group === 'on-us' ? 2 : 7);
  // On-Us checks are not counted as Next-Day items for a new account.
  else if (hold === 'new') { if (group === 'next-day') tiered(1, 9); else add(cents, 9); }
  else if (hold === 'overdraft') add(cents, group === 'non-next-day' ? 2 : 1);
  else add(cents, group === 'on-us' ? 2 : 7);
  return tiers;
}
export const holdDays = (tiers) => tiers.length ? Math.max(...tiers.map((tier) => tier.day)) : 0;
export const scheduleText = (tiers) => tiers.map((tier) => `${money(tier.cents)} ${tier.day > 1 ? 'on the ' : ''}${dayText(tier.day)}`).join(' · ');

function randomTools(random) {
  const index = (length) => Math.min(length - 1, Math.floor(random() * length));
  const pick = (values) => values[index(values.length)];
  const shuffle = (values) => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) { const j = index(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  return { pick, shuffle, chance: (p) => random() < p };
}

// ---- Verification source lists ----
export const EXISTING_STEPS = Object.freeze([
  'Find the customer and confirm they can cash this check',
  'Check primary ID and compare it with the ID on file',
  'Confirm all check scans are present, readable and in order',
  'Confirm the customer is the named payee or an authorized holder',
  'Compare the back endorsement with the ID signature and signature records',
  'Review the front (payer) signature and the account history',
  'Run the Review Check list and resolve any alerts or approvals',
]);
export const NON_CUSTOMER_STEPS = Object.freeze([
  'Require 2 valid IDs',
  'Record both IDs and confirm the person is the intended payee',
  'Pull up the payer’s B&H account',
  'Review the check scans',
  'Confirm the front signature matches an authorized signer',
  'Match the back endorsement to their ID',
  'Ask about earlier check cashing here and review the check-cashing history',
  'Large or suspicious check only: call the payer at a verified number',
  'If verified, document “Customer verified” with the date and time',
  'Clear alerts and approvals',
]);
const PRIMARY_IDS = ['Driver’s license', 'State photo ID', 'Passport'];
const SECONDARY_IDS = ['Student ID', 'Work badge', 'Social Security card'];
const REVIEW_CHECK = [
  'Date: flag postdated and stale checks', 'Payee and payer: who receives the funds and who wrote the check',
  'Signatures: payer on the front, endorsement on the back', 'Amounts: written and numeric amounts match',
  'Alterations: changed numbers, erasures or overwriting', 'Check details: routing, account and check number, possible duplicates',
  'Condition: damage, VOID, stop-payment or other restrictions', 'Scans and TrueChecks: readable, correctly matched, fraud alerts reviewed',
];
const NOT_REVIEW_CHECK = [
  'Confirm the payee’s home address matches the check', 'Ask the payer’s bank for the payer’s balance by phone',
  'Compare the check’s paper weight with a sample', 'Check the payee’s credit report',
];

// True and false rule statements for the mixed "which statement" questions.
const STATEMENTS = Object.freeze([
  ['holds', true, 'Cash, ACH and wires can never receive a Reg CC hold.'],
  ['holds', true, 'A Large Deposit hold looks at the total of all checks deposited on one banking day, not each check alone.'],
  ['holds', true, 'For a New Account hold, On-Us checks are not counted as Next-Day items.'],
  ['holds', true, 'Under a Repeated Overdraft hold, Next-Day items are available the next business day.'],
  ['holds', true, 'A check returned only for a missing endorsement, now endorsed, is not a Redeposited Item.'],
  ['holds', true, 'Reasonable Cause comes from TrueChecks hits.'],
  ['holds', true, 'Under Reasonable Cause, a Non-Next-Day item is available on the 7th business day.'],
  ['holds', true, 'Foreign check items are not treated as Non-Next-Day items.'],
  ['holds', true, 'The depositor gets a Hold Notice whenever a hold is placed.'],
  ['holds', true, 'An account is a new account during its first 30 days.'],
  ['holds', true, 'Under a Large Deposit hold, the excess over $6,800 on an On-Us check is available on the 2nd business day.'],
  ['holds', false, 'A Repeated Overdraft hold may be placed on a cash deposit.'],
  ['holds', false, 'Under a New Account hold, a personal check gets $300 same-day availability.'],
  ['holds', false, 'A Large Deposit hold applies only when one single check is over $6,800.'],
  ['holds', false, 'A check returned because it was postdated, and no longer postdated, is a Redeposited Item.'],
  ['holds', false, 'Under Reasonable Cause, an On-Us check is held until the 7th business day.'],
  ['holds', false, 'Emergency Situations holds release every item on the next business day.'],
  ['holds', false, 'Under a Large Deposit hold, the whole first $6,800 is available the same day.'],
  ['holds', false, 'An On-Us check counts as a Next-Day item for a New Account hold.'],
  ['holds', false, 'A U.S. Postal Service money order is a Non-Next-Day item.'],
  ['holds', false, 'The repeated overdraft lookback is 12 months.'],
  ['holds', false, 'Under a New Account hold, the rest of a Next-Day deposit is available on the 7th business day.'],
  ['verification', true, 'A non-customer needs 2 valid IDs every time, even on repeat visits.'],
  ['verification', true, 'Two primary IDs are acceptable for a non-customer.'],
  ['verification', true, 'Call the payer only for a large or suspicious non-customer check, at a verified number.'],
  ['verification', true, 'Stale checks are generally checks dated more than 6 months ago.'],
  ['verification', true, 'The written and numeric amounts on a check must match.'],
  ['verification', true, 'Every savings bond is validated on the Treasury SBVV site.'],
  ['verification', true, 'Drive-through bill exchange has a $1,000 maximum.'],
  ['verification', true, 'Safe deposit access is logged with the date, time, customer signature and your initials.'],
  ['verification', true, 'If an existing customer’s ID differs from the ID on file, collect a 2nd valid ID.'],
  ['verification', false, 'A student ID and a work badge together are enough for a non-customer.'],
  ['verification', false, 'Call the payer at the phone number printed on the check.'],
  ['verification', false, 'A non-customer who cashed a check here last month needs only one ID.'],
  ['verification', false, 'Non-customers may exchange up to $1,000 in bills.'],
  ['verification', false, 'Savings bonds can be cashed by any customer whose B&H account is at least 6 months old.'],
  ['verification', false, 'A savings bond account-age exception needs verbal approval from the head teller.'],
  ['verification', false, 'The procedure sets $5,000 as the amount that makes a non-customer check “large”.'],
  ['verification', false, 'If a Review Check problem is found, correct the check and continue.'],
  ['verification', false, 'Document a verified non-customer check as “Payer approved” with your initials only.'],
]);

// ---- Templates ----
// Each template returns { key, prompt, facts?, correct, distractors, explanation, source }.
// `min` is the lowest difficulty that uses it. Distractors are plausible, so careful reading matters.
const T = [];
const add = (id, category, min, build) => T.push({ id, category, topic: CATEGORIES[category].topic, min, build });
const withArticle = (label) => {
  const text = /^(Money|Personal|Business|Payroll|Check|Cash|Incoming)/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
  return `${/^[AEIO]/i.test(text) ? 'an' : 'a'} ${text}`;
};
const groupName = { 'on-us': 'Next-Day item', 'next-day': 'Next-Day item', 'non-next-day': 'Non-Next-Day item', foreign: 'Neither: foreign check item (outside the Next-Day / Non-Next-Day schedule)' };

add('classify-item', 'item-type', 1, ({ pick, shuffle }, level) => {
  const kind = pick(level >= 3 ? [...TRICKY_NON_NEXT_DAY, 'officer', 'fhlb', 'reserve', 'local', 'foreign', 'on-us'] : [...NEXT_DAY_CHECKS, ...NON_NEXT_DAY, 'foreign']);
  const correct = groupName[ITEMS[kind].group];
  return { key: `classify:${kind}`, prompt: `A customer deposits ${withArticle(ITEMS[kind].label)}. How is it classified for funds availability?`,
    correct, distractors: shuffle([...new Set(Object.values(groupName))].filter((name) => name !== correct).concat(['Next-Day item, and it can never be held', 'Non-Next-Day item, and it can never be held'])),
    explanation: kind === 'foreign' ? 'All checks other than Next-Day items are Non-Next-Day items, except foreign check items.'
      : ITEMS[kind].group === 'non-next-day' ? `${ITEMS[kind].label} is not on the Next-Day list (cash, cashier’s/official checks, FHLB, Federal Reserve, On-Us, U.S. Treasury, USPS money orders, state or local government checks, ACH/wire), so it is Non-Next-Day.`
        : `${ITEMS[kind].label} is on the Next-Day list. Exception holds can still be placed on some Next-Day checks.`,
    source: 'Table 1 · Next-Day and Non-Next-Day items' };
});
add('odd-item-out', 'item-type', 2, ({ pick, shuffle, chance }, level) => {
  const wantNonNext = chance(0.5);
  const pool = level >= 3 ? TRICKY_NON_NEXT_DAY : NON_NEXT_DAY;
  const answerKind = wantNonNext ? pick(pool) : pick(NEXT_DAY_CHECKS);
  const others = wantNonNext ? shuffle(NEXT_DAY_CHECKS.filter((kind) => !['official', 'officer'].includes(kind) || level >= 3)) : shuffle([...pool, ...(level >= 3 ? ['foreign'] : [])]);
  return { key: `odd:${wantNonNext ? 'non' : 'next'}:${answerKind}`, prompt: `Which ONE of these is a ${wantNonNext ? 'Non-Next-Day' : 'Next-Day'} item?`,
    correct: ITEMS[answerKind].label, distractors: others.map((kind) => ITEMS[kind].label),
    explanation: wantNonNext ? `${ITEMS[answerKind].label} is not on the Next-Day list, so it is Non-Next-Day. Every other choice is a Next-Day item.`
      : `${ITEMS[answerKind].label} is on the Next-Day list. The other choices are Non-Next-Day${level >= 3 ? ' or foreign' : ''} items.`,
    source: 'Table 1 · Next-Day items' };
});
add('never-hold', 'no-hold-items', 1, ({ pick, shuffle }) => {
  const kind = pick(['cash', 'ach', 'wire']);
  return { key: `never:${kind}`, prompt: 'Which item can NEVER have a Reg CC hold placed on it?', correct: { cash: 'A cash deposit', ach: 'An ACH credit', wire: 'An incoming wire' }[kind],
    distractors: shuffle(['An On-Us check', 'A U.S. Treasury check', 'A cashier’s check', 'A U.S. Postal Service money order', 'A state government check']),
    explanation: 'Exception holds can sometimes be placed on Next-Day checks, but never any Reg CC hold on cash, ACH or wires.', source: 'Table 1 · Next-Day items' };
});
add('electronic-hold-request', 'no-hold-items', 2, ({ pick }) => {
  const kind = pick(['an incoming wire of $9,500', 'an ACH payroll credit of $7,200', 'a cash deposit of $8,000']);
  const reason = pick([['the account has been overdrawn repeatedly', 'Repeated Overdraft, available the next business day'], ['the deposit is over $6,800', 'Large Deposit: $300 same day, the rest the next business day'], ['the account is 10 days old', 'New Account: $300 same day, the rest on the 9th business day']]);
  return { key: `electronic:${reason[1].split(':')[0]}`, prompt: `A coworker wants to hold ${kind} because ${reason[0]}. What is correct?`,
    correct: 'No Reg CC hold can be placed; cash, ACH and wires are never held', distractors: [reason[1], 'Reasonable Cause, available on the 7th business day', 'Emergency Situations, available on the 7th business day', 'Hold it, but skip the Hold Notice'],
    explanation: 'You can never place any Reg CC hold on cash, ACH or wires. Repeated Overdraft holds apply to all items except cash and electronic items.', source: 'Table 1 and Table 3' };
});

const triggerScenarios = [
  [1, 'reasonable', ['TrueChecks returns a hit: confidential information says the check may not be paid.'], 'TrueChecks hits give reasonable cause to believe the check is uncollectible.'],
  [1, 'redeposited', ['The check was deposited last week and returned unpaid (NSF). The customer redeposits it today.'], 'A check that was returned and is redeposited can get a Redeposited Item hold.'],
  [1, 'new', ['The checking account was opened 12 days ago. The customer has no other accounts at the bank.'], 'The account is less than 30 days old.'],
  [1, 'large', ['The customer deposits one personal check for $9,400. No other deposits today.'], 'The checks deposited today exceed $6,800.'],
  [1, 'overdraft', ['The account has been overdrawn several times in the last 6 months.'], 'Repeated overdrafts within six months allow this hold.'],
  [1, 'emergency', ['The branch has a computer and communications failure that stops normal processing.'], 'Failure of computer or communications equipment is an emergency.'],
  [2, 'large', ['At 10:15 the customer deposits a check for $4,100.', 'At 2:40 the same day the customer deposits a second check for $3,200.'], 'Large Deposit uses the aggregate for one banking day: $7,300 is over $6,800.'],
  [2, 'none', ['The customer deposits checks totaling exactly $6,800 today.', 'The account is 4 years old with no overdrafts and no TrueChecks hits.'], 'The total must exceed $6,800. Exactly $6,800 does not qualify.'],
  [2, 'new', ['The account was opened 29 days ago.', 'Deposit: one $2,000 personal check.'], 'Day 29 is still inside the first 30 days.'],
  [2, 'none', ['The check came back for a missing endorsement. The customer has now endorsed it and deposits it again.', 'The account is 6 years old with no other issues.'], 'A check returned for a missing endorsement, now endorsed, is not a Redeposited Item.'],
  [2, 'none', ['The check was returned because it was postdated. The date on the check has now arrived.', 'The account is 3 years old with no overdrafts.'], 'A check returned for being postdated, and no longer postdated, is not a Redeposited Item.'],
  [2, 'overdraft', ['The account is overdrawn right now.', 'The customer deposits a $900 personal check to cover it.'], 'The hold covers accounts currently overdrafted as well as repeatedly overdrawn ones.'],
  [2, 'emergency', ['The paying bank has suspended payments.'], 'Suspension of payments by another bank is an emergency situation.'],
  [3, 'none', ['The account was opened 10 days ago.', 'Both joint owners have each had a checking account at the bank for the last 4 years, and both are still open.', 'Deposit: a $1,500 personal check; no other issues.'], 'It is not a new account: every customer had another transactional account at the bank for at least 30 days within 30 days before opening.'],
  [3, 'new', ['The joint account was opened 8 days ago.', 'One owner has had checking at the bank for 5 years; the other owner is new to the bank.'], 'Every customer on the account must have the qualifying prior account. One new owner keeps it a new account.'],
  [3, 'new', ['The account was opened 20 days ago.', 'The customer had a savings-only account at the bank for 2 years.'], 'Only a prior transactional account removes new-account status.'],
  [3, 'none', ['The account was opened 31 days ago.', 'Deposit: one $5,000 business check; no overdrafts or TrueChecks hits.'], 'After the first 30 days it is no longer a new account, and $5,000 does not exceed $6,800.'],
  [3, 'large', ['Morning: an On-Us check for $3,000.', 'Afternoon: a U.S. Treasury check for $3,900.', 'The account is 7 years old with no other issues.'], 'All checks deposited on one banking day count toward the $6,800 aggregate: $6,900 exceeds it.'],
  [3, 'none', ['The customer deposits $9,000 in cash and a $500 personal check.', 'The account is 5 years old with no overdrafts.'], 'Cash is never held and is not a check; the checks deposited total only $500.'],
  [3, 'redeposited', ['The check was returned unpaid last week for insufficient funds.', 'The account is 3 years old; checks deposited today total $1,200.'], 'A check previously returned unpaid and redeposited allows a Redeposited Item hold.'],
];
add('which-hold', 'hold-trigger', 1, ({ pick, shuffle, chance }, level) => {
  const pool = triggerScenarios.filter(([min]) => min <= level);
  const preferred = pool.filter(([min]) => min === level);
  const [, answer, facts, why] = pick(preferred.length && chance(0.6) ? preferred : pool);
  const labels = { ...HOLD_LABELS, none: NO_HOLD };
  return { key: `trigger:${answer}:${facts[0].slice(0, 24)}`, prompt: 'Which exception hold applies to this deposit?', facts,
    correct: labels[answer], distractors: shuffle(Object.entries(labels).filter(([key]) => key !== answer).map(([, label]) => label)),
    explanation: why, source: 'Table 2 and Table 3 · hold types' };
});
add('reason-for-hold', 'xperience-reason', 1, ({ pick, shuffle }) => {
  const hold = pick(Object.keys(XPERIENCE_REASONS));
  return { key: `reason:${hold}`, prompt: `Which reason do you select in Xperience for a ${HOLD_LABELS[hold]} hold?`, correct: XPERIENCE_REASONS[hold],
    distractors: shuffle(Object.entries(XPERIENCE_REASONS).filter(([key]) => key !== hold).map(([, text]) => text)),
    explanation: `Table 2 pairs ${HOLD_LABELS[hold]} with “${XPERIENCE_REASONS[hold]}”`, source: 'Table 2 · Reason column' };
});
add('hold-for-reason', 'xperience-reason', 2, ({ pick, shuffle }) => {
  const hold = pick(Object.keys(XPERIENCE_REASONS));
  return { key: `reason-back:${hold}`, prompt: `The Xperience reason reads: “${XPERIENCE_REASONS[hold]}” Which hold type is this?`, correct: HOLD_LABELS[hold],
    distractors: shuffle(Object.entries(HOLD_LABELS).filter(([key]) => key !== hold).map(([, label]) => label)),
    explanation: `This reason belongs to the ${HOLD_LABELS[hold]} hold. Emergency Situations has no listed reason.`, source: 'Table 2 · Reason column' };
});

function amountFor(hold, { pick }) {
  return hold === 'large' ? pick([720000, 925000, 1150000, 1240000, 835000, 2000000]) : pick([120000, 250000, 480000, 760000, 1050000]);
}
function scheduleDistractors(hold, kind, cents, correctText, { shuffle }) {
  const options = new Set();
  for (const otherHold of Object.keys(HOLD_LABELS)) for (const otherKind of ['on-us', 'treasury', 'personal']) options.add(scheduleText(holdSchedule(otherHold, otherKind, cents)));
  const tiers = holdSchedule(hold, kind, cents);
  // Small slips: forget the $300, grant $300 where none is allowed, or split the first tier at $6,800 instead of $6,500.
  if (tiers.length > 1) options.add(scheduleText([{ cents, day: holdDays(tiers) }]));
  else if (cents > 30000) options.add(scheduleText([{ cents: 30000, day: 0 }, { cents: cents - 30000, day: tiers[0].day }]));
  if (tiers.length === 3) options.add(scheduleText([{ cents: 30000, day: 0 }, { cents: 680000, day: tiers[1].day }, { cents: cents - 710000, day: tiers[2].day }].filter((tier) => tier.cents > 0)));
  for (const swap of [[1, 2], [2, 7], [7, 9], [2, 9]]) {
    options.add(scheduleText(tiers.map((tier) => ({ ...tier, day: tier.day === swap[0] ? swap[1] : tier.day === swap[1] ? swap[0] : tier.day }))));
  }
  options.delete(correctText); options.delete('');
  return shuffle([...options]);
}
add('availability', 'availability', 2, (tools, level) => {
  const hold = tools.pick(Object.keys(HOLD_LABELS));
  const kind = tools.pick(level >= 3 ? HOLDABLE : ['on-us', 'treasury', 'cashier', 'personal', 'business']);
  const cents = amountFor(hold, tools);
  const tiers = holdSchedule(hold, kind, cents);
  const text = scheduleText(tiers);
  const facts = [`Item: ${ITEMS[kind].label}`, `Amount: ${money(cents)} (the only check deposited today)`, `Hold placed: ${HOLD_LABELS[hold]}`];
  return { key: `availability:${hold}:${ITEMS[kind].group}`, prompt: 'When are these funds available?', facts, correct: text,
    distractors: scheduleDistractors(hold, kind, cents, text, tools),
    explanation: `${ITEMS[kind].label} is ${ITEMS[kind].group === 'on-us' ? 'an On-Us (Next-Day) item' : groupName[ITEMS[kind].group]}. ${HOLD_LABELS[hold]}: ${text}.${hold === 'new' && kind === 'on-us' ? ' On-Us checks are not counted as Next-Day items for a new account.' : ''}`,
    source: 'Table 2 · Hold Types and When to Make the Funds Available' };
});
add('hold-days', 'hold-days', 1, (tools, level) => {
  const hold = tools.pick(Object.keys(HOLD_LABELS));
  const kind = tools.pick(level >= 2 ? HOLDABLE : ['on-us', 'treasury', 'personal']);
  const cents = hold === 'large' ? amountFor(hold, tools) : tools.pick([150000, 320000, 900000]);
  const tiers = holdSchedule(hold, kind, cents);
  const days = holdDays(tiers);
  return { key: `days:${hold}:${ITEMS[kind].group}`, prompt: `How many hold days do you enter in the system for this hold?`,
    facts: [`Item: ${ITEMS[kind].label}`, `Amount: ${money(cents)}`, `Hold: ${HOLD_LABELS[hold]}`],
    correct: `${days}`, distractors: [...tools.shuffle(['1', '2', '7', '9'].filter((value) => value !== `${days}`)), '5', '30'].filter((value) => value !== `${days}`),
    explanation: `The bold number in Table 2 is the last release day: ${scheduleText(tiers)}. Enter ${days}.`, source: 'Table 2 · bold hold-day numbers' };
});
add('same-day-300', 'same-day', 1, ({ pick, shuffle }) => {
  const nonNext = pick([true, false]);
  const item = nonNext ? pick(['personal check', 'business check']) : pick(['U.S. Treasury check', 'cashier’s check', 'state government check']);
  const correct = nonNext ? 'Large Deposit' : 'New Account';
  const wrong = ['Reasonable Cause', 'Redeposited Item', 'Repeated Overdraft / Currently Overdrafted', 'Emergency Situations', ...(nonNext ? ['New Account'] : [])];
  return { key: `same-day:${nonNext ? 'non' : 'next'}`, prompt: `Under which hold does a ${item} still get $300 same-day availability?`, correct, distractors: shuffle(wrong),
    explanation: nonNext ? 'For Non-Next-Day items only Large Deposit gives $300 same day. New Account, Reasonable Cause, Redeposited, Repeated Overdraft and Emergency say “Do not give $300 same day availability”.'
      : 'Only Large Deposit and New Account give $300 same day on Next-Day items. Reasonable Cause, Redeposited, Repeated Overdraft and Emergency hold the whole amount.',
    source: 'Table 2 · $300 same day availability' };
});
const DEFINITIONS = [
  [1, 'A Large Deposit hold may be used when the checks deposited on any one banking day total more than…', '$6,800', ['$6,500', '$5,525', '$10,000', '$5,000']],
  [1, 'An account counts as a new account while it is…', 'Less than 30 days old', ['Less than 60 days old', 'Less than 90 days old', 'Less than 14 days old', 'Less than 6 months old']],
  [1, 'Repeated Overdraft looks back over…', 'Six months', ['30 days', '12 months', '90 days', '2 years']],
  [1, 'What must you give the depositor whenever you place a hold?', 'A Hold Notice', ['A Topaz receipt only', 'A copy of the TrueChecks report', 'Nothing unless they ask', 'An Area Manager approval email']],
  [1, 'Reasonable Cause holds come from…', 'TrueChecks hits', ['The customer seeming in a hurry', 'Any check over $6,800', 'A missing endorsement', 'The account being new']],
  [2, 'Which label can a cashier’s check also carry?', 'Official check', ['Counter check', 'Starter check', 'Traveler’s cheque', 'Payroll check']],
  [2, 'Which is an Emergency Situation for holds?', 'The paying bank suspends payments', ['The customer is in a hurry', 'The branch is short-staffed', 'The account is overdrawn', 'The check is over $6,800']],
  [2, 'Under a Large Deposit hold, how is the first $6,800 made available?', '$300 same day, then $6,500 on the normal schedule', ['All $6,800 the same day', '$6,800 on the 7th business day', '$300 same day, then $6,500 on the 7th business day', '$6,500 same day, then $300 the next business day']],
  [3, 'A Repeated Overdraft hold applies to…', 'All items except cash and electronic items', ['Only Non-Next-Day checks', 'Every item including wires', 'Only On-Us checks', 'Only checks over $6,800']],
  [3, 'Which cashier’s check feature fits the definition?', 'Drawn on a bank and signed by a bank officer or employee for the bank', ['Drawn on the customer’s own account', 'Signed by the customer as drawer', 'Issued only for loan payments', 'Guaranteed only after the 7th business day']],
  [3, 'Where on the Quick Reference Guide do you find the maximum time you can hold?', 'Where the check type column meets the hold type row', ['In the Reason column only', 'In the Definitions table', 'At the top of the Next-Day list', 'It is always the 7th business day']],
];
add('definition', 'definitions', 1, ({ pick, shuffle }, level) => {
  const pool = DEFINITIONS.filter(([min]) => min <= level);
  const [, prompt, correct, wrong] = pick(pool);
  return { key: `definition:${prompt.slice(0, 30)}`, prompt, correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Table 1 and Table 3 · Definitions' };
});

// Verification
add('existing-next-step', 'existing-customer', 2, ({ pick, shuffle, chance }, level) => {
  const before = level >= 3 && chance(0.5);
  const index = before ? pick([1, 2, 3, 4, 5, 6]) : pick([0, 1, 2, 3, 4, 5]);
  const answer = EXISTING_STEPS[before ? index - 1 : index + 1];
  return { key: `existing-step:${before ? 'before' : 'after'}:${index}`, prompt: `Existing customer cashing a check: which step comes right ${before ? 'BEFORE' : 'AFTER'} “${EXISTING_STEPS[index]}”?`,
    correct: answer, distractors: shuffle(EXISTING_STEPS.filter((step, i) => i !== index && step !== answer)),
    explanation: `The order is: ${EXISTING_STEPS.map((step, i) => `${i + 1}. ${step}`).join(' ')}`, source: 'Existing customer cashing a check' };
});
const EXISTING_FACTS = [
  [1, 'An existing customer’s ID is different from the ID on file. What do you do?', 'Collect a 2nd valid ID', ['Update the file and continue with one ID', 'Refuse the transaction', 'Call the payer at a verified number', 'Ask for their account passcode instead']],
  [1, 'For an existing customer, what do you compare the back endorsement with?', 'The ID signature and the signature records', ['The front signature of the payer', 'The amount written on the check', 'The TrueChecks report', 'The deposit slip']],
  [2, 'Which is NOT a step for an existing customer cashing a check?', 'Call the payer at a verified number', ['Confirm the customer is the named payee or an authorized holder', 'Confirm all check scans are present, readable and in order', 'Review the front signature and the account history', 'Run the Review Check list']],
  [2, 'What is the LAST step for an existing customer cashing a check?', 'Run the Review Check list and resolve any alerts or approvals', ['Check primary ID', 'Compare the back endorsement with the ID signature', 'Find the customer and confirm they can cash this check', 'Document “Customer verified” with the date and time']],
  [3, 'An existing customer brings a check made out to their business partner. What must you confirm?', 'That the customer is the named payee or an authorized holder', ['That the check is under $6,800', 'That the payer answers a callback', 'That the customer has two primary IDs', 'That the check is a Next-Day item']],
];
add('existing-facts', 'existing-customer', 1, ({ pick, shuffle }, level) => {
  const [, prompt, correct, wrong] = pick(EXISTING_FACTS.filter(([min]) => min <= level));
  return { key: `existing:${prompt.slice(0, 30)}`, prompt, correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Existing customer cashing a check' };
});
add('non-customer-next-step', 'non-customer', 2, ({ pick, shuffle, chance }, level) => {
  const before = level >= 3 && chance(0.5);
  const index = before ? pick([1, 2, 3, 4, 5, 6, 7, 8, 9]) : pick([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const answer = NON_CUSTOMER_STEPS[before ? index - 1 : index + 1];
  return { key: `non-step:${before ? 'before' : 'after'}:${index}`, prompt: `Non-customer cashing an on-us check: which step comes right ${before ? 'BEFORE' : 'AFTER'} “${NON_CUSTOMER_STEPS[index]}”?`,
    correct: answer, distractors: shuffle(NON_CUSTOMER_STEPS.filter((step, i) => i !== index && step !== answer)),
    explanation: `The order is: ${NON_CUSTOMER_STEPS.map((step, i) => `${i + 1}. ${step}`).join(' ')}`, source: 'Non-customer cashing an on-us check' };
});
const NON_CUSTOMER_FACTS = [
  [1, 'How many valid IDs does a non-customer need to cash an on-us check?', '2, every time', ['1 primary ID', '2 only on the first visit', '3 for checks over $6,800', '1, plus a thumbprint']],
  [1, 'A verified non-customer check is documented as…', '“Customer verified” with the date and time', ['“Payer approved” with your initials', '“Verified” with the payer’s phone number', '“OK to cash” with the date only', 'Nothing; the approval covers it']],
  [2, 'When do you call the payer for a non-customer on-us check?', 'Only for a large or suspicious check', ['For every non-customer check', 'Only when the payee asks', 'Never; the IDs are enough', 'Only for checks under $100']],
  [2, 'Which phone number do you use to call the payer?', 'A verified number', ['The number printed on the check', 'The number the presenter gives you', 'The number on the presenter’s work badge', 'Any number found online']],
  [2, 'What do you ask a non-customer before reviewing check-cashing history?', '“Have you cashed a check here before? About when?”', ['“What is your account passcode?”', '“Who else can sign on your account?”', '“Do you want a cashier’s check instead?”', '“How long have you worked for the payer?”']],
  [2, 'The front signature on a non-customer’s on-us check must match…', 'An authorized signer on the payer’s B&H account', ['The presenter’s ID', 'The back endorsement', 'The presenter’s work badge', 'Any signature on file at another bank']],
  [3, 'What dollar amount makes a non-customer check “large” for the payer callback?', 'No amount is set; use the bank’s approval limits', ['$6,800', '$5,000', '$1,000', '$10,000']],
  [3, 'A non-customer cashed a check here last week and returns with only a passport. What do you do?', 'Require a 2nd valid ID; repeat visitors still need 2', ['Cash it; repeat visitors need one ID', 'Cash it if the payer answers a callback', 'Use last week’s recorded ID as the second ID', 'Place a Reasonable Cause hold']],
  [3, 'The payer callback confirms the check. What else is part of that phone step?', 'Confirm they issued the check to this person and get required approvals', ['Ask the payer for the payee’s Social Security number', 'Place a hold until the 2nd business day', 'Have the payer sign a Topaz pad', 'Nothing else; cash it']],
];
add('non-customer-facts', 'non-customer', 1, ({ pick, shuffle }, level) => {
  const [, prompt, correct, wrong] = pick(NON_CUSTOMER_FACTS.filter(([min]) => min <= level));
  return { key: `non:${prompt.slice(0, 30)}`, prompt, correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Non-customer cashing an on-us check' };
});
add('id-kind', 'id-rules', 1, ({ pick }) => {
  const primary = pick([true, false]);
  const id = pick(primary ? PRIMARY_IDS : SECONDARY_IDS);
  return { key: `id-kind:${id}`, prompt: `For a non-customer, ${withArticle(id === 'Social Security card' || id.endsWith('ID') ? id : id.toLowerCase())} counts as…`, correct: primary ? 'A primary ID' : 'A secondary ID',
    distractors: [primary ? 'A secondary ID' : 'A primary ID', 'Not an acceptable ID', 'Acceptable only with a passcode', 'Acceptable alone'],
    explanation: `Primary: ${PRIMARY_IDS.join(', ')}. Secondary: ${SECONDARY_IDS.join(', ')}.`, source: 'Non-customer cashing an on-us check · step 1' };
});
add('id-combo', 'id-rules', 2, ({ pick, shuffle, chance }, level) => {
  const pair = (a, b) => `${a} + ${b}`;
  const good = shuffle([pair(PRIMARY_IDS[0], SECONDARY_IDS[2]), pair(PRIMARY_IDS[2], SECONDARY_IDS[1]), pair(PRIMARY_IDS[1], SECONDARY_IDS[0]), pair(PRIMARY_IDS[0], PRIMARY_IDS[2]), pair(PRIMARY_IDS[1], PRIMARY_IDS[2])]);
  const bad = shuffle([pair(SECONDARY_IDS[0], SECONDARY_IDS[1]), pair(SECONDARY_IDS[1], SECONDARY_IDS[2]), pair(SECONDARY_IDS[0], SECONDARY_IDS[2]), `${pick(PRIMARY_IDS)} only`, `${pick(SECONDARY_IDS)} only`]);
  const askBad = level >= 3 && chance(0.5);
  return { key: `id-combo:${askBad ? 'bad' : 'good'}`, prompt: `Which ID set is ${askBad ? 'NOT ' : ''}acceptable for a non-customer cashing an on-us check?`,
    correct: askBad ? bad[0] : good[0], distractors: askBad ? good : bad,
    explanation: 'Accept 1 primary plus 1 secondary, or 2 primary. Two secondary IDs, or one ID alone, are not enough.', source: 'Non-customer cashing an on-us check · step 1' };
});
add('review-not', 'review-check', 1, ({ pick, shuffle, chance }) => {
  const askNot = chance(0.5);
  return askNot
    ? { key: 'review:not', prompt: 'Which is NOT part of the Review Check list?', correct: pick(NOT_REVIEW_CHECK), distractors: shuffle(REVIEW_CHECK), explanation: `The Review Check list covers: ${REVIEW_CHECK.join('; ')}.`, source: 'Review Check (every check)' }
    : { key: 'review:is', prompt: 'Which IS part of the Review Check list for every check?', correct: pick(REVIEW_CHECK), distractors: shuffle(NOT_REVIEW_CHECK), explanation: `The Review Check list covers: ${REVIEW_CHECK.join('; ')}.`, source: 'Review Check (every check)' };
});
const REVIEW_SCENARIOS = [
  [1, 'The check is dated 7 months ago.', 'Flag it as a stale check', ['Accept it; dates do not matter', 'Flag it as postdated', 'Place a Redeposited Item hold', 'Ask for a Topaz signature']],
  [1, 'The check is dated next Friday.', 'Flag it as a postdated check', ['Flag it as a stale check', 'Accept it today', 'Place a New Account hold', 'Change the date yourself']],
  [2, 'The numeric amount says $1,250.00 but the written amount says “One thousand two hundred five and 00/100”.', 'Stop: the written and numeric amounts must match; follow escalation rules', ['Pay the larger amount', 'Pay the numeric amount', 'Correct the written line yourself', 'Pay it and place a Reasonable Cause hold']],
  [2, 'You find an erasure and overwriting in the payee name.', 'Stop and follow bank escalation rules', ['Ask the presenter to initial it and continue', 'Fix the name yourself', 'Accept it if the IDs match', 'Place a Redeposited Item hold']],
  [3, 'The check number and amount match a check that was already cashed this week.', 'Treat it as a possible duplicate: stop and follow escalation rules', ['Cash it; duplicates are allowed', 'Cash it with a 2nd ID', 'Place a Large Deposit hold', 'Call the number printed on the check']],
  [3, 'TrueChecks shows a fraud alert, but the scans are readable and the signatures match.', 'Review the alert; with a problem found, stop and follow escalation rules', ['Ignore the alert because the signatures match', 'Clear the alert yourself and cash it', 'Cash it and document “Customer verified”', 'Give $300 and hold the rest']],
];
add('review-scenario', 'review-check', 1, ({ pick, shuffle }, level) => {
  const [, fact, correct, wrong] = pick(REVIEW_SCENARIOS.filter(([min]) => min <= level));
  return { key: `review:${fact.slice(0, 30)}`, prompt: 'During Review Check, what do you do?', facts: [fact], correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Review Check (every check)' };
});
const WITHDRAWAL_FACTS = [
  [1, 'Which is NOT checked on a customer withdrawal slip?', 'The customer’s employer', ['The date', 'The account number', 'The amount', 'The signature and authority']],
  [1, 'Before paying a withdrawal, which funds facts do you check?', 'Available balance, collected funds, holds, account status and alerts', ['Only the ledger balance', 'Only the last deposit', 'The customer’s credit score', 'Only holds over $6,800']],
  [2, 'When do you ask for the account passcode on a withdrawal?', 'When the account has one and the procedure requires it', ['On every withdrawal', 'Only for non-customers', 'Never; ID replaces it', 'Only at the drive-through']],
  [2, 'When do you get a Topaz signature on a withdrawal?', 'When it is required', ['Never', 'Only when ID is missing', 'Only for non-customers', 'Only for withdrawals over $10,000']],
  [3, 'A withdrawal slip is signed by someone who is not on the account. What part of the slip check fails?', 'Signature and authority', ['Date', 'Account number', 'Amount', 'Name']],
];
add('withdrawal', 'withdrawal', 1, ({ pick, shuffle }, level) => {
  const [, prompt, correct, wrong] = pick(WITHDRAWAL_FACTS.filter(([min]) => min <= level));
  return { key: `withdrawal:${prompt.slice(0, 30)}`, prompt, correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Withdrawal (customer)' };
});
const OTHER_FACTS = [
  [1, 'What is the bill exchange limit for a non-customer?', '$100 maximum', ['$1,000 maximum', '$300 maximum', '$500 maximum', 'No limit']],
  [1, 'What is the bill exchange limit at the drive-through?', '$1,000 maximum', ['$100 maximum', '$6,800 maximum', '$500 maximum', 'No limit']],
  [1, 'Where do you validate savings bonds?', 'The Treasury SBVV site, for every bond', ['TrueChecks', 'Xperience holds screen', 'Only the first bond on SBVV', 'By calling the Treasury']],
  [2, 'How long must a customer have had a B&H account to cash savings bonds?', '12 months or more', ['30 days or more', '6 months or more', '24 months or more', 'Any length of time']],
  [2, 'Which is NOT recorded in the safe deposit access log?', 'The contents of the box', ['The date and time', 'The customer’s signature', 'Your initials', 'The box number']],
  [2, 'A business remitter buys a cashier’s check. What do you confirm?', 'The person is an authorized signer for the business, and check their ID', ['The business is a Next-Day payer', 'The person has two secondary IDs', 'Nothing beyond the funds', 'The payee’s Social Security number']],
  [3, 'A customer whose B&H account is 8 months old wants to cash savings bonds. What is needed?', 'An exception with Area Manager email approval', ['Nothing; 6 months is enough', 'Verbal approval from the head teller', 'Two primary IDs instead', 'A Large Deposit hold']],
  [3, 'Savings bonds name “Robert J. Allen”. The presenter’s ID reads “Rob Allen”. What is correct?', 'Do not cash: the owner’s name must exactly match the presenter', ['Cash it; the name is close enough', 'Cash it with a 2nd ID', 'Cash it after SBVV validation', 'Place a Redeposited Item hold']],
  [3, 'A non-customer at the drive-through wants to exchange $400 in small bills. What is the limit?', '$100, the non-customer maximum', ['$1,000, the drive-through maximum', '$400; it is under both limits', '$300 same day', 'No limit at the drive-through']],
];
add('other', 'other-verifications', 1, ({ pick, shuffle }, level) => {
  const [, prompt, correct, wrong] = pick(OTHER_FACTS.filter(([min]) => min <= level));
  return { key: `other:${prompt.slice(0, 30)}`, prompt, correct, distractors: shuffle(wrong), explanation: `Correct: ${correct}.`, source: 'Other verifications' };
});
add('statement', 'statements', 2, ({ shuffle, chance }, level, topic) => {
  const pool = STATEMENTS.filter(([kind]) => topic === 'all' || kind === topic);
  const askFalse = level >= 3 || chance(0.5);
  const answers = shuffle(pool.filter(([, truth]) => truth !== askFalse));
  const others = shuffle(pool.filter(([, truth]) => truth === askFalse));
  const correct = answers[0][2];
  return { key: `statement:${askFalse ? 'false' : 'true'}`, prompt: `Which statement is ${askFalse ? 'FALSE' : 'TRUE'}?`, correct, distractors: others.map((row) => row[2]),
    explanation: `“${correct}” is ${askFalse ? 'false' : 'true'}. ${askFalse ? 'Every other statement follows the guide.' : 'Every other statement breaks the guide.'}`, source: 'Quick Reference Guide and verification steps' };
});
export const TEMPLATES = Object.freeze(T.map(({ id, category, topic, min }) => ({ id, category, topic, min })));

/** Build one question. `random` returns [0, 1). */
export function createHoldsQuestion({ difficulty = 'Easy', topic = 'all', random = Math.random, templateId = null } = {}) {
  const level = LEVEL[difficulty] ?? 1;
  const tools = randomTools(random);
  const eligible = T.filter((template) => template.min <= level && (topic === 'all' || template.topic === topic || template.topic === 'mixed'));
  const weighted = eligible.flatMap((template) => template.min === level ? [template, template] : [template]);
  const template = templateId ? T.find((item) => item.id === templateId) : tools.pick(weighted);
  const built = template.build(tools, level, topic);
  const optionCount = HOLDS_PRESETS[difficulty]?.optionCount ?? 3;
  const distractors = [...new Set(built.distractors)].filter((text) => text !== built.correct).slice(0, optionCount - 1);
  const texts = tools.shuffle([built.correct, ...distractors]);
  const options = texts.map((text, index) => ({ id: String.fromCharCode(97 + index), text }));
  return {
    id: `${template.id}:${built.key}`, template: template.id, key: built.key, category: template.category,
    categoryLabel: CATEGORIES[template.category].label, topic: template.topic, difficulty,
    prompt: built.prompt, facts: built.facts ?? [], options,
    correctOptionId: options.find((option) => option.text === built.correct).id,
    explanation: built.explanation, source: built.source,
  };
}

/** A round of questions with no repeated prompt-and-answer pair when the bank allows it. */
export function createHoldsRound(settings, random = Math.random) {
  const resolved = resolveHoldsSettings(settings);
  const questions = []; const seen = new Set();
  for (let tries = 0; questions.length < resolved.questionCount && tries < resolved.questionCount * 30; tries += 1) {
    const question = createHoldsQuestion({ difficulty: resolved.difficulty, topic: resolved.topic, random });
    const signature = `${question.prompt}|${question.facts.join('|')}|${question.options.find((option) => option.id === question.correctOptionId).text}`;
    if (seen.has(signature) && tries < resolved.questionCount * 20) continue;
    seen.add(signature); questions.push(question);
  }
  return questions;
}

export function scoreHoldsAnswer(question, optionId, timedOut = false) {
  const correct = !timedOut && optionId === question.correctOptionId;
  return { correct, outcome: timedOut ? 'Timed Out' : correct ? 'Correct' : 'Incorrect',
    selectedText: question.options.find((option) => option.id === optionId)?.text ?? '',
    correctText: question.options.find((option) => option.id === question.correctOptionId).text };
}

/** Accuracy by category over answered history records of this game. */
export function summarizeHoldsHistory(history = []) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => row?.game === HOLDS_GAME && ['Correct', 'Incorrect', 'Timed Out'].includes(row.outcome));
  const byCategory = new Map();
  for (const row of rows) {
    const key = row.holdsCategory ?? 'unknown';
    if (!byCategory.has(key)) byCategory.set(key, { category: key, label: CATEGORIES[key]?.label ?? key, answered: 0, correct: 0 });
    const group = byCategory.get(key); group.answered += 1; group.correct += Number(row.outcome === 'Correct');
  }
  const categories = [...byCategory.values()].map((group) => ({ ...group, accuracyPercent: Math.round(group.correct / group.answered * 100) }))
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.answered - a.answered);
  const weakest = categories.find((group) => group.answered >= 3 && group.accuracyPercent < 90) ?? null;
  const correct = rows.filter((row) => row.outcome === 'Correct').length;
  return { answered: rows.length, correct, accuracyPercent: rows.length ? Math.round(correct / rows.length * 100) : null, categories, weakest,
    recommendation: !rows.length ? 'No Holds & Verification answers yet. Start on Easy to learn the hold table and the ID rules.'
      : weakest ? `Weakest area: ${weakest.label} (${weakest.accuracyPercent}% over ${weakest.answered} answers). Pick the matching topic and review the explanations.`
        : 'Every area with 3 or more answers is at 90% or better. Move up a difficulty or shorten the timer.' };
}
