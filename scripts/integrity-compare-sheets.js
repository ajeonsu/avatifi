/**
 * Compare live Supabase preview counts to a folder of sheet CSV exports.
 *
 * Expected files (Japanese sheet tab names or English aliases):
 *   商談.csv | deals.csv
 *   顧客.csv | customers.csv
 *   依頼.csv | requests.csv
 *   入金.csv | payments.csv   (optional)
 *
 * Usage:
 *   node scripts/integrity-compare-sheets.js path/to/export-folder
 *
 * Exit 2 if folder missing / empty (waiting for boss export).
 * Exit 1 on compare failures.
 * Exit 0 when report written (even with diffs — diffs are the point).
 */
const fs = require('fs');
const path = require('path');

const pass = process.env.CRM_PREVIEW_KEY || 'avatifi-preview-key-2026-ok';
const url = process.env.CRM_URL || 'https://avatifi.vercel.app/api/crm';

const ALIAS = {
  deal: ['商談.csv', 'deals.csv', 'deal.csv'],
  cust: ['顧客.csv', 'customers.csv', 'cust.csv'],
  req: ['依頼.csv', 'requests.csv', 'req.csv'],
  pay: ['入金.csv', 'payments.csv', 'pay.csv'],
  camp: ['施策.csv', 'campaigns.csv', 'camp.csv'],
  agency: ['代理店.csv', 'agencies.csv', 'agency.csv'],
};

function findFile(dir, names) {
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQ = false;
  const s = String(text).replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

function csvCount(file) {
  if (!file) return { file: null, rows: 0, headers: [] };
  const text = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(text);
  if (!rows.length) return { file, rows: 0, headers: [] };
  return { file, rows: Math.max(0, rows.length - 1), headers: rows[0] };
}

async function crm(fn, args = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm: 1, fn, args: [pass, ...args] }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${fn}: ${j.error || r.status}`);
  return j.value;
}

function stageDist(deals) {
  const o = {};
  (deals || []).forEach((d) => {
    const s = d.stage || '(empty)';
    o[s] = (o[s] || 0) + 1;
  });
  return o;
}

(async () => {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          waiting: true,
          message: 'Provide folder of sheet CSV exports. Still blocked on boss spreadsheet access.',
          usage: 'node scripts/integrity-compare-sheets.js path/to/export-folder',
          expected: ALIAS,
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const files = {
    deal: findFile(dir, ALIAS.deal),
    cust: findFile(dir, ALIAS.cust),
    req: findFile(dir, ALIAS.req),
    pay: findFile(dir, ALIAS.pay),
    camp: findFile(dir, ALIAS.camp),
    agency: findFile(dir, ALIAS.agency),
  };
  const found = Object.values(files).filter(Boolean);
  if (!found.length) {
    console.error(JSON.stringify({ ok: false, waiting: true, message: 'No matching CSV files in ' + dir, expected: ALIAS }, null, 2));
    process.exit(2);
  }

  const sheet = {
    deal: csvCount(files.deal),
    cust: csvCount(files.cust),
    req: csvCount(files.req),
    pay: csvCount(files.pay),
    camp: csvCount(files.camp),
    agency: csvCount(files.agency),
  };

  const [boot, deals, custs, reqs, pays, camps, agencies] = await Promise.all([
    crm('appBoot'),
    crm('appList', ['deal']),
    crm('appList', ['cust']),
    crm('appList', ['req']),
    crm('appPayments'),
    crm('appList', ['camp']),
    crm('appList', ['agency']),
  ]);

  const sb = {
    deals: deals.length,
    customers: custs.length,
    requests: reqs.length,
    payments: (pays.rows || pays || []).length,
    camps: camps.length,
    agencies: agencies.length,
    dealStages: stageDist(deals),
  };

  const diffs = [];
  const pushDiff = (entity, sheetN, sbN) => {
    if (sheetN == null) return;
    if (sheetN !== sbN) diffs.push({ entity, sheet: sheetN, supabase: sbN, delta: sbN - sheetN });
  };
  pushDiff('deal', sheet.deal.file ? sheet.deal.rows : null, sb.deals);
  pushDiff('cust', sheet.cust.file ? sheet.cust.rows : null, sb.customers);
  pushDiff('req', sheet.req.file ? sheet.req.rows : null, sb.requests);
  pushDiff('pay', sheet.pay.file ? sheet.pay.rows : null, sb.payments);
  pushDiff('camp', sheet.camp.file ? sheet.camp.rows : null, sb.camps);
  pushDiff('agency', sheet.agency.file ? sheet.agency.rows : null, sb.agencies);

  const report = {
    generatedAt: new Date().toISOString(),
    folder: path.resolve(dir),
    backend: boot.meta && boot.meta.backend,
    sheet,
    supabase: sb,
    diffs,
    match: diffs.length === 0,
    notes: [
      'Row counts only — column/value parity is a follow-up once headers are confirmed.',
      'Preview seed will intentionally differ until real migration import runs.',
    ],
  };

  const outPath = path.join(__dirname, '..', 'docs', `integrity-sheet-compare-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, written: outPath }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
