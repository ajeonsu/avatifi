/**
 * Dump live preview entity lists to a CSV folder (self-check / integrity dry-run).
 * Does NOT replace boss 依頼台帳 export — preview seed only.
 *
 * Usage:
 *   node scripts/dump-preview-csv.js [out-folder]
 * Default out: fixtures/preview-seed-csv/
 */
const fs = require('fs');
const path = require('path');

const pass = process.env.CRM_PREVIEW_KEY || 'avatifi-preview-key-2026-ok';
const url = process.env.CRM_URL || 'https://avatifi.vercel.app/api/crm';

const ENTITIES = {
  deal: {
    file: '商談.csv',
    headers: [
      ['id', '商談ID'],
      ['leadDate', 'リード獲得日'],
      ['name', 'お名前'],
      ['company', '会社名'],
      ['stage', '段階'],
      ['source', '経路'],
      ['leadOwner', 'リード獲得者'],
      ['apoOwner', 'アポ獲得者'],
      ['closer', '商談者'],
      ['result', '商談結果'],
      ['customer', '顧客名（台帳）'],
    ],
  },
  cust: {
    file: '顧客.csv',
    headers: [
      ['name', '顧客名'],
      ['company', '会社名'],
      ['service', '契約サービス'],
      ['state', '契約状態'],
      ['sales', '担当営業'],
      ['cs', 'CS担当'],
      ['agency', '紹介した代理店'],
      ['deal', '商談ID'],
    ],
  },
  req: {
    file: '依頼.csv',
    headers: [
      ['id', '依頼ID'],
      ['cust', '顧客名'],
      ['type', '型'],
      ['theme', '何の動画か'],
      ['sales', '担当営業'],
      ['status', '状態'],
      ['waiting', '誰待ち'],
      ['memo', 'メモ'],
    ],
  },
  camp: {
    file: '施策.csv',
    headers: [
      ['id', '施策ID'],
      ['name', '施策名'],
      ['kind', '区分'],
      ['date', '日付'],
      ['state', '状態'],
    ],
  },
  agency: {
    file: '代理店.csv',
    headers: [
      ['name', '代理店名'],
      ['kind', '区分'],
    ],
  },
};

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
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

(async () => {
  const outDir = path.resolve(
    process.argv[2] || path.join(__dirname, '..', 'fixtures', 'preview-seed-csv')
  );
  fs.mkdirSync(outDir, { recursive: true });

  const summary = { generatedAt: new Date().toISOString(), folder: outDir, files: {} };

  for (const [entity, meta] of Object.entries(ENTITIES)) {
    const rows = await crm('appList', [entity]);
    const list = Array.isArray(rows) ? rows : [];
    const lines = [meta.headers.map((h) => h[1]).join(',')];
    list.forEach((row) => {
      lines.push(meta.headers.map(([k]) => csvEscape(row[k])).join(','));
    });
    const file = path.join(outDir, meta.file);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    summary.files[entity] = { file: meta.file, rows: list.length };
  }

  // payments (not a simple appList entity)
  const pays = await crm('appPayments', []);
  const payRows = (pays && pays.rows) || pays || [];
  const payList = Array.isArray(payRows) ? payRows : [];
  const payHeaders = [
    ['key', 'キー'],
    ['customer', '顧客名'],
    ['kind', '区分'],
    ['date', '予定日'],
    ['amount', '金額'],
    ['method', '方法'],
  ];
  const payLines = [payHeaders.map((h) => h[1]).join(',')];
  payList.forEach((row) => {
    payLines.push(payHeaders.map(([k]) => csvEscape(row[k])).join(','));
  });
  fs.writeFileSync(path.join(outDir, '入金.csv'), payLines.join('\n') + '\n', 'utf8');
  summary.files.pay = { file: '入金.csv', rows: payList.length };

  const outPath = path.join(__dirname, '..', 'docs', `preview-csv-dump-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, written: outPath }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
