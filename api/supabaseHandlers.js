/**
 * Phase 1 Supabase-backed app* handlers (subset).
 * Auth: SHA-256 hex of passphrase → app_users.passphrase_hash (GAS crmHash_ parity).
 * Requires tables from supabase/migrations/20261127_avatifi_schema_draft.sql
 */

const crypto = require('crypto');
const sb = require('./supabaseClient');
const { STAGES } = require('./mockStore');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

async function authByPassphrase(passphrase) {
  const k = String(passphrase || '').trim();
  if (k.length < 20) throw new Error('合言葉がありません。青柳さんから届いた専用のリンクから開いてください');
  const hash = sha256Hex(k);
  const rows = await sb.select(
    'app_users',
    `passphrase_hash=eq.${encodeURIComponent(hash)}&active=eq.true&select=id,name,roles,active&limit=1`
  );
  const user = Array.isArray(rows) ? rows[0] : null;
  if (!user) throw new Error('合言葉が違います（作り直したときは、新しいリンクから開き直してください）');
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const prodOnly = roles.length > 0 && roles.every((r) => r === '制作');
  return {
    id: user.id,
    name: user.name,
    roles,
    admin: roles.indexOf('管理') >= 0,
    prodOnly,
    active: !!user.active,
  };
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function appBoot(user) {
  return {
    user: {
      name: user.name,
      roles: user.roles,
      admin: user.admin,
      prodOnly: user.prodOnly,
    },
    lists: {},
    stages: STAGES,
    cats: {},
    fields: {},
    today: todayYmd(),
    formLink: '',
    ledgerUrl: '',
    options: { kpiMonths: 3, recordStart: '', idleWarn: 30, idleLate: 60 },
    meta: { backend: 'supabase', project: 'qxzftftbvgysgzhqgfoz' },
  };
}

async function appList(user, entity) {
  const e = String(entity || '').trim();
  if (e === 'req' || !user.prodOnly) {
    /* prod-only may list req; others ok */
  } else if (user.prodOnly && e !== 'req') {
    throw new Error(`${user.name}さんは「制作」の役割なので、制作（依頼・月の本数・フォームの回答）だけが見られます`);
  }

  const tableOf = {
    deal: 'deals',
    cust: 'customers',
    req: 'requests',
    camp: 'campaigns',
    agency: 'agencies',
    people: 'people',
    card: 'cards',
  };
  const table = tableOf[e];
  if (!table) throw new Error('知らない一覧です：' + e);
  const rows = await sb.select(table, 'select=*&limit=5000');
  return Array.isArray(rows) ? rows : [];
}

async function appHome(user) {
  let deals = [];
  try {
    deals = await sb.select('deals', 'select=id,stage&limit=5000');
  } catch {
    deals = [];
  }
  const byStage = STAGES.map((s) => ({
    stage: s,
    n: (deals || []).filter((d) => d.stage === s).length,
  }));
  return {
    lists: { dealsByStage: byStage, me: user.name },
    kpi: { total: {}, month: todayYmd().slice(0, 7) },
    meta: { backend: 'supabase' },
  };
}

async function appSave(user, entity, id, changes) {
  const tableOf = {
    deal: { table: 'deals', idKey: 'id' },
    cust: { table: 'customers', idKey: 'name' },
    camp: { table: 'campaigns', idKey: 'id' },
    agency: { table: 'agencies', idKey: 'name' },
  };
  const meta = tableOf[entity];
  if (!meta) throw new Error('保存できない表です：' + entity);
  const want = String(id == null ? '' : id).trim();
  const patch = Object.assign({}, changes || {}, { updated_at: new Date().toISOString(), updated_by: user.name });
  if (want) {
    const rows = await sb.update(
      meta.table,
      `${meta.idKey}=eq.${encodeURIComponent(want)}`,
      patch
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('見つかりません：' + want);
    return { row, notes: ['更新（supabase）'] };
  }
  const rows = await sb.insert(meta.table, [patch]);
  return { row: Array.isArray(rows) ? rows[0] : rows, notes: ['新規（supabase）'] };
}

async function appDelete(user, entity, id) {
  const tableOf = {
    deal: { table: 'deals', idKey: 'id' },
    cust: { table: 'customers', idKey: 'name' },
    camp: { table: 'campaigns', idKey: 'id' },
    agency: { table: 'agencies', idKey: 'name' },
  };
  const meta = tableOf[entity];
  if (!meta) throw new Error('消せない表です：' + entity);
  const want = String(id == null ? '' : id).trim();
  if (!want) throw new Error('どれを消すかが分かりません');
  const rows = await sb.del(meta.table, `${meta.idKey}=eq.${encodeURIComponent(want)}`);
  if (!rows || (Array.isArray(rows) && !rows.length)) throw new Error('見つかりません：' + want);
  return { notes: ['削除（supabase）'] };
}

/**
 * @returns {Promise<unknown>|null} null if fn not implemented on Supabase path
 */
async function dispatchSupabase(fn, args) {
  if (!sb.configured()) return null;
  const user = await authByPassphrase(args[0]);
  const rest = args.slice(1);
  switch (fn) {
    case 'appBoot':
      return appBoot(user);
    case 'appList':
      return appList(user, rest[0]);
    case 'appHome':
      return appHome(user);
    case 'appSave':
      return appSave(user, rest[0], rest[1], rest[2]);
    case 'appDelete':
      return appDelete(user, rest[0], rest[1]);
    default:
      return null;
  }
}

module.exports = { dispatchSupabase, authByPassphrase, sha256Hex };
