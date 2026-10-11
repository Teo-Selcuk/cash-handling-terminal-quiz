import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCashMistakes } from '../cash-mistakes.mjs';
const cash = (entered, extra = {}) => ({ amountDueCents: 275, cashGivenCents: 2000, changeOrShortfallCents: 1725,
  userDeclaredAmountCents: entered, tenderBreakdown: [{ cents: 2000, count: 1, category: 'Bill' }], ...extra });

test('exact integer-cent hypotheses retain multiple explanations without proving reasoning', () => {
  const analysis = analyzeCashMistakes(cash(1825, { cashGivenCents: 2100, amountDueCents: 375,
    tenderBreakdown: [{ cents: 2000, count: 1, category: 'Bill' }, { cents: 100, count: 1, category: 'Bill' }] }));
  assert.ok(analysis.possibilities.some(p => p.type === 'Bill count'));
  assert.ok(analysis.possibilities.some(p => p.type === 'Bill denomination' && p.from === 100 && p.to === 200));
  assert.ok(analysis.possibilities.every(p => p.evidence === 'Inferred'));
  assert.ok(analysis.possibilities.length > 1);
});
test('wrong operation and borrowing are exact signatures; zero difference is not a mistake', () => {
  assert.ok(analyzeCashMistakes(cash(2275)).possibilities.some(p => p.type === 'Wrong operation'));
  assert.ok(analyzeCashMistakes(cash(1825)).possibilities.some(p => p.type === 'Carry/borrow'));
  assert.equal(analyzeCashMistakes(cash(1725)).possibilities.length, 0);
});
test('coin swaps and two-term count errors can explain final amounts', () => {
  const row = cash(1900, { amountDueCents: 225, cashGivenCents: 2150, changeOrShortfallCents: 1925,
    tenderBreakdown: [{ cents: 2000, count: 1 }, { cents: 100, count: 1 }, { cents: 25, count: 2 }] });
  assert.ok(analyzeCashMistakes(row).possibilities.some(p => p.type === 'Coin count'));
  const multiple = cash(1650, { amountDueCents: 475, cashGivenCents: 2100, changeOrShortfallCents: 1625,
    tenderBreakdown: [{ cents: 2000, count: 1 }, { cents: 100, count: 1 }] });
  assert.ok(analyzeCashMistakes(multiple).possibilities.every(p => p.evidence === 'Inferred'));
  const combined = cash(975, { amountDueCents: 375, cashGivenCents: 1225, changeOrShortfallCents: 850,
    tenderBreakdown: [{ cents: 1000, count: 1 }, { cents: 100, count: 2 }, { cents: 25, count: 1 }] });
  assert.ok(analyzeCashMistakes(combined).possibilities.some(p => p.type === 'Multiple possible errors'));
  const swap = cash(835, { amountDueCents: 375, cashGivenCents: 1225, changeOrShortfallCents: 850,
    tenderBreakdown: [{ cents: 1000, count: 1 }, { cents: 100, count: 2 }, { cents: 25, count: 1 }] });
  assert.ok(analyzeCashMistakes(swap).possibilities.some(p => p.type === 'Coin denomination' && p.from === 25 && p.to === 10));
});
test('recorded steps confirm local arithmetic errors, while absent steps stay unavailable', () => {
  const analysis = analyzeCashMistakes(cash(1825, { calculationSteps: [
    { leftCents: 1000, rightCents: 1000, operation: 'addition', enteredCents: 2100 },
    { leftCents: 2100, rightCents: 275, operation: 'subtraction', enteredCents: 1825 },
  ] }));
  assert.equal(analysis.steps[0].evidence, 'Confirmed');
  assert.equal(analysis.steps[0].wrong, true);
  assert.equal(analysis.steps[1].wrong, false);
  assert.equal(analyzeCashMistakes(cash(1825)).steps.length, 0);
});
test('partial, unsafe or inconsistent inputs cannot generate denomination explanations', () => {
  const result = analyzeCashMistakes(cash(1825, { tenderBreakdown: [{ cents: 2000, count: 2 }], calculationSteps: [{ leftCents: 2000 }] }));
  assert.equal(result.steps.length, 0);
  assert.equal(result.possibilities.some(p => p.type === 'Bill count'), false);
  assert.equal(analyzeCashMistakes(cash(0, { outcome: 'Timed Out', userAnswer: '' })).possibilities.length, 0);
  assert.equal(analyzeCashMistakes(cash(0, { userAnswer: 'Exact' })).possibilities.length, 0);
});
