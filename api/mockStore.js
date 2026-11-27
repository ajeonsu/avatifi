/**
 * In-memory CRM sample for CRM_MOCK=1 (local only).
 * Return shapes match 営業.gs app* (arrays/objects), not wrapped envelopes.
 * Envelope { ok, crm:1, value } is applied in api/crm.js.
 */

const STAGES = ['リード', 'アポ', '着座', '見込み', '受注', '失注', '対象外'];

const ENTITIES = {
  deal: { idKey: 'id', idPrefix: 'S', storeKey: 'deals' },
  camp: { idKey: 'id', idPrefix: 'E', storeKey: 'camp' },
  agency: { idKey: 'name', storeKey: 'agency' },
  cust: { idKey: 'name', storeKey: 'cust' },
  people: { idKey: 'id', idPrefix: 'P', storeKey: 'people' },
  card: { idKey: 'id', idPrefix: 'N', storeKey: 'card' },
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymNow() {
  return todayYmd().slice(0, 7);
}

const store = {
  deals: [
    {
      id: 'S00001',
      leadDate: '2026-11-01',
      name: '山田 太郎',
      company: '見本商事',
      industry: '小売',
      channel: 'メール',
      email: 'demo@example.com',
      source: '紹介',
      sourceDetail: '',
      leadOwner: '見本ユーザー',
      apoOwner: '見本ユーザー',
      apoDate: '2026-11-05',
      closer: '見本ユーザー',
      meetPlan: '2026-11-12',
      meetDate: '',
      result: '',
      stage: 'アポ',
      amount: '',
    },
    {
      id: 'S00002',
      leadDate: '2026-10-15',
      name: '佐藤 花子',
      company: 'サンプル美容院',
      industry: '美容',
      channel: 'LINE',
      email: '',
      source: '施策',
      sourceDetail: '見本セミナー',
      leadOwner: '見本ユーザー',
      apoOwner: '見本ユーザー',
      apoDate: '2026-10-20',
      closer: '見本ユーザー',
      meetPlan: '2026-10-25',
      meetDate: '2026-10-25',
      result: '見込みB',
      stage: '見込み',
    },
  ],
  cust: [
    {
      name: '見本商事',
      company: '見本商事',
      service: 'アバター',
      state: '契約中',
      production: true,
      sales: '見本ユーザー',
    },
    {
      name: 'サンプル美容院',
      company: 'サンプル美容院',
      service: '自動編集',
      state: '契約中',
      production: true,
      sales: '見本ユーザー',
    },
  ],
  req: [
    {
      id: '見本商事-001',
      received: '2026-11-10',
      cust: '見本商事',
      type: '⑦ お知らせ・告知型',
      theme: '秋の告知',
      status: '制作中',
      waiting: '制作',
      make: 'アバター',
    },
  ],
  camp: [
    {
      id: 'E0001',
      name: '見本セミナー',
      kind: 'セミナー',
      date: '2026-10-01',
      state: '開催済み',
    },
  ],
  agency: [{ name: '見本代理店', state: '契約中', kind: '紹介' }],
  people: [],
  card: [],
  payments: [
    {
      key: '見本商事|初期|1',
      customer: '見本商事',
      kind: '初期',
      n: 1,
      date: '2026-11-30',
      amount: 120000,
      method: 'マネフォ',
      ok: false,
    },
  ],
  tasksManual: [
    {
      id: 'T00001',
      title: '見本フォロー',
      person: '見本ユーザー',
      due: '2026-11-28',
      memo: '',
      done: '',
      auto: false,
    },
  ],
};

const USER = {
  name: '見本ユーザー',
  roles: ['管理', 'FS'],
  admin: true,
  prodOnly: false,
  active: true,
};

function auth(passphrase) {
  const k = String(passphrase || '').trim();
  if (!k) throw new Error('合言葉がありません');
  // Local mock: any non-empty key (GAS requires ≥20 chars — enforce for UI realism)
  if (k.length < 20) throw new Error('合言葉がありません。青柳さんから届いた専用のリンクから開いてください');
  return USER;
}

function appBoot(user) {
  return {
    user: {
      name: user.name,
      roles: user.roles,
      admin: user.admin,
      prodOnly: user.prodOnly,
    },
    lists: {
      連絡手段: ['メール', 'LINE', '電話'],
      経路: ['紹介', '施策', '名刺', 'その他'],
      サービス: ['アバター', '自動編集'],
      商談結果: ['見込みA', '見込みB', '見込みC', '申込書送付(受注)', '失注', '商談対象外（無効商談）'],
    },
    stages: STAGES,
    cats: {
      見込みA: '見込み',
      見込みB: '見込み',
      見込みC: '見込み',
      '申込書送付(受注)': '受注',
      失注: '失注',
      '商談対象外（無効商談）': '無効',
    },
    fields: {
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
    },
    today: todayYmd(),
    formLink: '',
    ledgerUrl: '',
    options: { kpiMonths: 3, recordStart: '2026-01', idleWarn: 30, idleLate: 60 },
  };
}

function appList(_user, entity) {
  const e = String(entity || '').trim();
  const map = {
    deal: store.deals,
    cust: store.cust,
    req: store.req,
    camp: store.camp,
    agency: store.agency,
    people: store.people,
    card: store.card,
  };
  if (!(e in map)) throw new Error('知らない一覧です：' + e);
  return map[e].map((row) => Object.assign({}, row));
}

function appHome(user) {
  const byStage = STAGES.map((s) => ({
    stage: s,
    n: store.deals.filter((d) => d.stage === s).length,
  }));
  return {
    lists: {
      dealsByStage: byStage,
      openTasks: store.tasksManual.filter((t) => !t.done).length,
      openReqs: store.req.length,
      me: user.name,
    },
    kpi: { total: { apo: 1, won: 0, amount: 0 }, month: ymNow() },
  };
}

function appPayments() {
  return {
    rows: store.payments.map((p) => Object.assign({}, p)),
    summary: { count: store.payments.length, amount: store.payments.reduce((a, p) => a + Number(p.amount || 0), 0) },
    rules: [{ method: 'マネフォ', note: '1〜15日決済→当月末' }],
  };
}

function appTasks(user) {
  return {
    me: user.name,
    today: todayYmd(),
    auto: [],
    manual: store.tasksManual.map((t) => Object.assign({}, t, { person: t.person || '（担当なし）', auto: false })),
  };
}

function appSave(_user, entity, id, changes) {
  const meta = ENTITIES[entity];
  if (!meta || !store[meta.storeKey]) throw new Error('保存できない表です：' + entity);
  const key = meta.idKey;
  const list = store[meta.storeKey];
  const want = String(id == null ? '' : id).trim();
  let row = want ? list.find((r) => String(r[key]) === want) : null;
  const notes = [];
  if (!row) {
    row = Object.assign({}, changes || {});
    if (meta.idPrefix && !row.id) {
      const n = list.length + 1;
      row.id = meta.idPrefix + String(n).padStart(meta.idPrefix === 'E' ? 4 : 5, '0');
    }
    if (key === 'name' && !row.name) throw new Error('名前がありません');
    if (entity === 'deal' && !row.stage) row.stage = 'リード';
    list.push(row);
    notes.push('新規（mock）');
  } else {
    Object.assign(row, changes || {});
    notes.push('更新（mock）');
  }
  return { row: Object.assign({}, row), notes };
}

function appDelete(_user, entity, id) {
  const meta = ENTITIES[entity];
  if (!meta || !store[meta.storeKey]) throw new Error('消せない表です：' + entity);
  const want = String(id == null ? '' : id).trim();
  if (!want) throw new Error('どれを消すかが分かりません');
  const before = store[meta.storeKey].length;
  store[meta.storeKey] = store[meta.storeKey].filter((r) => String(r[meta.idKey]) !== want);
  if (store[meta.storeKey].length === before) throw new Error('見つかりません：' + want);
  return { notes: ['削除（mock）'] };
}

function appDealMove(user, id, stage, extra) {
  const d = store.deals.find((r) => String(r.id) === String(id));
  if (!d) throw new Error('商談「' + id + '」が見つかりません');
  if (STAGES.indexOf(stage) < 0 && stage !== '結果待ち' && stage !== '失注・対象外') {
    throw new Error('知らない段階です：' + stage);
  }
  const ch = { stage: stage === '結果待ち' ? '着座' : stage === '失注・対象外' ? '失注' : stage };
  if (extra && typeof extra === 'object') Object.assign(ch, extra);
  return appSave(user, 'deal', id, ch);
}

/**
 * @param {string} fn
 * @param {unknown[]} args — includes passphrase at [0]
 */
function dispatchMock(fn, args) {
  const user = auth(args[0]);
  const rest = args.slice(1);
  switch (fn) {
    case 'appBoot':
      return appBoot(user);
    case 'appList':
      return appList(user, rest[0]);
    case 'appHome':
      return appHome(user);
    case 'appPayments':
      return appPayments();
    case 'appTasks':
      return appTasks(user);
    case 'appSave':
      return appSave(user, rest[0], rest[1], rest[2]);
    case 'appDelete':
      return appDelete(user, rest[0], rest[1]);
    case 'appDealMove':
      return appDealMove(user, rest[0], rest[1], rest[2]);
    default:
      throw Object.assign(new Error(`${fn} not in CRM_MOCK allowlist yet`), { status: 501 });
  }
}

module.exports = { dispatchMock, store, STAGES };
