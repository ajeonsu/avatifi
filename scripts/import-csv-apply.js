/**
 * Map sheet CSV → Supabase rows.
 * Default: dry-run (no writes). Pass --apply to upsert (requires SUPABASE_URL + key).
 *
 * Usage:
 *   node scripts/import-csv-apply.js path/to/商談.csv deal
 *   node scripts/import-csv-apply.js path/to/商談.csv deal --apply
 *   node scripts/import-csv-apply.js path/to/folder --all [--apply]
 *
 * Safety: --apply refuses unless CRM_IMPORT_APPLY=1 is also set.
 */
const fs = require('fs');
const path = require('path');

// Reuse field maps from dry-run module by duplicating the small maps (keep scripts independent).
const FIELD_MAPS = {
  deal: {
    商談ID: 'id',
    リード獲得日: 'lead_date',
    お名前: 'name',
    会社名: 'company',
    業種: 'industry',
    連絡手段: 'channel',
    メールアドレス: 'email',
    SNSのURL: 'sns',
    フォロワー数: 'followers',
    経路: 'source',
    経路の詳細: 'source_detail',
    リード獲得者: 'lead_owner',
    アポ獲得者: 'apo_owner',
    アポ獲得日: 'apo_date',
    商談者: 'closer',
    商談予定日: 'meet_plan',
    商談実施日: 'meet_date',
    商談結果: 'result',
    結果の理由: 'reason',
    受注した商材: 'won_service',
    '受注：初期費用（税込）': 'won_init',
    '受注：月額（税込）': 'won_fee',
    受注日: 'won_date',
    '顧客名（台帳）': 'customer',
    段階: 'stage',
  },
  cust: {
    顧客名: 'name',
    会社名: 'company',
    読み: 'kana',
    業種: 'industry',
    契約サービス: 'service',
    契約状態: 'state',
    契約日: 'contract',
    担当営業: 'sales',
    CS担当: 'cs',
    紹介した代理店: 'agency',
    流入経路: 'source',
    商談ID: 'deal',
    '初期費用（税込）': 'init',
    '月額（税込）': 'fee',
    メールアドレス: 'email',
    avatar_id: 'avatar',
    voice_id: 'voice_id',
  },
  req: {
    依頼ID: 'id',
    受付日時: 'received',
    顧客名: 'cust',
    型: 'type',
    何の動画か: 'theme',
    担当営業: 'sales',
    状態: 'status',
    誰待ち: 'waiting',
    納品日: 'delivered',
    メモ: 'memo',
    声: 'voice',
    作り方: 'make',
  },
};

const TABLE = { deal: 'deals', cust: 'customers', req: 'requests' };
const PK = { deal: 'id', cust: 'name', req: 'id' };
const FILE_ALIASES = {
  deal: ['商談.csv', 'deals.csv', 'deal.csv'],
  cust: ['顧客.csv', 'customers.csv', 'cust.csv'],
  req: ['依頼.csv', 'requests.csv', 'req.csv'],
};

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
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQ = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (c === '\n' || (c === '\r' && s[i + 1] === '\n')) {
      row.push(cell);
      cell = '';
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
      i += c === '\r' ? 2 : 1;
      continue;
    }
    if (c === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  row.push(cell);
  if (row.some((x) => String(x).trim() !== '')) rows.push(row);
  return rows;
}

function mapFile(file, entity) {
  const map = FIELD_MAPS[entity];
  if (!map) throw new Error('Unknown entity: ' + entity);
  const text = fs.readFileSync(file, 'utf8');
  const grid = parseCsv(text);
  if (!grid.length) throw new Error('Empty CSV: ' + file);
  const headers = grid[0].map((h) => String(h).trim());
  const mapped = headers.map((h) => map[h] || null);
  const unknownHeaders = headers.filter((h, i) => h && !mapped[i]);
  const rows = grid.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      const k = mapped[i];
      if (!k) return;
      const v = r[i] == null ? '' : String(r[i]).trim();
      if (v !== '') o[k] = v;
    });
    return o;
  }).filter((o) => o[PK[entity]]);
  return {
    file: path.resolve(file),
    entity,
    table: TABLE[entity],
    pk: PK[entity],
    rows,
    unknownHeaders,
    mappedColumns: mapped.filter(Boolean).length,
  };
}

function findInFolder(dir, entity) {
  for (const n of FILE_ALIASES[entity]) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function upsertBatch(table, pk, rows) {
  const sb = require('../api/supabaseClient');
  if (!sb.configured()) throw new Error('SUPABASE_URL + key required for --apply');
  const CHUNK = 50;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await sb.rest(table, {
      method: 'POST',
      query: 'on_conflict=' + encodeURIComponent(pk),
      body: chunk,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    written += chunk.length;
  }
  return written;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const all = args.includes('--all');
  const positional = args.filter((a) => !a.startsWith('--'));
  const target = positional[0];
  const entityArg = positional[1];

  if (!target) {
    console.log('Usage: node scripts/import-csv-apply.js <file.csv> [deal|cust|req] [--apply]');
    console.log('   or: node scripts/import-csv-apply.js <folder> --all [--apply]');
    process.exit(2);
  }

  if (apply && process.env.CRM_IMPORT_APPLY !== '1') {
    console.error('Refusing --apply without CRM_IMPORT_APPLY=1 (safety latch).');
    process.exit(1);
  }

  const jobs = [];
  if (all || fs.statSync(target).isDirectory()) {
    for (const entity of Object.keys(FILE_ALIASES)) {
      const f = findInFolder(target, entity);
      if (f) jobs.push(mapFile(f, entity));
    }
    if (!jobs.length) {
      console.error('No matching CSVs in folder:', target);
      process.exit(2);
    }
  } else {
    const entity = entityArg || 'deal';
    jobs.push(mapFile(target, entity));
  }

  const report = { generatedAt: new Date().toISOString(), apply: false, jobs: [] };

  for (const job of jobs) {
    const entry = {
      file: job.file,
      entity: job.entity,
      table: job.table,
      rows: job.rows.length,
      mappedColumns: job.mappedColumns,
      unknownHeaders: job.unknownHeaders,
      sample: job.rows.slice(0, 2),
      written: 0,
    };
    if (apply) {
      entry.written = await upsertBatch(job.table, job.pk, job.rows);
      report.apply = true;
    }
    report.jobs.push(entry);
  }

  report.note = apply
    ? 'Applied upserts to Supabase (merge-duplicates). Review counts vs integrity:sheets.'
    : 'DRY RUN — no writes. Re-run with CRM_IMPORT_APPLY=1 and --apply after boss OK.';
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
