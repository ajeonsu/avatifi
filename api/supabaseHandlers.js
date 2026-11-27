/**
 * Phase 1 Supabase-backed app* handlers (growing subset).
 * Auth: SHA-256 hex of passphrase → app_users.passphrase_hash (GAS crmHash_ parity).
 * Rows mapped camelCase ↔ snake_case for Vue UI.
 */

const crypto = require('crypto');
const sb = require('./supabaseClient');
const { STAGES } = require('./mockStore');
const { rowToCamel, rowsToCamel, patchToSnake, paymentToUi } = require('./fieldMap');

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

function ymNow() {
  return todayYmd().slice(0, 7);
}

const BOOT_LISTS = {
  連絡手段: ['メール', 'LINE', '電話'],
  経路: ['紹介', '施策', '名刺', 'その他'],
  サービス: ['アバター', '自動編集'],
  商談結果: ['見込みA', '見込みB', '見込みC', '申込書送付(受注)', '失注', '商談対象外（無効商談）'],
};

const BOOT_CATS = {
  見込みA: '見込み',
  見込みB: '見込み',
  見込みC: '見込み',
  '申込書送付(受注)': '受注',
  失注: '失注',
  '商談対象外（無効商談）': '無効',
};

const BOOT_FIELDS = {
  deal: [
    ['id', '商談ID'],
    ['leadDate', 'リード獲得日'],
    ['name', 'お名前'],
    ['company', '会社名'],
    ['stage', '段階'],
  ],
  camp: [['id', '施策ID'], ['name', '施策名']],
  agency: [['name', '代理店名']],
  cust: [['name', '顧客名'], ['service', '契約サービス']],
  req: [['id', '依頼ID'], ['cust', '顧客名'], ['status', '状態']],
  people: [['id', '参加者ID'], ['name', 'お名前']],
  card: [['id', '名刺ID'], ['name', 'お名前']],
};

const TABLE_OF = {
  deal: { table: 'deals', idKey: 'id' },
  cust: { table: 'customers', idKey: 'name' },
  req: { table: 'requests', idKey: 'id' },
  camp: { table: 'campaigns', idKey: 'id' },
  agency: { table: 'agencies', idKey: 'name' },
  people: { table: 'people', idKey: 'id' },
  card: { table: 'cards', idKey: 'id' },
  task: { table: 'tasks', idKey: 'id' },
};

async function appBoot(user) {
  return {
    user: {
      name: user.name,
      roles: user.roles,
      admin: user.admin,
      prodOnly: user.prodOnly,
    },
    lists: BOOT_LISTS,
    stages: STAGES,
    cats: BOOT_CATS,
    fields: BOOT_FIELDS,
    today: todayYmd(),
    formLink: '',
    ledgerUrl: '',
    options: { kpiMonths: 3, recordStart: '2026-01', idleWarn: 30, idleLate: 60 },
    meta: { backend: 'supabase', project: 'qxzftftbvgysgzhqgfoz' },
  };
}

async function appList(user, entity) {
  const e = String(entity || '').trim();
  if (user.prodOnly && e !== 'req') {
    throw new Error(`${user.name}さんは「制作」の役割なので、制作（依頼・月の本数・フォームの回答）だけが見られます`);
  }
  const meta = TABLE_OF[e];
  if (!meta) throw new Error('知らない一覧です：' + e);
  const rows = await sb.select(meta.table, 'select=*&limit=5000');
  return rowsToCamel(Array.isArray(rows) ? rows : []);
}

function ymdPlus(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function monthBounds(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to, y, m };
}

function inRange(d, from, to) {
  return !!d && String(d) >= from && String(d) <= to;
}

function metric(actual, target) {
  const t = target === '' || target == null || Number.isNaN(Number(target)) ? '' : Number(target);
  return {
    actual: actual || 0,
    target: t,
    reach: t ? (actual || 0) / t : '',
    due: '',
    pace: '',
    fromRoutes: false,
  };
}

async function loadKpiTargets(ym) {
  try {
    const rows = await sb.select(
      'kpi_targets',
      `ym=eq.${encodeURIComponent(ym)}&select=*&order=id.asc&limit=500`
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function appHome(user, mineOnly) {
  const today = todayYmd();
  const tomorrow = ymdPlus(today, 1);
  const mine = mineOnly !== false;
  const me = (n) => !mine || n === user.name;

  let deals = [];
  let custs = [];
  let reqs = [];
  let pays = [];
  try {
    deals = rowsToCamel(await sb.select('deals', 'select=*&limit=5000'));
  } catch {
    deals = [];
  }
  try {
    custs = rowsToCamel(await sb.select('customers', 'select=*&limit=5000'));
  } catch {
    custs = [];
  }
  try {
    reqs = rowsToCamel(await sb.select('requests', 'select=*&limit=5000'));
  } catch {
    reqs = [];
  }
  try {
    const payRows = await sb.select('payments', 'select=*&limit=5000');
    pays = (Array.isArray(payRows) ? payRows : []).map(paymentToUi);
  } catch {
    pays = [];
  }

  const pick = (list, n) => list.slice(0, n || 50);
  const lists = {
    meetToday: pick(
      deals
        .filter((d) => (d.meetPlan === today || d.meetPlan === tomorrow) && !d.meetDate && me(d.closer || d.apoOwner))
        .sort((a, b) => String(a.meetPlan).localeCompare(String(b.meetPlan)))
    ),
    noResult: pick(
      deals
        .filter((d) => d.meetPlan && d.meetPlan < today && !d.result && me(d.closer || d.apoOwner))
        .sort((a, b) => String(b.meetPlan).localeCompare(String(a.meetPlan)))
    ),
    followUp: pick(
      deals
        .filter((d) => d.stage === '見込み' && d.nextDate && d.nextDate <= today && me(d.closer || d.apoOwner))
        .sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)))
    ),
    newLeads: pick(
      deals
        .filter((d) => d.stage === 'リード' && me(d.apoOwner || d.leadOwner))
        .sort((a, b) => String(b.leadDate).localeCompare(String(a.leadDate)))
    ),
    noContract: pick(custs.filter((c) => c.state !== '終了' && !c.contract && me(c.sales))),
    onboarding: pick(
      custs.filter(
        (c) =>
          c.state !== '終了' &&
          me(c.cs || c.sales) &&
          (c.autopay === '未登録' || c.gform === '未共有' || c.gform === '共有済' || (!c.avatar && !c.voiceId))
      )
    ),
    canceling: pick(
      custs
        .filter((c) => c.state === '解約予定' && me(c.cs || c.sales))
        .sort((a, b) => String(a.end).localeCompare(String(b.end)))
    ),
    latePay: pick(pays.filter((p) => !p.ok && p.date && p.date < today)),
    weekPay: pick(pays.filter((p) => !p.ok && p.date && p.date >= today && p.date <= ymdPlus(today, 7))),
    salesWait: pick(reqs.filter((r) => r.waiting === '営業' && me(r.sales))),
    custWait: pick(reqs.filter((r) => r.waiting === 'お客様' && me(r.sales))),
    me: user.name,
  };

  const ym = ymNow();
  const { from, to } = monthBounds(ym);
  const apo = deals.filter((d) => inRange(d.meetPlan || d.apoDate, from, to)).length;
  const won = deals.filter((d) => inRange(d.wonDate, from, to) || (BOOT_CATS[d.result] === '受注' && inRange(d.resultDate || d.wonDate, from, to))).length;
  const amount = deals
    .filter((d) => BOOT_CATS[d.result] === '受注' && inRange(d.wonDate || d.resultDate, from, to))
    .reduce((s, d) => s + (Number(d.wonInit) || 0) + (Number(d.wonFee) || 0) * 3, 0);

  return {
    lists,
    kpi: { total: { apo, won, amount }, month: ym },
    meta: { backend: 'supabase' },
  };
}

async function appSave(user, entity, id, changes) {
  if (entity === 'task') return appTaskSave(user, id, changes);
  const meta = TABLE_OF[entity];
  if (!meta) throw new Error('保存できない表です：' + entity);
  const want = String(id == null ? '' : id).trim();
  const patch = patchToSnake(changes || {});
  patch.updated_at = new Date().toISOString();
  patch.updated_by = user.name;
  if (entity === 'deal' && !want && !patch.stage) patch.stage = 'リード';
  if (entity === 'deal' && !want && !patch.lead_date) patch.lead_date = todayYmd();

  if (want) {
    const rows = await sb.update(
      meta.table,
      `${meta.idKey}=eq.${encodeURIComponent(want)}`,
      patch
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('見つかりません：' + want);
    return { row: rowToCamel(row), notes: ['更新（supabase）'] };
  }

  if (meta.idKey === 'id' && !patch.id) {
    const prefix = entity === 'deal' ? 'S' : entity === 'camp' ? 'E' : entity === 'people' ? 'P' : entity === 'card' ? 'N' : 'X';
    const digits = entity === 'camp' ? 4 : 5;
    const existing = await sb.select(meta.table, 'select=id&limit=5000');
    const n = (Array.isArray(existing) ? existing.length : 0) + 1;
    patch.id = prefix + String(n).padStart(digits, '0');
  }
  if (meta.idKey === 'name' && !patch.name) throw new Error('名前がありません');

  const rows = await sb.insert(meta.table, [patch]);
  return { row: rowToCamel(Array.isArray(rows) ? rows[0] : rows), notes: ['新規（supabase）'] };
}

async function appDelete(user, entity, id) {
  const meta = TABLE_OF[entity];
  if (!meta) throw new Error('消せない表です：' + entity);
  const want = String(id == null ? '' : id).trim();
  if (!want) throw new Error('どれを消すかが分かりません');
  const rows = await sb.del(meta.table, `${meta.idKey}=eq.${encodeURIComponent(want)}`);
  if (!rows || (Array.isArray(rows) && !rows.length)) throw new Error('見つかりません：' + want);
  return { notes: ['削除（supabase）'] };
}

async function appDealMove(user, id, stage, extra) {
  const want = String(id == null ? '' : id).trim();
  if (!want) throw new Error('商談が見つかりません');
  const rows = await sb.select('deals', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const d = Array.isArray(rows) ? rowToCamel(rows[0]) : null;
  if (!d) throw new Error('商談「' + id + '」が見つかりません');

  let nextStage = stage;
  if (stage === '結果待ち') nextStage = '着座';
  if (stage === '失注・対象外') nextStage = '失注';
  if (STAGES.indexOf(nextStage) < 0) throw new Error('知らない段階です：' + stage);

  const today = todayYmd();
  const ch = { stage: nextStage };
  const x = extra && typeof extra === 'object' ? extra : {};
  const pick = String(x.result || '').trim();
  const cats = BOOT_CATS;

  if (nextStage === 'リード') Object.assign(ch, { result: '', apoDate: '', meetPlan: '', meetDate: '' });
  else if (nextStage === 'アポ') {
    Object.assign(ch, { result: '', meetDate: '' });
    if (!d.apoDate && !d.meetPlan) ch.apoDate = today;
  } else if (nextStage === '着座') {
    Object.assign(ch, {
      result: '',
      meetDate: d.meetDate || (d.meetPlan && d.meetPlan <= today ? d.meetPlan : today),
    });
  } else if (nextStage === '見込み') {
    ch.result = pick && cats[pick] === '見込み' ? pick : d.result && cats[d.result] === '見込み' ? d.result : '見込みB';
    ch.meetDate = d.meetDate || (d.meetPlan && d.meetPlan <= today ? d.meetPlan : today);
  } else if (nextStage === '受注') {
    ch.result = pick && cats[pick] === '受注' ? pick : '申込書送付(受注)';
    ['wonService', 'wonInit', 'wonFee'].forEach((k) => {
      if (x[k] !== undefined && x[k] !== null && String(x[k]).trim() !== '') ch[k] = x[k];
    });
    ch.meetDate = d.meetDate || (d.meetPlan && d.meetPlan <= today ? d.meetPlan : today);
    if (!d.wonDate) ch.wonDate = today;
  } else if (nextStage === '失注' || nextStage === '対象外') {
    if (pick) ch.result = pick;
    else if (!d.result || (cats[d.result] !== '失注' && cats[d.result] !== '無効')) {
      ch.result = nextStage === '対象外' ? '商談対象外（無効商談）' : '失注';
    }
  }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (k === 'result') continue;
      if (v !== undefined) ch[k] = v;
    }
  }
  return appSave(user, 'deal', want, ch);
}

async function appTasks(user) {
  const rows = await sb.select('tasks', 'select=*&order=due.asc.nullslast&limit=5000');
  const manual = rowsToCamel(Array.isArray(rows) ? rows : []).map((t) =>
    Object.assign({}, t, { person: t.person || '（担当なし）', auto: false })
  );
  return {
    me: user.name,
    today: todayYmd(),
    auto: [],
    manual,
  };
}

async function appTaskSave(user, id, changes) {
  const want = String(id == null ? '' : id).trim();
  const patch = patchToSnake(changes || {});
  patch.updated_at = new Date().toISOString();
  patch.updated_by = user.name;
  if (patch.title !== undefined) patch.title = String(patch.title).trim();
  if (want) {
    const rows = await sb.update('tasks', `id=eq.${encodeURIComponent(want)}`, patch);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('見つかりません：' + want);
    return { row: rowToCamel(row), notes: ['更新（supabase）'] };
  }
  if (!patch.id) {
    const existing = await sb.select('tasks', 'select=id&limit=5000');
    const n = (Array.isArray(existing) ? existing.length : 0) + 1;
    patch.id = 'T' + String(n).padStart(5, '0');
  }
  if (!patch.created_by) patch.created_by = user.name;
  const rows = await sb.insert('tasks', [patch]);
  return { row: rowToCamel(Array.isArray(rows) ? rows[0] : rows), notes: ['新規（supabase）'] };
}

async function appTaskDone(user, id, done) {
  const want = String(id == null ? '' : id).trim();
  if (!want) throw new Error('どれを完了にするかが分かりません');
  const mark = done === false || done === '' ? '' : todayYmd();
  return appTaskSave(user, want, { done: mark, doneAt: mark || null });
}

async function appTaskDelete(user, id) {
  return appDelete(user, 'task', id);
}

async function appPayments(_user, fromYm, toYm) {
  const from = String(fromYm || ymNow()).trim();
  const to = String(toYm || from).trim();
  // Filter by due_date month range when dates look like YYYY-MM
  let query = 'select=*&order=due_date.asc.nullslast&limit=5000';
  if (/^\d{4}-\d{2}$/.test(from) && /^\d{4}-\d{2}$/.test(to)) {
    const fromDay = `${from}-01`;
    const [ty, tm] = to.split('-').map(Number);
    const last = new Date(ty, tm, 0);
    const toDay = `${to}-${String(last.getDate()).padStart(2, '0')}`;
    query = `due_date=gte.${fromDay}&due_date=lte.${toDay}&select=*&order=due_date.asc&limit=5000`;
  }
  let rows = [];
  try {
    rows = await sb.select('payments', query);
  } catch {
    rows = await sb.select('payments', 'select=*&limit=5000');
  }
  const ui = (Array.isArray(rows) ? rows : []).map(paymentToUi);
  const amount = ui.reduce((a, p) => a + Number(p.amount || 0), 0);
  let rules = [];
  try {
    const rr = await sb.select('payment_rules', 'select=method,note&limit=100');
    rules = (Array.isArray(rr) ? rr : []).map((r) => ({ method: r.method, note: r.note || '' }));
  } catch {
    rules = [];
  }
  return {
    rows: ui,
    summary: { count: ui.length, amount },
    rules,
  };
}

function payStatusFromFlags(ok, ng) {
  if (ok === true) return 'ok';
  if (ng === true) return 'ng';
  return 'open';
}

async function findPaymentByKey(payKey) {
  const k = String(payKey || '').trim();
  if (!k) return null;
  const rows = await sb.select(
    'payments',
    `pay_key=eq.${encodeURIComponent(k)}&select=*&limit=1`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function appPayEdit(user, pay) {
  if (!pay || !String(pay.key || '').trim()) throw new Error('どの入金かが分かりません');
  const key = String(pay.key).trim();
  const hit = await findPaymentByKey(key);
  const ok = pay.ok === true;
  const ng = !ok && pay.ng === true;
  const status = payStatusFromFlags(ok, ng);
  const actual =
    pay.actual != null && String(pay.actual).trim() !== ''
      ? String(pay.actual).trim()
      : ok
        ? todayYmd()
        : null;
  const keepMoved = pay.keepMoved === true;
  let dueOverride = hit ? hit.due_override || null : null;
  if (!keepMoved && pay.moved !== undefined) {
    const m = String(pay.moved || '').trim();
    dueOverride = m === '' ? null : m;
  }
  const patch = {
    customer: pay.customer != null ? String(pay.customer) : hit ? hit.customer : '',
    method: pay.method != null ? String(pay.method) : hit ? hit.method : '',
    amount: pay.amount != null ? Number(pay.amount) : hit ? hit.amount : 0,
    due_date: hit && hit.due_date ? hit.due_date : pay.date || null,
    due_override: dueOverride,
    paid_at: actual,
    status,
    memo: pay.memo === undefined ? (hit ? hit.memo : '') : String(pay.memo || ''),
    updated_at: new Date().toISOString(),
    updated_by: user.name,
  };
  if (hit) {
    await sb.update('payments', `pay_key=eq.${encodeURIComponent(key)}`, patch);
  } else {
    await sb.insert('payments', [
      Object.assign({}, patch, {
        pay_key: key,
        charge_date: pay.date || null,
      }),
    ]);
  }
  return {
    ok,
    ng,
    moved: dueOverride ? String(dueOverride).slice(0, 10) : '',
  };
}

async function appPayConfirm(user, pay) {
  const p = Object.assign({}, pay || {});
  delete p.moved;
  return appPayEdit(user, Object.assign(p, { keepMoved: true }));
}

async function appPayAdd(user, pay) {
  const date = String((pay && pay.date) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('入金予定日を入れてください');
  const amount = Number(pay && pay.amount);
  if (!amount) throw new Error('金額を入れてください');
  const key = 'M' + crypto.randomBytes(6).toString('hex');
  await sb.insert('payments', [
    {
      pay_key: key,
      customer: String((pay && pay.customer) || ''),
      method: String((pay && pay.method) || ''),
      amount,
      charge_date: date,
      due_date: date,
      paid_at: null,
      status: 'open',
      memo: String((pay && pay.memo) || ''),
      updated_at: new Date().toISOString(),
      updated_by: user.name,
    },
  ]);
  return { key };
}

async function appPayDelete(user, payKey) {
  const k = String(payKey == null ? '' : payKey).trim();
  if (!k || k.charAt(0) !== 'M') {
    throw new Error('消せるのは手で足した入金だけです（契約から出る入金は、顧客の契約・金額を直すと変わります）');
  }
  const hit = await findPaymentByKey(k);
  if (!hit) throw new Error('この入金が見つかりません（ほかの人が消したかもしれません。読み直してください）');
  await sb.del('payments', `pay_key=eq.${encodeURIComponent(k)}`);
  return { ok: true };
}

async function appReqStatus(user, id, status, memo) {
  const want = String(id || '').trim();
  const to = String(status || '').trim();
  if (!want) throw new Error('どの依頼かが分かりません');
  if (!to) throw new Error('状態を入れてください');
  const rows = await sb.select('requests', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const hit = Array.isArray(rows) ? rows[0] : null;
  if (!hit) throw new Error('依頼が見つかりません：' + want);
  const before = String(hit.status || '').trim();
  const patch = {
    status: to,
    status_date: todayYmd(),
    updated_at: new Date().toISOString(),
    updated_by: user.name,
  };
  if (String(memo || '').trim()) {
    const line = `${todayYmd()} ${user.name}：${String(memo).trim()}`;
    patch.memo = hit.memo ? `${hit.memo}\n${line}` : line;
  }
  const updated = await sb.update('requests', `id=eq.${encodeURIComponent(want)}`, patch);
  const row = rowToCamel(Array.isArray(updated) ? updated[0] : updated);
  return {
    row,
    notes: before === to ? [] : [`状態を「${before || '（空）'}」→「${to}」にした（supabase・台帳自動は未移植）`],
  };
}

async function appReqMemo(user, id, text) {
  const want = String(id || '').trim();
  if (!want) throw new Error('どの依頼かが分かりません');
  if (!String(text || '').trim()) throw new Error('メモが空です');
  const rows = await sb.select('requests', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const hit = Array.isArray(rows) ? rows[0] : null;
  if (!hit) throw new Error('依頼が見つかりません：' + want);
  const line = `${todayYmd()} ${user.name}：${String(text).trim()}`;
  const updated = await sb.update('requests', `id=eq.${encodeURIComponent(want)}`, {
    memo: hit.memo ? `${hit.memo}\n${line}` : line,
    updated_at: new Date().toISOString(),
    updated_by: user.name,
  });
  return { row: rowToCamel(Array.isArray(updated) ? updated[0] : updated) };
}

async function appDealBulk(user, ids, changes) {
  const allow = ['closer', 'apoOwner', 'leadOwner'];
  const ch = {};
  Object.keys(changes || {}).forEach((k) => {
    if (allow.indexOf(k) >= 0) ch[k] = String(changes[k] == null ? '' : changes[k]).trim();
  });
  if (!Object.keys(ch).length) throw new Error('まとめて直せるのは 商談者・アポ獲得者・リード獲得者 だけです');
  const list = (Array.isArray(ids) ? ids : [])
    .map((x) => String(x == null ? '' : x).trim())
    .filter((x, i, a) => x && a.indexOf(x) === i);
  if (!list.length) throw new Error('商談を選んでください');
  if (list.length > 300) throw new Error('一度に直せるのは300件までです');
  const rows = [];
  for (const id of list) {
    const r = await appSave(user, 'deal', id, ch);
    if (r && r.row) rows.push(r.row);
  }
  return { rows, n: rows.length };
}

async function appCustBulk(user, names, changes) {
  const allow = ['cs', 'sales'];
  const ch = {};
  Object.keys(changes || {}).forEach((k) => {
    if (allow.indexOf(k) >= 0) ch[k] = String(changes[k] == null ? '' : changes[k]).trim();
  });
  if (!Object.keys(ch).length) throw new Error('まとめて直せるのは CS担当・担当営業 だけです');
  const list = (Array.isArray(names) ? names : [])
    .map((x) => String(x == null ? '' : x).trim())
    .filter((x, i, a) => x && a.indexOf(x) === i);
  if (!list.length) throw new Error('顧客を選んでください');
  if (list.length > 300) throw new Error('一度に直せるのは300件までです');
  const rows = [];
  for (const name of list) {
    const r = await appSave(user, 'cust', name, ch);
    if (r && r.row) rows.push(r.row);
  }
  return { rows, n: rows.length };
}

async function appReqCost(user, id, vals) {
  const want = String(id || '').trim();
  if (!want) throw new Error('どの依頼かが分かりません');
  const rows = await sb.select('requests', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const hit = Array.isArray(rows) ? rows[0] : null;
  if (!hit) throw new Error('依頼が見つかりません：' + want);
  const patch = { updated_at: new Date().toISOString(), updated_by: user.name };
  [['actUsd', 'act_usd'], ['actEl', 'act_el']].forEach(([camel, snake]) => {
    if (!vals || vals[camel] === undefined) return;
    const s = String(vals[camel] == null ? '' : vals[camel]).replace(/[$,\s]/g, '');
    if (s !== '' && Number.isNaN(Number(s))) throw new Error('実績は数字で入れてください：' + vals[camel]);
    patch[snake] = s === '' ? null : Number(s);
  });
  const updated = await sb.update('requests', `id=eq.${encodeURIComponent(want)}`, patch);
  return { row: rowToCamel(Array.isArray(updated) ? updated[0] : updated) };
}

async function appMonthCounts(_user, day) {
  const dayStr = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : todayYmd();
  const [dy, dm] = dayStr.split('-').map(Number);
  let custs = [];
  let reqs = [];
  try {
    custs = rowsToCamel(await sb.select('customers', 'select=*&limit=5000'));
  } catch {
    custs = [];
  }
  try {
    reqs = rowsToCamel(await sb.select('requests', 'select=*&limit=5000'));
  } catch {
    reqs = [];
  }

  const rows = custs
    .filter((c) => c.name && c.state !== '終了' && c.kind !== 'トライアル')
    .map((c) => {
      let recv = 0;
      let done = 0;
      let recvAuto = 0;
      let doneAuto = 0;
      reqs.forEach((r) => {
        if (r.cust !== c.name || r.status === '取消' || !r.received) return;
        const auto = String(r.make || '') === '自動編集';
        if (auto) {
          recvAuto++;
          if (r.status === '納品済み') doneAuto++;
        } else {
          recv++;
          if (r.status === '納品済み') done++;
        }
      });
      const plan = c.plan == null ? '' : String(c.plan);
      const left = plan === '' || plan === '無制限' ? plan || '' : Number(plan) - recv;
      return {
        name: c.name,
        state: c.state || '契約中',
        kind: c.kind || '',
        plan,
        period: '',
        recv,
        done,
        left,
        auto: c.auto || '',
        recvAuto,
        doneAuto,
        leftAuto: '',
        end: c.end || '',
        deadline: '',
        days: c.end ? Math.round((new Date(c.end) - new Date(dy, dm - 1, Number(dayStr.slice(8)))) / 86400000) : '',
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(dy, dm - 1 - i, 1);
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  const box = {};
  months.forEach((m) => {
    box[m] = { month: m, avatar: 0, auto: 0, done: 0 };
  });
  reqs.forEach((r) => {
    if (!r.id || /^テスト/.test(String(r.cust || '')) || r.status === '取消') return;
    if (r.received) {
      const m = String(r.received).slice(0, 7);
      if (box[m]) {
        if (String(r.make || '') === '自動編集') box[m].auto++;
        else box[m].avatar++;
      }
    }
    if (r.status === '納品済み' && r.delivered) {
      const m = String(r.delivered).slice(0, 7);
      if (box[m]) box[m].done++;
    }
  });

  return { day: dayStr, rows, trend: months.map((m) => box[m]) };
}

async function appGoals(user, ym) {
  const month = String(ym || ymNow()).trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('月は 2026-11 の形で');
  const { from, to, y, m } = monthBounds(month);
  const NONE = '（リード元なし）';
  const sources = BOOT_LISTS.経路 || [];

  let deals = [];
  let custs = [];
  let camps = [];
  try {
    deals = rowsToCamel(await sb.select('deals', 'select=*&limit=5000'));
  } catch {
    deals = [];
  }
  try {
    custs = rowsToCamel(await sb.select('customers', 'select=*&limit=5000'));
  } catch {
    custs = [];
  }
  try {
    camps = rowsToCamel(await sb.select('campaigns', 'select=id,name,date,kind&limit=5000'));
  } catch {
    camps = [];
  }

  const targets = await loadKpiTargets(month);
  const persons = [...new Set(targets.map((t) => t.person).filter(Boolean))];
  const owner = persons.indexOf(user.name) >= 0 ? user.name : persons[0] || user.name;
  const mine = targets.filter((t) => t.person === owner);
  const own = mine.find((t) => !t.route) || null;
  const routeT = mine.filter((t) => t.route);

  const sitOk = (d) => {
    const c = BOOT_CATS[String(d.result || '').trim()] || '';
    return c !== '未着座' && c !== 'リスケ';
  };
  const validOk = (d) => sitOk(d) && (BOOT_CATS[String(d.result || '').trim()] || '') !== '無効';

  const apos = deals.filter((d) => inRange(d.meetPlan || d.apoDate, from, to));
  const sits = deals.filter((d) => inRange(d.meetDate, from, to) && sitOk(d));
  const valids = sits.filter(validOk);
  const contracts = custs
    .filter((c) => inRange(c.contract, from, to))
    .map((c) => {
      const deal = deals.find((d) => d.customer === c.name || d.id === c.deal) || null;
      const init = Number(c.init) || 0;
      const fee = Number(c.fee) || 0;
      return {
        name: c.name,
        date: c.contract,
        route: (deal && deal.source) || c.source || '',
        from: c.source || '',
        deal: (deal && deal.id) || c.deal || '',
        init,
        fee,
        amount: init + fee * 3,
      };
    });
  const amount = contracts.reduce((s, x) => s + x.amount, 0);
  const sems = camps.filter((c) => inRange(c.date, from, to) && String(c.kind || '') === 'セミナー');

  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '' : Number(v));
  const sumOf = (k) =>
    routeT.reduce((s, t) => {
      const col = k === 'won' ? 'contract_count' : k === 'amount' ? 'amount' : k;
      const v = num(t[col] != null ? t[col] : t[k]);
      return v === '' ? s : (s === '' ? 0 : s) + v;
    }, '');
  const topMetric = (actual, k) => {
    const map = { apo: 'apo', sit: 'seat', won: 'contract_count', amount: 'amount', seminar: 'seminar', valid: 'valid_deal' };
    const set = own ? num(own[map[k]] != null ? own[map[k]] : own[k]) : '';
    const sum = k === 'sit' || k === 'seminar' || k === 'valid' ? '' : sumOf(k);
    const target = set !== '' ? set : sum;
    return metric(actual, target);
  };

  const byRoute = {};
  const routes = [];
  const rowOf = (r) => {
    if (!byRoute[r]) {
      byRoute[r] = {
        route: r,
        known: r !== NONE && sources.indexOf(r) >= 0,
        note: '',
        hasTarget: false,
        target: { apo: '', rate: '', won: '', amount: '' },
        actual: { apo: 0, sit: 0, valid: 0, won: 0, amount: 0 },
      };
      routes.push(byRoute[r]);
    }
    return byRoute[r];
  };
  routeT.forEach((t) => {
    const r = rowOf(t.route);
    r.hasTarget = true;
    const apo = num(t.apo);
    const won = num(t.contract_count != null ? t.contract_count : t.won);
    const amt = num(t.amount);
    if (apo !== '') r.target.apo = (r.target.apo === '' ? 0 : r.target.apo) + apo;
    if (won !== '') r.target.won = (r.target.won === '' ? 0 : r.target.won) + won;
    if (amt !== '') r.target.amount = (r.target.amount === '' ? 0 : r.target.amount) + amt;
  });
  apos.forEach((d) => {
    rowOf(d.source || NONE).actual.apo++;
  });
  sits.forEach((d) => {
    rowOf(d.source || NONE).actual.sit++;
  });
  valids.forEach((d) => {
    rowOf(d.source || NONE).actual.valid++;
  });
  contracts.forEach((x) => {
    const r = rowOf(x.route || NONE);
    r.actual.won++;
    r.actual.amount += x.amount;
  });

  let holidays = [];
  try {
    holidays = await sb.select('holidays', 'select=day&limit=5000');
  } catch {
    holidays = [];
  }
  const off = {};
  (Array.isArray(holidays) ? holidays : []).forEach((h) => {
    if (h.day) off[String(h.day).slice(0, 10)] = true;
  });
  const biz = [];
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (d.getDay() !== 0 && d.getDay() !== 6 && !off[k]) biz.push(k);
  }
  const today = todayYmd();
  const passed = biz.filter((k) => k <= today).length;
  const pace = { today, total: biz.length, passed, ratio: biz.length ? passed / biz.length : 0 };

  return {
    month,
    from,
    to,
    months: 3,
    owner,
    persons: persons.length ? persons : [user.name],
    kgi: { won: topMetric(contracts.length, 'won'), amount: topMetric(amount, 'amount') },
    kpi: {
      apo: topMetric(apos.length, 'apo'),
      sit: topMetric(sits.length, 'sit'),
      valid: topMetric(valids.length, 'valid'),
      seminar: topMetric(sems.length, 'seminar'),
      sitRate: apos.length ? sits.length / apos.length : '',
      winRate: apos.length ? contracts.length / apos.length : '',
      validRate: sits.length ? valids.length / sits.length : '',
    },
    pace,
    routes,
    weeks: [],
    contracts,
    meta: { backend: 'supabase' },
  };
}

async function appGoalSave(user, ym, person, target) {
  const month = String(ym || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('月は 2026-11 の形で');
  const who = String(person || '').trim();
  if (!who) throw new Error('担当を選んでください');
  if (who !== user.name && !user.admin) throw new Error('ほかの人の目標は「管理」の人だけが直せます');
  const t = target || {};
  const num = (k, label) => {
    const v = t[k];
    if (v === undefined) return undefined;
    const s = String(v == null ? '' : v).replace(/[,円\s]/g, '').trim();
    if (s === '') return null;
    if (Number.isNaN(Number(s)) || Number(s) < 0) throw new Error('「' + label + '」は0以上の数字で入れてください：' + v);
    return Number(s);
  };
  const vals = {
    apo: num('apo', 'アポの目標'),
    seat: num('sit', '着座の目標'),
    contract_count: num('won', '契約の目標'),
    amount: num('amount', '金額の目標'),
    seminar: num('seminar', 'セミナー開催の目標'),
    valid_deal: num('valid', '有効商談の目標'),
  };
  const existing = await sb.select(
    'kpi_targets',
    `ym=eq.${encodeURIComponent(month)}&person=eq.${encodeURIComponent(who)}&route=eq.&select=id&limit=1`
  );
  const hit = Array.isArray(existing) ? existing[0] : null;
  const patch = { ym: month, person: who, route: '' };
  Object.keys(vals).forEach((k) => {
    if (vals[k] !== undefined) patch[k] = vals[k];
  });
  if (hit) {
    await sb.update('kpi_targets', `id=eq.${hit.id}`, patch);
  } else {
    await sb.insert('kpi_targets', [patch]);
  }
  return { ok: true };
}

async function appKpiTargets(user, ym, person, rows) {
  const month = String(ym || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('月は 2026-11 の形で');
  const who = String(person || '').trim();
  if (!who) throw new Error('担当を選んでから目標を入れてください');
  if (who !== user.name && !user.admin) throw new Error('ほかの人の目標は「管理」の人だけが直せます');

  const existing = await sb.select(
    'kpi_targets',
    `ym=eq.${encodeURIComponent(month)}&person=eq.${encodeURIComponent(who)}&select=*&limit=500`
  );
  const all = Array.isArray(existing) ? existing : [];
  const keepRows = all.filter((r) => !String(r.route || '').trim());
  const oldRoutes = all.filter((r) => String(r.route || '').trim());
  for (const r of oldRoutes) {
    await sb.del('kpi_targets', `id=eq.${r.id}`);
  }

  const add = (rows || [])
    .filter((r) => String(r.route || '').trim())
    .map((r) => ({
      ym: month,
      person: who,
      route: String(r.route).trim(),
      apo: r.apo === '' || r.apo == null ? null : Number(r.apo),
      contract_count: r.won === '' || r.won == null ? null : Number(r.won),
      amount: r.amount === '' || r.amount == null ? null : Number(r.amount),
    }));
  if (add.length) await sb.insert('kpi_targets', add);
  return { saved: add.length, kept: keepRows.length };
}

async function appSettings(user) {
  if (!user.admin) throw new Error('設定は管理の人だけが開けます');
  const users = await sb.select('app_users', 'select=name,roles,active&order=name.asc&limit=500');
  let holidays = [];
  try {
    holidays = await sb.select('holidays', 'select=day&limit=5000');
  } catch {
    holidays = [];
  }
  let rules = [];
  try {
    rules = await sb.select('payment_rules', 'select=*&limit=100');
  } catch {
    rules = [];
  }
  return {
    users: (Array.isArray(users) ? users : []).map((u) => ({
      name: u.name,
      roles: Array.isArray(u.roles) ? u.roles : [],
      active: !!u.active,
    })),
    services: (BOOT_LISTS.サービス || []).map((s) => [s, true]),
    sources: BOOT_LISTS.経路 || [],
    results: Object.keys(BOOT_CATS).map((name) => ({ name, cat: BOOT_CATS[name] })),
    rules: Array.isArray(rules) ? rules : [],
    ruleHeaders: [],
    cats: ['見込み', '受注', '失注', '無効', '協業'],
    roles: ['管理', 'FS', '制作'],
    url: '',
    prices: [],
    costs: [],
    sales: [],
    company: [],
    holidays: Array.isArray(holidays) ? holidays.length : 0,
    meta: { backend: 'supabase' },
  };
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
      return appHome(user, rest[0]);
    case 'appSave':
      return appSave(user, rest[0], rest[1], rest[2]);
    case 'appDelete':
      return appDelete(user, rest[0], rest[1]);
    case 'appDealMove':
      return appDealMove(user, rest[0], rest[1], rest[2]);
    case 'appDealBulk':
      return appDealBulk(user, rest[0], rest[1]);
    case 'appCustBulk':
      return appCustBulk(user, rest[0], rest[1]);
    case 'appTasks':
      return appTasks(user);
    case 'appTaskSave':
      return appTaskSave(user, rest[0], rest[1]);
    case 'appTaskDone':
      return appTaskDone(user, rest[0], rest[1]);
    case 'appTaskDelete':
      return appTaskDelete(user, rest[0]);
    case 'appPayments':
      return appPayments(user, rest[0], rest[1]);
    case 'appPayEdit':
      return appPayEdit(user, rest[0]);
    case 'appPayConfirm':
      return appPayConfirm(user, rest[0]);
    case 'appPayAdd':
      return appPayAdd(user, rest[0]);
    case 'appPayDelete':
      return appPayDelete(user, rest[0]);
    case 'appReqStatus':
      return appReqStatus(user, rest[0], rest[1], rest[2]);
    case 'appReqMemo':
      return appReqMemo(user, rest[0], rest[1]);
    case 'appReqCost':
      return appReqCost(user, rest[0], rest[1]);
    case 'appMonthCounts':
      return appMonthCounts(user, rest[0]);
    case 'appGoals':
      return appGoals(user, rest[0]);
    case 'appGoalSave':
      return appGoalSave(user, rest[0], rest[1], rest[2]);
    case 'appKpiTargets':
      return appKpiTargets(user, rest[0], rest[1], rest[2]);
    case 'appSettings':
      return appSettings(user);
    default:
      return null;
  }
}

module.exports = { dispatchSupabase, authByPassphrase, sha256Hex };
