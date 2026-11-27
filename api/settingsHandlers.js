/**
 * Settings / people / cards / history helpers for Supabase preview path.
 */

const crypto = require('crypto');
const sb = require('./supabaseClient');
const { rowToCamel, rowsToCamel } = require('./fieldMap');

const ROLES = ['管理', 'FS', '制作'];
const CATS = ['見込み', '受注', '失注', '無効', '協業'];

async function safeSelect(table, query) {
  try {
    const rows = await sb.select(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function logHistory(actor, action, target, items) {
  try {
    await sb.insert('history_logs', [
      {
        actor: actor || '',
        action: action || '',
        target: String(target || ''),
        items: items || [],
      },
    ]);
  } catch {
    /* preview: history write is best-effort */
  }
}

async function getSetting(key, fallback) {
  const rows = await safeSelect('app_settings', `key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  if (rows[0] && rows[0].value != null) return rows[0].value;
  return fallback;
}

async function putSetting(key, value, userName) {
  const existing = await safeSelect('app_settings', `key=eq.${encodeURIComponent(key)}&select=key&limit=1`);
  const patch = {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: userName || '',
  };
  if (existing[0]) await sb.update('app_settings', `key=eq.${encodeURIComponent(key)}`, patch);
  else await sb.insert('app_settings', [patch]);
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function randomPassphrase() {
  return 'avatifi-' + crypto.randomBytes(16).toString('hex');
}

async function nextId(table, prefix, digits) {
  const rows = await safeSelect(table, 'select=id&limit=5000');
  const n = rows.length + 1;
  return prefix + String(n).padStart(digits, '0');
}

async function appHistory(_user, target) {
  const want = String(target || '').trim();
  if (!want) return [];
  const rows = await safeSelect(
    'history_logs',
    `or=(target.eq.${encodeURIComponent(want)},target.like.${encodeURIComponent(want + '*')})&select=*&order=created_at.desc&limit=100`
  );
  // PostgREST like may need * → % ; fallback filter in JS if empty
  let list = rows;
  if (!list.length) {
    const all = await safeSelect('history_logs', 'select=*&order=created_at.desc&limit=500');
    list = all.filter((r) => String(r.target || '') === want || String(r.target || '').indexOf(want) === 0);
  }
  return list.slice(0, 100).map((r) => ({
    at: r.created_at || '',
    who: r.actor || '',
    what: r.action || '',
    target: r.target || '',
    label: Array.isArray(r.items) && r.items[0] ? r.items[0].label || '' : '',
    before: Array.isArray(r.items) && r.items[0] ? r.items[0].before || '' : '',
    after: Array.isArray(r.items) && r.items[0] ? r.items[0].after || '' : '',
  }));
}

async function appAddPerson(user, name, roles) {
  const n = String(name || '')
    .replace(/[\s　]+/g, '')
    .trim();
  if (!n) throw new Error('名前を入れてください');
  if (n.length > 20) throw new Error('名前は20文字までにしてください');
  if (/[,、・/／]/.test(n)) throw new Error('名前に「・」「、」などの区切りは使えません');
  const existing = await safeSelect('app_users', `name=eq.${encodeURIComponent(n)}&select=id&limit=1`);
  if (existing[0]) throw new Error('「' + n + '」はもう一覧にいます');
  const rs = (Array.isArray(roles) ? roles : String(roles || '').split(/[・,、\s]+/))
    .map((x) => String(x).trim())
    .filter((x, i, a) => x && x !== '管理' && ROLES.indexOf(x) >= 0 && a.indexOf(x) === i);
  await sb.insert('app_users', [
    {
      name: n,
      roles: rs,
      active: false,
      passphrase_hash: null,
    },
  ]);
  await logHistory(user.name, '人を足した', n, [{ label: '役割', before: '', after: rs.join('・') || '（なし）' }]);
  return { name: n, roles: rs, active: false };
}

async function appUserKey(user, name) {
  if (!user.admin) throw new Error('設定は管理の人だけが開けます');
  const who = String(name || '').trim();
  const rows = await safeSelect(
    'app_users',
    `name=eq.${encodeURIComponent(who)}&active=eq.true&select=id,name&limit=1`
  );
  if (!rows[0]) throw new Error(who + 'さんは「使える」になっていません');
  const passphrase = randomPassphrase();
  await sb.update('app_users', `id=eq.${rows[0].id}`, {
    passphrase_hash: sha256Hex(passphrase),
    key_issued_at: new Date().toISOString(),
  });
  await logHistory(user.name, '専用リンクを作り直した', who, []);
  const base = process.env.CRM_PUBLIC_URL || 'https://avatifi.vercel.app/';
  return { name: who, link: base.replace(/\/?$/, '/') + '#k=' + passphrase, key: '' };
}

async function appPeopleToDeal(user, id, appSave) {
  const want = String(id || '').trim();
  const rows = await safeSelect('people', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const p = rows[0] ? rowToCamel(rows[0]) : null;
  if (!p) throw new Error('参加者「' + id + '」が見つかりません（一覧を読み直してください）');
  if (p.deal) throw new Error('もう商談になっています（' + p.deal + '）');
  let camp = null;
  if (p.camp) {
    const camps = await safeSelect('campaigns', `id=eq.${encodeURIComponent(p.camp)}&select=*&limit=1`);
    camp = camps[0] ? rowToCamel(camps[0]) : null;
  }
  if (!camp && p.campName) {
    const camps = await safeSelect('campaigns', `name=eq.${encodeURIComponent(p.campName)}&select=*&limit=1`);
    camp = camps[0] ? rowToCamel(camps[0]) : null;
  }
  if (!camp) throw new Error('この人のセミナー・交流会（' + (p.campName || p.camp) + '）が見つかりません');
  const today = todayYmd();
  const kind = String(camp.kind || '');
  const source = kind.indexOf('セミナー') >= 0 ? 'セミナー' : kind.indexOf('交流') >= 0 ? '交流会' : '施策';
  const r = await appSave(user, 'deal', '', {
    name: p.name,
    company: p.company,
    title: p.title,
    business: p.business,
    background: p.background,
    source,
    sourceDetail: camp.name,
    leadDate: camp.date || today,
    apoDate: today,
    apoOwner: user.name,
    leadOwner: p.staff || user.name,
    stage: 'アポ',
  });
  const dealId = r && r.row ? r.row.id : '';
  const updated = await sb.update('people', `id=eq.${encodeURIComponent(want)}`, {
    deal: dealId,
    updated_at: new Date().toISOString(),
    updated_by: user.name,
  });
  await logHistory(user.name, '参加者を商談にした', p.id + ' ' + p.name, [
    { label: '商談ID', before: '', after: dealId },
  ]);
  return {
    deal: r.row,
    person: rowToCamel(Array.isArray(updated) ? updated[0] : updated) || p,
    notes: (r && r.notes) || [],
  };
}

async function appCardToDeal(user, id, appSave) {
  const want = String(id || '').trim();
  const rows = await safeSelect('cards', `id=eq.${encodeURIComponent(want)}&select=*&limit=1`);
  const c = rows[0] ? rowToCamel(rows[0]) : null;
  if (!c) throw new Error('名刺「' + id + '」が見つかりません（一覧を読み直してください）');
  if (c.deal) throw new Error('もう商談になっています（' + c.deal + '）');
  if (!String(c.name || '').trim()) throw new Error('お名前が空です。名刺リストでお名前を入れてから、商談にしてください');
  const today = todayYmd();
  let camp = null;
  if (c.place) {
    const camps = await safeSelect('campaigns', `name=eq.${encodeURIComponent(c.place)}&select=*&limit=1`);
    camp = camps[0] ? rowToCamel(camps[0]) : null;
  }
  const memo = [
    c.phone ? '電話：' + c.phone : '',
    c.address ? '住所：' + c.address : '',
    c.url ? 'ホームページ：' + c.url : '',
    c.place ? '名刺を交換した場所：' + c.place : '',
    c.memo || '',
  ]
    .filter((x) => x)
    .join('\n');
  const r = await appSave(user, 'deal', '', {
    name: c.name,
    company: c.company,
    title: c.title,
    email: c.email,
    source: camp ? (String(camp.kind || '').indexOf('交流') >= 0 ? '交流会' : 'セミナー') : '',
    sourceDetail: camp ? camp.name : c.place || '',
    leadDate: c.date || today,
    leadOwner: c.owner || user.name,
    apoDate: today,
    apoOwner: user.name,
    memo,
    stage: 'アポ',
  });
  const dealId = r && r.row ? r.row.id : '';
  const updated = await sb.update('cards', `id=eq.${encodeURIComponent(want)}`, {
    deal: dealId,
    updated_at: new Date().toISOString(),
    updated_by: user.name,
  });
  await logHistory(user.name, '名刺を商談にした', c.id + ' ' + c.name, [
    { label: '商談ID', before: '', after: dealId },
  ]);
  const notes = ((r && r.notes) || []).slice();
  if (!camp) notes.push('リード元は空のままです。商談の画面で選んでください');
  return {
    deal: r.row,
    card: rowToCamel(Array.isArray(updated) ? updated[0] : updated) || c,
    notes,
  };
}

async function appCardUpload(user, files, opts) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) throw new Error('名刺の写真を選んでください');
  if (list.length > 10) throw new Error('一度に入れられるのは10枚までです（' + list.length + '枚選ばれています）');
  const o = opts || {};
  const day = String(o.date || todayYmd()).slice(0, 10);
  const place = String(o.place || '').trim();
  const owner = String(o.owner || '').trim() || user.name;
  const rows = [];
  const notes = [];
  for (let i = 0; i < list.length; i++) {
    const id = await nextId('cards', 'N', 5);
    const inserted = await sb.insert('cards', [
      {
        id,
        date: day,
        place,
        owner,
        photo: '',
        ocr: '（プレビュー：Drive OCR未接続。項目は手で入れてください）',
        updated_at: new Date().toISOString(),
        updated_by: user.name,
      },
    ]);
    rows.push(rowToCamel(Array.isArray(inserted) ? inserted[0] : inserted));
    notes.push(i + 1 + '枚目：OCRは未接続です。写真は保存していません（Drive ハイブリッド待ち）。お名前などを手で入れてください');
  }
  await logHistory(user.name, '名刺を入れた', rows.map((r) => r.id).join(','), [{ label: '枚数', before: '', after: rows.length }]);
  return { rows, notes };
}

async function enrichSettings(base) {
  const [sources, services, results, prices, costs, sales, company] = await Promise.all([
    getSetting('sources', base.sources || []),
    getSetting('services', base.services || []),
    getSetting('results', base.results || []),
    getSetting('prices', base.prices || []),
    getSetting('costs', base.costs || []),
    getSetting('sales', base.sales || []),
    getSetting('company', base.company || []),
  ]);
  const holidays = await safeSelect('holidays', 'select=day&limit=5000');
  return Object.assign({}, base, {
    sources: Array.isArray(sources) ? sources : base.sources,
    services: Array.isArray(services) ? services : base.services,
    results: Array.isArray(results) ? results : base.results,
    prices: Array.isArray(prices) ? prices : [],
    costs: Array.isArray(costs) ? costs : [],
    sales: Array.isArray(sales) ? sales : [],
    company: Array.isArray(company) ? company : [],
    holidays: holidays.length || base.holidays || 0,
  });
}

async function appSettingsSave(user, part, rows, appSettings) {
  if (!user.admin) throw new Error('設定は管理の人だけが開けます');
  const clean = (rows || []).filter((r) => String(r[0] == null ? '' : r[0]).trim());

  if (part === 'users') {
    const names = clean.map((r) => String(r[0]).trim());
    const existing = await safeSelect('app_users', 'select=id,name,roles,active,passphrase_hash&limit=500');
    const byName = {};
    existing.forEach((u) => {
      byName[u.name] = u;
    });
    for (const r of clean) {
      const name = String(r[0]).trim();
      const roles = String(r[1] || '')
        .split(/[・,、\s]+/)
        .map((x) => x.trim())
        .filter((x) => ROLES.indexOf(x) >= 0);
      const active = !!r[2];
      const hit = byName[name];
      if (hit) {
        await sb.update('app_users', `id=eq.${hit.id}`, { roles, active });
      } else {
        await sb.insert('app_users', [{ name, roles, active, passphrase_hash: null }]);
      }
    }
    for (const u of existing) {
      if (names.indexOf(u.name) < 0) {
        await sb.update('app_users', `id=eq.${u.id}`, { active: false });
      }
    }
    const after = await safeSelect('app_users', 'select=name,roles,active&limit=500');
    if (!after.some((u) => u.active && Array.isArray(u.roles) && u.roles.indexOf('管理') >= 0)) {
      throw new Error('「管理」の人が1人もいなくなります（自分の役割を確かめてください）');
    }
  } else if (part === 'services') {
    await putSetting(
      'services',
      clean.map((r) => [String(r[0]).trim(), !!r[1]]),
      user.name
    );
  } else if (part === 'sources') {
    await putSetting(
      'sources',
      clean.map((r) => String(r[0]).trim()),
      user.name
    );
  } else if (part === 'results') {
    clean.forEach((r) => {
      if (CATS.indexOf(String(r[1]).trim()) < 0) throw new Error('「' + r[0] + '」の数え方が選べるものではありません：' + r[1]);
    });
    await putSetting(
      'results',
      clean.map((r) => ({ name: String(r[0]).trim(), cat: String(r[1]).trim() })),
      user.name
    );
  } else if (part === 'rules') {
    // Replace payment_rules roughly: clear + insert note/method from first cols
    const old = await safeSelect('payment_rules', 'select=id&limit=500');
    for (const r of old) await sb.del('payment_rules', `id=eq.${r.id}`);
    if (clean.length) {
      await sb.insert(
        'payment_rules',
        clean.map((r) => ({
          method: String(r[0] || '').trim(),
          note: String(r[r.length - 1] || '').trim(),
        }))
      );
    }
  } else if (part === 'prices') {
    clean.forEach((r) => {
      if (String(r[1]).trim() !== '' && Number.isNaN(Number(String(r[1]).replace(/[,円]/g, '')))) {
        throw new Error('「' + r[0] + '」の月額は数字で入れてください');
      }
    });
    await putSetting(
      'prices',
      clean.map((r) => [
        String(r[0]).trim(),
        String(r[1]).trim() === '' ? '' : Number(String(r[1]).replace(/[,円]/g, '')),
      ]),
      user.name
    );
  } else if (part === 'costs') {
    await putSetting(
      'costs',
      (rows || []).map((r) => [String(r[0] == null ? '' : r[0]), r[1] === '' || r[1] == null ? '' : Number(r[1])]),
      user.name
    );
  } else if (part === 'sales') {
    await putSetting(
      'sales',
      clean.map((r) => ({ name: String(r[0]).trim(), link: String(r[1] || '') })),
      user.name
    );
  } else if (part === 'holidays') {
    const days = clean.map((r) => String(r[0]).trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (days.length !== clean.length) throw new Error('会社の休みは日付（2026-12-29 の形）で入れてください');
    await putSetting('company', days, user.name);
    for (const d of days) {
      const hit = await safeSelect('holidays', `day=eq.${d}&select=day&limit=1`);
      if (!hit[0]) await sb.insert('holidays', [{ day: d }]);
    }
  } else {
    throw new Error('知らない設定です：' + part);
  }

  await logHistory(user.name, '設定を直した', part, [{ label: '行の数', before: '', after: clean.length }]);
  const base = await appSettings(user);
  return enrichSettings(base);
}

async function appImportHolidays(user, appSettings) {
  if (!user.admin) throw new Error('設定は管理の人だけが開けます');
  const url = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    throw new Error('祝日CSVを取得できませんでした（タイムアウトまたは不通）：' + (e && e.message ? e.message : e));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('祝日CSVを取得できませんでした：' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  let text = '';
  try {
    text = new TextDecoder('shift-jis').decode(buf);
  } catch {
    text = buf.toString('utf8');
  }
  const days = [...text.matchAll(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g)].map((m) => {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  });
  const uniq = [...new Set(days)];
  const existing = await safeSelect('holidays', 'select=day&limit=5000');
  const have = new Set(existing.map((r) => r.day));
  const missing = uniq.filter((d) => !have.has(d)).map((day) => ({ day }));
  // Batch insert to avoid hundreds of REST round-trips (Vercel timeout).
  // Prefer ignore-duplicates so a partial prior import / race does not 409.
  const CHUNK = 100;
  for (let i = 0; i < missing.length; i += CHUNK) {
    await sb.rest('holidays', {
      method: 'POST',
      query: 'on_conflict=day',
      body: missing.slice(i, i + CHUNK),
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
  }
  await logHistory(user.name, '祝日を取り込んだ', '設定', [
    { label: '件数', before: String(have.size), after: String(have.size + missing.length) },
  ]);
  const base = await appSettings(user);
  return enrichSettings(base);
}

async function appFormAnswers(_user, limit) {
  const n = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  return {
    reqs: [],
    recs: [],
    tabs: [],
    total: 0,
    unmatched: 0,
    meta: {
      backend: 'supabase',
      note: 'フォーム回答は Sheets/Forms ハイブリッド待ち（空のプレビュー）',
      limit: n,
    },
  };
}

async function appMakeFormLinks() {
  throw new Error('依頼フォームは未接続です（Google Forms アクセス待ち）。専用リンクは Forms 接続後に作れます');
}

async function appImportPreview() {
  throw new Error('台帳インポートは未接続です（スプレッドシート書き出し待ち）');
}

async function appImportRun() {
  throw new Error('台帳インポートは未接続です（スプレッドシート書き出し待ち）');
}

module.exports = {
  appHistory,
  appAddPerson,
  appUserKey,
  appPeopleToDeal,
  appCardToDeal,
  appCardUpload,
  appSettingsSave,
  appImportHolidays,
  appFormAnswers,
  appMakeFormLinks,
  appImportPreview,
  appImportRun,
  enrichSettings,
  logHistory,
  getSetting,
  ROLES,
  CATS,
};
