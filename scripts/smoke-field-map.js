const assert = require('assert');
const { toSnake, toCamel, rowToCamel, patchToSnake, paymentToUi } = require('../api/fieldMap');

assert.strictEqual(toSnake('leadDate'), 'lead_date');
assert.strictEqual(toCamel('lead_date'), 'leadDate');
assert.strictEqual(toCamel('pay_key'), 'payKey');
assert.deepStrictEqual(rowToCamel({ lead_date: '2026-01-01', stage: 'アポ' }), {
  leadDate: '2026-01-01',
  stage: 'アポ',
});
assert.deepStrictEqual(patchToSnake({ leadDate: '2026-01-01', wonInit: 1 }), {
  lead_date: '2026-01-01',
  won_init: 1,
});
const pay = paymentToUi({
  pay_key: 'a|b|1',
  customer: 'X',
  amount: 100,
  due_date: '2026-11-30',
  status: 'ok',
  method: 'マネフォ',
});
assert.strictEqual(pay.key, 'a|b|1');
assert.strictEqual(pay.ok, true);
assert.strictEqual(pay.date, '2026-11-30');
console.log('smoke-field-map OK');
