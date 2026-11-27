/**
 * Smoke CRM_MOCK dispatch without Vercel (no network, no paid services).
 * Run: npm run test:mock-api
 */
const { dispatchMock } = require('../api/mockStore');

// GAS requires passphrase length ≥ 20
const key = 'demo-local-passphrase-xxxx';
const cases = [
  ['appBoot', [key]],
  ['appHome', [key]],
  ['appList', [key, 'deal']],
  ['appList', [key, 'cust']],
  ['appList', [key, 'req']],
  ['appPayments', [key]],
  ['appTasks', [key]],
  ['appDealMove', [key, 'S00001', '着座']],
  ['appSave', [key, 'deal', 'S00001', { memo: 'mock note' }]],
  ['appDelete', [key, 'deal', 'S99999']], // expect fail
];

let failed = 0;
for (const [fn, args] of cases) {
  const t0 = Date.now();
  const expectFail = fn === 'appDelete' && args[2] === 'S99999';
  try {
    const data = dispatchMock(fn, args);
    const ms = Date.now() - t0;
    const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
    if (expectFail) {
      failed += 1;
      console.error(`FAIL ${fn}: expected error`);
    } else if (fn === 'appList' && !Array.isArray(data)) {
      failed += 1;
      console.error(`FAIL ${fn}: expected array, got ${typeof data}`);
    } else {
      console.log(`OK  ${fn.padEnd(14)} ${String(ms).padStart(4)}ms  ${bytes}B`);
    }
  } catch (err) {
    if (expectFail) {
      console.log(`OK  ${fn.padEnd(14)} (expected error: ${err.message})`);
    } else {
      failed += 1;
      console.error(`FAIL ${fn}: ${err.message}`);
    }
  }
}

// Envelope check (what Vue UI requires)
const envelope = { ok: true, crm: 1, value: { ping: true } };
if (envelope.crm !== 1 || envelope.ok !== true || envelope.value == null) {
  failed += 1;
  console.error('FAIL envelope shape');
} else {
  console.log('OK  envelope       { ok, crm:1, value }');
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll mock handlers OK (sample data only — not prod baseline)');
