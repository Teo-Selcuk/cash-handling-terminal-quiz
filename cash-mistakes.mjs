// Integer-cent signatures are possibilities, not a reconstruction of mental work.
const cents = value => Number.isSafeInteger(value) && value >= 0;
const money = value => `$${(value / 100).toFixed(2)}`;
const calculate = (operation, left, right) => operation === 'addition' ? left + right : left - right;
const bills = [100, 200, 400, 500, 1000, 2000, 5000, 10000];
const coins = [1, 5, 10, 25, 50, 100];

export function analyzeCashMistakes(record) {
  const expected = record.changeOrShortfallCents; const entered = record.userDeclaredAmountCents;
  const possibilities = []; const steps = [];
  const add = (type, stage, description, extra = {}) => {
    if (!possibilities.some(p => p.description === description && p.stage === stage)) {
      possibilities.push({ type, stage, description, evidence: 'Inferred', ...extra });
    }
  };
  const savedSteps = Array.isArray(record.calculationSteps) ? record.calculationSteps.slice(0, 10) : [];
  savedSteps.forEach((step, index) => {
    if (!['addition', 'subtraction'].includes(step?.operation) || ![step.leftCents, step.rightCents, step.enteredCents].every(cents)) return;
    const target = calculate(step.operation, step.leftCents, step.rightCents);
    if (!Number.isSafeInteger(target)) return;
    steps.push({ ...step, stage: index + 1, expectedCents: target, wrong: target !== step.enteredCents, evidence: 'Confirmed' });
  });
  if (cents(record.countedTenderCents) && cents(record.cashGivenCents) && record.countedTenderCents !== record.cashGivenCents) {
    const follows = cents(record.amountDueCents) && Math.abs(record.countedTenderCents - record.amountDueCents) === entered;
    possibilities.push({ type: 'Recorded count discrepancy', stage: 'Cash total', description: `Recorded cash total ${money(record.countedTenderCents)} differs from tender ${money(record.cashGivenCents)}${follows ? '; final answer follows that total' : ''}`, evidence: 'Confirmed' });
  }
  if (['Timed Out', 'Not answered'].includes(record.outcome) || record.userAnswer === '' || record.userAnswer === 'Exact'
    || !cents(expected) || !cents(entered) || expected === entered) return { possibilities, steps };
  let operation = record.arithmeticOperation; let left = record.arithmeticLeftCents; let right = record.arithmeticRightCents;
  if (!['addition', 'subtraction'].includes(operation) || ![left, right].every(cents) || calculate(operation, left, right) !== expected) {
    const due = record.amountDueCents; const tender = record.cashGivenCents;
    if ([due, tender].every(cents) && Math.abs(due - tender) === expected && due !== tender) {
      operation = 'subtraction'; left = Math.max(due, tender); right = Math.min(due, tender);
    } else operation = null;
  }
  if (operation) {
    const opposite = calculate(operation === 'addition' ? 'subtraction' : 'addition', left, right);
    if (opposite !== expected && opposite === entered) add('Wrong operation', 'Final operation', `Used ${operation === 'addition' ? 'subtraction' : 'addition'} instead of ${operation}`);
    const crosses = operation === 'addition' ? left % 100 + right % 100 >= 100 : left % 100 < right % 100;
    if (crosses && entered === expected + (operation === 'addition' ? -100 : 100)) add('Carry/borrow', 'Final operation', `Possible omitted ${operation === 'addition' ? 'carry' : 'borrow'} of $1.00`);
    const oppositeCents = operation === 'addition' ? ((left % 100 - right % 100) + 100) % 100 : (left % 100 + right % 100) % 100;
    if (entered % 100 === oppositeCents && oppositeCents !== expected % 100) add('Cent operation', 'Final operation', 'Cents match the opposite operation');
  }
  const due = record.amountDueCents; const tender = record.cashGivenCents;
  const terms = Array.isArray(record.tenderBreakdown) ? record.tenderBreakdown.filter(t => cents(t?.cents) && t.cents > 0 && Number.isSafeInteger(t.count) && t.count > 0) : [];
  const total = terms.reduce((sum, t) => sum + t.cents * t.count, 0);
  // Denominations can explain a final change/shortfall only when recorded totals reconcile.
  if ([due, tender].every(cents) && total === tender && Number.isSafeInteger(total) && Math.abs(due - tender) === expected) {
    const mutations = [];
    const finalMatches = delta => cents(tender + delta) && Math.abs(tender + delta - due) === entered;
    terms.forEach((term, index) => {
      const bill = term.category === 'Bill' || (term.category !== 'Coin' && term.cents >= 100);
      const kind = bill ? 'Bill' : 'Coin';
      const stage = `Count term ${index + 1}`;
      for (const countDelta of [-1, 1]) {
        if (term.count + countDelta < 0) continue;
        const delta = term.cents * countDelta;
        const description = `${kind} denomination/counting error: ${countDelta > 0 ? 'one extra' : 'one missing'} ${money(term.cents)} (${money(Math.abs(delta))} difference)`;
        mutations.push({ delta, index, description });
        if (finalMatches(delta)) add(`${kind} count`, stage, description, { from: term.cents, to: term.cents });
      }
      for (const replacement of bill ? bills : coins) {
        if (replacement === term.cents) continue;
        // One piece or the whole denomination group may have been read incorrectly.
        for (const count of new Set([1, term.count])) {
          const delta = (replacement - term.cents) * count;
          if (finalMatches(delta)) add(`${kind} denomination`, stage, `${count} × ${money(term.cents)} read as ${money(replacement)}`, { from: term.cents, to: replacement });
        }
      }
      if (terms.length > 1 && finalMatches(-term.cents * term.count)) add('Omitted term', `Count term ${index + 1}`, `Omitted ${term.count} × ${money(term.cents)} from the cash total`);
      if (index > 0 && finalMatches(-2 * term.cents * term.count)) add('Wrong operation', `Count addition ${index}`, `Subtracted ${term.count} × ${money(term.cents)} instead of adding that term (assumes the displayed term order)`);
    });
    for (let i = 0; i < mutations.length; i++) for (let j = i + 1; j < mutations.length; j++) {
      const a = mutations[i]; const b = mutations[j];
      if (a.index !== b.index && finalMatches(a.delta + b.delta)) add('Multiple possible errors', `Count terms ${a.index + 1} and ${b.index + 1}`, `${a.description}; ${b.description}`);
    }
  }
  return { possibilities, steps };
}
