/**
 * Supabase-backed analytics / money views (simplified GAS parity for preview).
 * Shapes match Vue expectations in public/index.html.
 */

const BOOT_CATS = {
  見込みA: '見込み',
  見込みB: '見込み',
  見込みC: '見込み',
  '申込書送付(受注)': '受注',
  失注: '失注',
  '商談対象外（無効商談）': '無効',
};

function ymOk(s) {
  return /^\d{4}-\d{2}$/.test(String(s == null ? '' : s).trim());
}

function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthBounds(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to, y, m };
}

function addYm(ym, n) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymRange(fromYm, toYm) {
  const out = [];
  let cur = fromYm;
  while (cur <= toYm && out.length < 36) {
    out.push(cur);
    cur = addYm(cur, 1);
  }
  return out;
}

function inRange(d, from, to) {
  return !!d && String(d) >= from && String(d) <= to;
}

function blank() {
  return {
    deals: 0,
    apo: 0,
    sit: 0,
    valid: 0,
    invalid: 0,
    won: 0,
    lost: 0,
    out: 0,
    open: 0,
    notyet: 0,
    amount: 0,
    extra: 0,
    extraAmount: 0,
  };
}

function withRates(b) {
  return Object.assign(b, {
    apoRate: b.deals ? b.apo / b.deals : '',
    sitRate: b.apo ? b.sit / b.apo : '',
    winRate: b.apo ? b.won / b.apo : '',
    closeRate: b.sit ? b.won / b.sit : '',
    avg: b.won ? b.amount / b.won : '',
    validRate: b.sit ? b.valid / b.sit : '',
  });
}

function dealAmount(d, months) {
  return (Number(d.wonInit) || 0) + (Number(d.wonFee) || 0) * (months || 3);
}

function custAmount(c, months) {
  return (Number(c.init) || 0) + (Number(c.fee) || 0) * (months || 3);
}

function addDeal(b, d, today, months) {
  const c = BOOT_CATS[String(d.result || '').trim()] || '';
  const won = c === '受注';
  b.deals++;
  const due = won || (!!d.meetDate && d.meetDate <= today) || (!!d.meetPlan && d.meetPlan < today);
  const appt = won || !!(d.meetPlan || d.apoDate || d.meetDate);
  if (appt && due) b.apo++;
  if (due && (won || (d.meetDate && c !== '未着座' && c !== 'リスケ'))) {
    b.sit++;
    if (c === '無効') b.invalid++;
    else b.valid++;
  }
  if (appt && !due) b.notyet++;
  if (won) {
    b.won++;
    b.amount += dealAmount(d, months);
  } else if (c === '無効') b.out++;
  else if (c === '失注' || c === '取消') b.lost++;
  else b.open++;
}

function dealOfCustomer(deals) {
  const byId = {};
  const byCust = {};
  deals.forEach((d) => {
    if (d.id) byId[d.id] = d;
    const n = String(d.customer || '').trim();
    if (n && (!byCust[n] || (d.stage === '受注' && byCust[n].stage !== '受注'))) byCust[n] = d;
  });
  return (c) => (c.deal && byId[c.deal]) || byCust[c.name] || null;
}

function resolveRange(fromYm, toYm, fallbackFrom, fallbackTo) {
  let from = ymOk(fromYm) ? String(fromYm).trim() : fallbackFrom;
  let to = ymOk(toYm) ? String(toYm).trim() : fallbackTo;
  if (from > to) from = to;
  return { from, to };
}

function appAnalysis({ deals, custs, camps, targets, fromYm, toYm, group }) {
  if (!ymOk(fromYm)) throw new Error('月は 2026-11 の形で');
  const fromM = String(fromYm).trim();
  const toM = ymOk(toYm) ? String(toYm).trim() : fromM;
  if (toM < fromM) throw new Error('「まで」の月が「から」の月より前です');
  const { from } = monthBounds(fromM);
  const { to } = monthBounds(toM);
  const today = todayYmd();
  const months = 3;
  const NONE = '（リード元なし）';
  const detail = group === 'detail';
  const keyOf = (src, det) => (detail ? (src || NONE) + (det ? '：' + det : '') : src || NONE);
  const entry = (d) => d.leadDate || d.apoDate || d.meetPlan || '';
  const by = {};
  const box = (k) => by[k] || (by[k] = Object.assign(blank(), { key: k }));
  const total = Object.assign(blank(), { key: '合計' });
  const linked = dealOfCustomer(deals);

  deals.filter((d) => inRange(entry(d), from, to)).forEach((d) => {
    addDeal(box(keyOf(d.source, d.sourceDetail)), d, today, months);
    addDeal(total, d, today, months);
  });

  custs
    .filter((c) => inRange(c.contract, from, to) && !linked(c))
    .forEach((c) => {
      const k = keyOf(c.source || '', '');
      const b = box(k);
      const amt = custAmount(c, months);
      b.extra++;
      b.extraAmount += amt;
      total.extra++;
      total.extraAmount += amt;
    });

  if (!detail) {
    const tg = {};
    (targets || []).forEach((t) => {
      if (!t.route) return;
      const k = t.route;
      const x = tg[k] || (tg[k] = { apo: '', won: '', amount: '' });
      const apo = Number(t.apo);
      const won = Number(t.contract_count != null ? t.contract_count : t.won);
      const amount = Number(t.amount);
      if (t.apo !== '' && t.apo != null && !Number.isNaN(apo)) x.apo = (x.apo === '' ? 0 : x.apo) + apo;
      if (!Number.isNaN(won) && (t.contract_count != null || t.won != null) && t.won !== '' && t.contract_count !== '') {
        x.won = (x.won === '' ? 0 : x.won) + won;
      }
      if (t.amount !== '' && t.amount != null && !Number.isNaN(amount)) x.amount = (x.amount === '' ? 0 : x.amount) + amount;
    });
    const tt = { apo: '', won: '', amount: '' };
    Object.keys(tg).forEach((k) => {
      const b = box(k);
      b.target = tg[k];
      ['apo', 'won', 'amount'].forEach((f) => {
        if (tg[k][f] !== '') tt[f] = (tt[f] === '' ? 0 : tt[f]) + tg[k][f];
      });
    });
    total.target = tt;
  }

  const reachOf = (b) => {
    const t = b.target || {};
    const r = (a, x) => (x ? a / x : '');
    return {
      apo: r(b.apo, t.apo),
      won: r(b.won + b.extra, t.won),
      amount: r(b.amount + b.extraAmount, t.amount),
      winRate: t.apo && t.won ? t.won / t.apo : '',
    };
  };

  const rows = Object.keys(by)
    .map((k) => Object.assign(withRates(by[k]), { reach: reachOf(by[k]) }))
    .sort((a, b) => b.deals - a.deals || b.won + b.extra - (a.won + a.extra) || a.key.localeCompare(b.key, 'ja'));

  const periodMonths = ymRange(fromM, toM);
  const monthly = periodMonths.map((ym) => {
    const b = monthBounds(ym);
    const all = blank();
    const byRoute = {};
    const r = (k) => byRoute[k] || (byRoute[k] = blank());
    deals.filter((d) => inRange(entry(d), b.from, b.to)).forEach((d) => {
      addDeal(r(d.source || NONE), d, today, months);
      addDeal(all, d, today, months);
    });
    Object.keys(byRoute).forEach((k) => withRates(byRoute[k]));
    return { month: ym, all: withRates(all), byRoute };
  });

  const seminars = (camps || [])
    .filter((c) => inRange(c.date, from, to))
    .map((c) => ({
      id: c.id || '',
      name: c.name,
      date: c.date,
      kind: c.kind || '',
      state: c.state || '',
      people: 0,
      apo: 0,
      sit: 0,
      valid: 0,
      won: 0,
      amount: 0,
      noPrice: 0,
      partner: c.partner || '',
      speaker: c.speaker || '',
      theme: c.theme || '',
      goalPeople: c.goalPeople,
      goalApo: c.goalApo,
      goalWon: c.goalWon,
      goalAmount: c.goalAmount,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  withRates(total);
  total.reach = reachOf(total);

  const targetMonths = [
    ...new Set(
      (targets || [])
        .filter((t) => t.route && (t.apo || t.contract_count || t.won || t.amount))
        .map((t) => t.ym)
        .filter(Boolean)
    ),
  ].sort();

  return {
    from,
    to,
    group: detail ? 'detail' : 'route',
    months,
    rows,
    total,
    monthly,
    routes: [...new Set(rows.map((r) => r.key))],
    seminars,
    targetMonths,
    periodMonths,
    meta: { backend: 'supabase' },
  };
}

function appRevenue({ custs, reqs, plans, fromYm, toYm }) {
  const today = todayYmd();
  const thisYm = ymNow();
  const fallbackFrom = thisYm;
  const fallbackTo = addYm(thisYm, 2);
  const { from, to } = resolveRange(fromYm, toYm, fallbackFrom, fallbackTo);
  const months = ymRange(from, to);
  const planMap = {};
  (plans || []).forEach((p) => {
    planMap[p.ym] = p.plan_new;
  });

  let cum = 0;
  const rows = months.map((ym) => {
    const b = monthBounds(ym);
    let live = 0;
    let isNew = 0;
    let init = 0;
    let sub = 0;
    custs.forEach((c) => {
      if (!c.name || c.state === 'トライアル') return;
      const contract = c.contract ? String(c.contract).slice(0, 10) : '';
      const end = c.end ? String(c.end).slice(0, 10) : '';
      if (contract && contract > b.to) return;
      if (end && end < b.from) return;
      if (c.state === '終了' && end && end < b.from) return;
      live++;
      if (contract && contract >= b.from && contract <= b.to) {
        isNew++;
        init += Number(c.init) || 0;
      }
      if (contract && contract <= b.to && (!end || end >= b.from)) {
        sub += Number(c.fee) || 0;
      }
    });
    let usd = 0;
    reqs.forEach((r) => {
      if (r.status !== '納品済み') return;
      const del = r.delivered ? String(r.delivered).slice(0, 7) : '';
      if (del !== ym) return;
      usd += (Number(r.actUsd) || 0) + (Number(r.actEl) || 0);
    });
    const rate = 150;
    const cost = Math.round(usd * rate);
    const fee = 0;
    const inc = init + sub;
    cum += inc;
    const future = ym > thisYm;
    const planNew = planMap[ym] != null ? planMap[ym] : '';
    return {
      month: ym,
      live,
      isNew,
      planNew,
      init,
      sub,
      inc,
      cum,
      fee,
      usd,
      cost,
      net: inc - fee - cost,
      note: '',
      now: ym === thisYm,
      future,
    };
  });

  const recentNew = custs.filter((c) => {
    const ym = c.contract ? String(c.contract).slice(0, 7) : '';
    return ym && ym >= addYm(thisYm, -2) && ym <= thisYm;
  });
  const average = {
    n: recentNew.length,
    init: recentNew.length ? recentNew.reduce((s, c) => s + (Number(c.init) || 0), 0) / recentNew.length : 0,
    fee: recentNew.length ? recentNew.reduce((s, c) => s + (Number(c.fee) || 0), 0) / recentNew.length : 0,
  };

  return {
    from,
    to,
    rows,
    average,
    rate: 150,
    heygen: 29,
    meta: { backend: 'supabase' },
  };
}

function appChurn({ custs, reqs, fromYm, toYm }) {
  const thisYm = ymNow();
  const { from, to } = resolveRange(fromYm, toYm, addYm(thisYm, -5), thisYm);
  const months = ymRange(from, to);
  const today = todayYmd();
  const rows = months.map((ym) => {
    const b = monthBounds(ym);
    let start = 0;
    let end = 0;
    let canceling = 0;
    custs.forEach((c) => {
      if (!c.name || c.kind === 'トライアル') return;
      const contract = c.contract ? String(c.contract).slice(0, 10) : '';
      const endDay = c.end ? String(c.end).slice(0, 10) : '';
      if (contract && contract >= b.from && contract <= b.to) start++;
      if (endDay && endDay >= b.from && endDay <= b.to) end++;
      if (c.state === '解約予定' && (!endDay || (endDay >= b.from && endDay <= b.to))) canceling++;
    });
    return { month: ym, start, end, canceling, churn: start ? end / start : '' };
  });
  const warn = custs.filter((c) => c.state === '契約中' || c.state === '解約予定').slice(0, 50);
  const late = custs.filter((c) => c.state === '解約予定').slice(0, 50);
  const plan = custs
    .filter((c) => c.state === '解約予定')
    .map((c) => ({ name: c.name, end: c.end || '', days: c.end ? Math.round((new Date(c.end) - new Date(today)) / 86400000) : '' }));
  return { from, to, rows, warn, late, plan, meta: { backend: 'supabase' } };
}

function appCustomerActivity({ custs, reqs, fromYm, toYm }) {
  const thisYm = ymNow();
  const { from, to } = resolveRange(fromYm, toYm, addYm(thisYm, -5), thisYm);
  const months = ymRange(from, to);
  const rows = custs
    .filter((c) => c.name && c.kind !== 'トライアル' && c.state !== '終了')
    .map((c) => {
      const counts = {};
      months.forEach((m) => {
        counts[m] = 0;
      });
      reqs.forEach((r) => {
        if (r.cust !== c.name || r.status === '取消' || !r.received) return;
        const m = String(r.received).slice(0, 7);
        if (counts[m] != null) counts[m]++;
      });
      return { name: c.name, state: c.state || '', months: counts };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return { from, to, months, rows, meta: { backend: 'supabase' } };
}

function appAgencyStats({ agencies, deals, custs, fromYm, toYm }) {
  if (!ymOk(fromYm)) throw new Error('月は 2026-11 の形で');
  const fromM = String(fromYm).trim();
  const toM = ymOk(toYm) ? String(toYm).trim() : fromM;
  if (toM < fromM) throw new Error('「まで」の月が「から」の月より前です');
  const { from } = monthBounds(fromM);
  const { to } = monthBounds(toM);
  const months = ymRange(fromM, toM);
  const today = todayYmd();
  const entry = (d) => d.leadDate || d.apoDate || d.meetPlan || '';
  const linked = dealOfCustomer(deals);

  const rows = (agencies || [])
    .filter((ag) => ag.name)
    .map((ag) => {
      const r = {
        name: ag.name,
        state: ag.state || '',
        start: ag.start || '',
        feeRule: ag.feeRule || '',
        lead: 0,
        apo: 0,
        sit: 0,
        valid: 0,
        invalid: 0,
        won: 0,
        amount: 0,
        extra: 0,
        extraAmount: 0,
        noField: 0,
        noFieldNames: [],
        months: months.slice(),
        activeMonths: [],
        last: '',
      };
      deals
        .filter((d) => d.sourceDetail === ag.name || (d.source === '紹介' && d.sourceDetail === ag.name))
        .forEach((d) => {
          const e = String(entry(d) || '').slice(0, 10);
          if (e && r.last < e) r.last = e;
          if (!inRange(e, from, to)) return;
          const c = BOOT_CATS[String(d.result || '').trim()] || '';
          const w = c === '受注';
          r.lead++;
          if (w || d.meetPlan || d.apoDate || d.meetDate) r.apo++;
          if (w || (d.meetDate && c !== '未着座' && c !== 'リスケ')) {
            r.sit++;
            if (c === '無効') r.invalid++;
            else r.valid++;
          }
          if (w) {
            r.won++;
            r.amount += dealAmount(d, 3);
          }
          const ym = e.slice(0, 7);
          if (ym && r.activeMonths.indexOf(ym) < 0) r.activeMonths.push(ym);
        });
      custs
        .filter((c) => c.agency === ag.name)
        .forEach((c) => {
          const k = c.contract ? String(c.contract).slice(0, 10) : '';
          if (k && r.last < k) r.last = k;
          if (!inRange(k, from, to)) return;
          if (linked(c)) return;
          r.extra++;
          r.extraAmount += custAmount(c, 3);
          const ym = k.slice(0, 7);
          if (ym && r.activeMonths.indexOf(ym) < 0) r.activeMonths.push(ym);
        });
      r.activeMonths.sort();
      const rt = (a, b) => (b ? a / b : '');
      return Object.assign(r, {
        active: r.activeMonths.length > 0,
        validRate: rt(r.valid, r.sit),
        winRate: rt(r.won, r.apo),
        validWin: rt(r.won, r.valid),
      });
    });

  const live = rows.filter((r) => r.months.length > 0);
  const total = {
    agencies: live.length,
    active: live.filter((r) => r.active).length,
    lead: live.reduce((s, r) => s + r.lead, 0),
    apo: live.reduce((s, r) => s + r.apo, 0),
    sit: live.reduce((s, r) => s + r.sit, 0),
    valid: live.reduce((s, r) => s + r.valid, 0),
    won: live.reduce((s, r) => s + r.won, 0),
    amount: live.reduce((s, r) => s + r.amount, 0),
    extra: live.reduce((s, r) => s + r.extra, 0),
  };
  const monthly = months.map((ym) => {
    const b = monthBounds(ym);
    let agenciesN = 0;
    let active = 0;
    rows.forEach((r) => {
      if (r.months.indexOf(ym) >= 0) agenciesN++;
      if (r.activeMonths.indexOf(ym) >= 0) active++;
    });
    return { month: ym, agencies: agenciesN, active, now: ym === ymNow(), future: ym > ymNow() };
  });

  return {
    from,
    to,
    months,
    rows,
    total,
    monthly,
    meta: { backend: 'supabase', today },
  };
}

function appFeePayouts({ agencies, feeRows, fromYm, toYm, month }) {
  const thisYm = ymNow();
  const payMonth = ymOk(month) ? String(month).trim() : thisYm;
  const { from, to } = resolveRange(fromYm, toYm, addYm(payMonth, -2), payMonth);
  const byAgency = {};
  (feeRows || []).forEach((r) => {
    if (r.pay_month !== payMonth) return;
    byAgency[r.agency] = {
      agency: r.agency,
      adj: r.adjust_incl_tax == null ? '' : Number(r.adjust_incl_tax),
      paid: r.paid_incl_tax == null ? '' : Number(r.paid_incl_tax),
      paidDate: r.paid_on || '',
      memo: r.memo || '',
    };
  });
  const rows = (agencies || [])
    .filter((a) => a.name && a.state !== '終了')
    .map((a) => {
      const hit = byAgency[a.name] || { agency: a.name, adj: '', paid: '', paidDate: '', memo: '' };
      return Object.assign({ state: a.state || '', feeRule: a.feeRule || '', due: 0, lines: [] }, hit);
    });
  const months = ymRange(from, to).map((ym) => ({
    month: ym,
    now: ym === thisYm,
    future: ym > thisYm,
    byAgency: {},
  }));
  return {
    month: payMonth,
    from,
    to,
    rows,
    months,
    meta: { backend: 'supabase' },
  };
}

function appReferrals({ custs, reqs, agencies }) {
  const kinds = {};
  (agencies || []).forEach((a) => {
    kinds[a.name] = a.kind || '';
  });
  const by = {};
  custs
    .filter((c) => c.name && c.kind !== 'トライアル')
    .forEach((c) => {
      const key = c.agency || c.source || '（なし）';
      const row =
        by[key] ||
        (by[key] = {
          key,
          kind: kinds[c.agency] || '',
          n: 0,
          live: 0,
          canceling: 0,
          end: 0,
          jobs: 0,
          fee: 0,
          fromCustomer: false,
        });
      row.n++;
      if (c.state === '契約中') row.live++;
      if (c.state === '解約予定') row.canceling++;
      if (c.state === '終了') row.end++;
      row.fee += Number(c.fee) || 0;
    });
  reqs.forEach((r) => {
    if (r.status === '取消') return;
    const c = custs.find((x) => x.name === r.cust);
    if (!c) return;
    const key = c.agency || c.source || '（なし）';
    if (by[key]) by[key].jobs++;
  });
  const thisYm = ymNow();
  const months = ymRange(addYm(thisYm, -11), thisYm).map((ym) => {
    const b = monthBounds(ym);
    const bucket = { month: ym, referral: 0, seminar: 0, other: 0, none: 0 };
    custs.forEach((c) => {
      if (!inRange(c.contract, b.from, b.to)) return;
      if (c.agency) bucket.referral++;
      else if (String(c.source || '').indexOf('セミナー') >= 0 || String(c.source || '').indexOf('交流') >= 0) bucket.seminar++;
      else if (!c.source) bucket.none++;
      else bucket.other++;
    });
    return bucket;
  });
  return {
    rows: Object.keys(by)
      .map((k) => by[k])
      .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, 'ja')),
    months,
    meta: { backend: 'supabase' },
  };
}

module.exports = {
  appAnalysis,
  appRevenue,
  appChurn,
  appCustomerActivity,
  appAgencyStats,
  appFeePayouts,
  appReferrals,
  ymOk,
  ymNow,
  addYm,
  monthBounds,
};
