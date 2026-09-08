import test from 'node:test';
import assert from 'node:assert/strict';
import { createCashGuidance } from '../quiz-core.mjs';

test('guidance explains exact, change, and short customer responses', () => {
  for (const [type, tender, phrase] of [['Exact', 1000, 'exact amount'], ['Change', 1500, 'change'], ['Short', 500, 'still need']]) {
    const guide = createCashGuidance({ dueCents: 1000, tenderedCents: tender, expectedType: type, expectedAmountCents: Math.abs(tender - 1000) });
    assert.match(guide.customer, /\$10.00/);
    assert.ok(guide.say.includes(phrase));
    assert.ok(guide.calculation.includes('$5.00') || type === 'Exact');
  }
});

test('guidance handles impossible requests without suggesting invalid cash', () => {
  const guide = createCashGuidance({ dueCents: 1000, tenderedCents: 1500, expectedType: 'Change', expectedAmountCents: 500, customerBillRequest: { canFlag: true, text: 'Give me a $30 bill.' } });
  assert.match(guide.request, /Flag/);
  assert.match(guide.say, /available bills and coins/);
  assert.match(guide.cash, /\$5/);
});
