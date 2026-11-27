/**
 * Dry-run CSV → staging row mapper (Phase 3 prep).
 * Expects UTF-8 CSV with header row matching sheet Japanese labels.
 * Does NOT write to Supabase. Usage:
 *   node scripts/import-csv-dry-run.js path/to/商談.csv deal
 */
const fs = require('fs');
const path = require('path');

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
    受付日時: 'received_at',
    顧客名: 'customer',
    型: 'type',
    何の動画か: 'theme',
    担当営業: 'sales',
    状態: 'status',
    誰待ち: 'waiting',
    納品日: 'delivered_at',
    メモ: 'memo',
    声: 'voice',
    作り方: 'make',
  },
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

function main() {
  const file = process.argv[2];
  const entity = process.argv[3] || 'deal';
  if (!file) {
    console.log('Usage: node scripts/import-csv-dry-run.js <file.csv> [deal|cust|req]');
    process.exit(2);
  }
  const map = FIELD_MAPS[entity];
  if (!map) {
    console.error('Unknown entity:', entity);
    process.exit(1);
  }
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, 'utf8');
  const grid = parseCsv(text);
  if (!grid.length) {
    console.error('Empty CSV');
    process.exit(1);
  }
  const headers = grid[0].map((h) => String(h).trim());
  const mapped = headers.map((h) => map[h] || null);
  const known = mapped.filter(Boolean).length;
  const unknown = headers.filter((h, i) => h && !mapped[i]);
  const body = grid.slice(1);
  const sample = body.slice(0, 3).map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      const k = mapped[i];
      if (k) o[k] = r[i];
    });
    return o;
  });

  const report = {
    file: abs,
    entity,
    rows: body.length,
    headers: headers.length,
    mappedColumns: known,
    unknownHeaders: unknown,
    sample,
    note: 'DRY RUN only — no Supabase writes. Apply schema + load after boss OK + sheet export.',
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
