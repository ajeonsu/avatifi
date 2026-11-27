const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '..',
  'Avatifi管理システム_デプロイ用_20261125',
  '2_ソース',
  '営業.gs'
);
const text = fs.readFileSync(src, 'utf8');

const fieldConsts = [
  'CRM_DEAL_FIELDS',
  'CRM_CAMP_FIELDS',
  'CRM_PEOPLE_FIELDS',
  'CRM_CARD_FIELDS',
  'CRM_AGENCY_FIELDS',
  'CRM_CUST_FIELDS',
  'CRM_REQ_FIELDS',
  'CRM_TASK_FIELDS',
];

function parseFields(name) {
  const re = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`);
  const m = text.match(re);
  if (!m) return [];
  const rows = [];
  const rowRe = /\[\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/g;
  let r;
  while ((r = rowRe.exec(m[1]))) {
    rows.push({ key: r[1], label: r[2], type: r[3] });
  }
  return rows;
}

const out = {};
for (const name of fieldConsts) out[name] = parseFields(name);

const entities = {
  deal: { tab: '商談', fields: 'CRM_DEAL_FIELDS', table: 'deals' },
  camp: { tab: '施策', fields: 'CRM_CAMP_FIELDS', table: 'campaigns' },
  people: { tab: '参加者', fields: 'CRM_PEOPLE_FIELDS', table: 'people' },
  card: { tab: '名刺', fields: 'CRM_CARD_FIELDS', table: 'cards' },
  agency: { tab: '代理店', fields: 'CRM_AGENCY_FIELDS', table: 'agencies' },
  cust: { tab: '顧客', fields: 'CRM_CUST_FIELDS', table: 'customers' },
  req: { tab: '依頼', fields: 'CRM_REQ_FIELDS', table: 'requests' },
  task: { tab: 'タスク', fields: 'CRM_TASK_FIELDS', table: 'tasks' },
};

function typeMap(t) {
  if (t === 'date') return 'date';
  if (t === 'yen' || t === 'number') return 'numeric';
  if (t === 'check') return 'boolean';
  if (t === 'longtext' || t === 'links') return 'text';
  return 'text';
}

function toSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const appFns = [...text.matchAll(/function (app\w+)\s*\(/g)].map((m) => m[1]);
const uniqueApps = [...new Set(appFns)].sort();

const inventory = {
  generatedAt: new Date().toISOString(),
  source: '営業.gs CRM_*_FIELDS + app* exports',
  sheetTabs: [
    '設定', '商談', '施策', '参加者', '名刺', '代理店', '顧客', 'トライアル',
    '依頼', '入金', 'KPI目標', '履歴', 'フィーの支払い', 'タスク',
  ],
  appFunctions: uniqueApps,
  entities: {},
};

for (const [ent, meta] of Object.entries(entities)) {
  inventory.entities[ent] = {
    tab: meta.tab,
    table: meta.table,
    fields: out[meta.fields] || [],
  };
}

let sql = `-- Avatifi CRM — Supabase/Postgres schema DRAFT
-- Source: 営業.gs CRM_*_FIELDS (pack 20261125)
-- Status: DRAFT — do not apply to production; refine after spreadsheet export
-- Generated: ${new Date().toISOString().slice(0, 10)}

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  roles text[] not null default '{}',
  active boolean not null default true,
  passphrase_hash text,
  key_issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists history_logs (
  id bigserial primary key,
  actor text,
  action text,
  target text,
  items jsonb,
  created_at timestamptz not null default now()
);

create table if not exists holidays (
  day date primary key
);

create table if not exists payment_rules (
  id bigserial primary key,
  method text not null,
  settle_from text,
  settle_to text,
  deposit_months_later int,
  deposit_day text,
  week_close text,
  days_after_close int,
  holiday_policy text,
  min_transfer numeric,
  note text
);

create table if not exists kpi_targets (
  id bigserial primary key,
  ym text not null,
  person text not null default '',
  route text not null default '',
  apo numeric,
  seat numeric,
  contract_count numeric,
  amount numeric,
  seminar numeric,
  valid_deal numeric,
  unique (ym, person, route)
);

create table if not exists payments (
  id bigserial primary key,
  pay_key text unique,
  customer text,
  method text,
  amount numeric,
  charge_date date,
  due_date date,
  due_override date,
  paid_at date,
  status text,
  memo text,
  updated_at timestamptz,
  updated_by text
);

create table if not exists fee_payouts (
  id bigserial primary key,
  pay_month text not null,
  agency text not null,
  adjust_incl_tax numeric,
  paid_incl_tax numeric,
  paid_on date,
  memo text,
  updated_at timestamptz,
  updated_by text,
  unique (pay_month, agency)
);
`;

for (const [ent, meta] of Object.entries(entities)) {
  const fields = out[meta.fields] || [];
  const lines = [];
  let hasPk = false;
  for (const f of fields) {
    const col = toSnake(f.key);
    const pg = typeMap(f.type);
    if (f.key === 'id' && !hasPk) {
      lines.push('  id text primary key');
      hasPk = true;
      continue;
    }
    if ((ent === 'cust' || ent === 'agency') && f.key === 'name' && !hasPk) {
      lines.push('  name text primary key');
      hasPk = true;
      continue;
    }
    lines.push(`  ${col} ${pg}`);
  }
  if (!hasPk) lines.unshift('  id bigserial primary key');

  const seen = new Set();
  const uniq = [];
  for (const l of lines) {
    const n = l.trim().split(/\s+/)[0];
    if (seen.has(n)) continue;
    seen.add(n);
    uniq.push(l);
  }

  sql += `\ncreate table if not exists ${meta.table} (\n${uniq.join(',\n')},\n  updated_at timestamptz,\n  updated_by text\n);\n`;
  sql += `comment on table ${meta.table} is '${meta.tab} / entity=${ent}';\n`;
}

sql += `
create index if not exists deals_lead_date_idx on deals (lead_date);
create index if not exists deals_source_idx on deals (source, source_detail);
create index if not exists payments_due_date_idx on payments (due_date);
create index if not exists requests_status_idx on requests (status);
create index if not exists tasks_assignee_idx on tasks (assignee);
create index if not exists fee_payouts_month_agency_idx on fee_payouts (pay_month, agency);

-- RLS: enable after auth model is locked with boss/client
-- alter table deals enable row level security;
`;

const docsDir = path.join(__dirname, 'docs');
const migDir = path.join(__dirname, 'supabase', 'migrations');
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(migDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'entity-inventory.json'), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(migDir, '20261127_avatifi_schema_draft.sql'), sql);

const md = [];
md.push('# Avatifi CRM — API & entity inventory (frozen from pack)');
md.push('');
md.push(`Generated: ${inventory.generatedAt}`);
md.push('');
md.push('## Sheet tabs');
md.push(inventory.sheetTabs.map((t) => `- ${t}`).join('\n'));
md.push('');
md.push('## app* functions (CRM API surface)');
md.push(uniqueApps.map((f) => `- \`${f}\``).join('\n'));
md.push('');
md.push('## Entities');
for (const [ent, meta] of Object.entries(inventory.entities)) {
  md.push(`### ${ent} → \`${meta.table}\` (tab: ${meta.tab})`);
  md.push('| key | label | type |');
  md.push('|-----|-------|------|');
  for (const f of meta.fields) {
    md.push(`| ${f.key} | ${f.label} | ${f.type} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(docsDir, 'API-AND-ENTITY-INVENTORY.md'), md.join('\n'));

console.log(
  Object.entries(inventory.entities)
    .map(([k, v]) => `${k}:${v.fields.length}`)
    .join(' ')
);
console.log('apps', uniqueApps.length);
console.log('ok');
