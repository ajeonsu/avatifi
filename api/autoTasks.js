/**
 * Auto tasks derived from live CRM rows (GAS crmAutoTasks_ subset for preview).
 */

const NOBODY = '（担当なし）';

function who(...names) {
  for (const n of names) {
    const s = String(n == null ? '' : n).trim();
    if (s) return s;
  }
  return NOBODY;
}

function ymdPlus(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function yen(n) {
  return (Number(n) || 0).toLocaleString('ja-JP') + '円';
}

/**
 * @param {{ deals: any[], custs: any[], pays: any[], reqs: any[], camps: any[], cats?: Record<string,string>, today?: string }} data
 */
function buildAutoTasks(data) {
  const today = data.today || new Date().toISOString().slice(0, 10);
  const tomorrow = ymdPlus(today, 1);
  const cats = data.cats || {};
  const out = [];

  (data.deals || []).forEach((d) => {
    if (['アポ', '着座', '見込み'].indexOf(d.stage) < 0) return;
    const c = cats[String(d.result || '').trim()] || '';
    const why = [];
    let due = '';
    const take = (x) => {
      if (x && (!due || x < due)) due = x;
    };
    if (!d.meetDate && !d.result && (d.meetPlan === today || d.meetPlan === tomorrow)) {
      why.push(d.meetPlan === today ? '今日の商談' : '明日の商談');
      take(d.meetPlan);
    }
    if (d.stage === 'アポ' && d.meetPlan && d.meetPlan < today && !d.result) {
      why.push('結果を入れる（商談予定日を過ぎた）');
      take(d.meetPlan);
    }
    if (d.stage === '着座') {
      why.push('結果を入れる（商談した）');
      take(d.meetDate || d.meetPlan);
    }
    if ((c === 'リスケ' || c === '未着座') && (!d.meetPlan || d.meetPlan < today)) {
      why.push('次の商談予定日を入れる（' + d.result + '）');
      take(d.meetPlan);
    }
    if (d.stage === '見込み' && d.nextDate && d.nextDate <= today) {
      why.push('連絡する（次の連絡日）');
      take(d.nextDate);
    }
    if (d.stage === '見込み' && !d.nextDate) why.push('次の連絡日を決める');
    if (!String(d.closer || '').trim()) why.push('商談者を決める');
    if (!why.length) return;
    out.push({
      key: 'deal:' + d.id,
      src: '商談',
      title: d.name + (d.company ? '（' + d.company + '）' : ''),
      why,
      due,
      person: who(d.closer, d.apoOwner, d.leadOwner),
      ref: { kind: 'deal', key: d.id },
      auto: true,
    });
  });

  (data.custs || [])
    .filter((c) => c.name && c.state !== '終了' && c.state !== 'トライアル')
    .forEach((c) => {
      const why = [];
      if (c.production && !c.contract) why.push('契約日を入れる');
      if (c.autopay === '未登録') why.push('定期決済を登録する');
      if (c.gform === '未共有') why.push('Googleフォームを共有する');
      if (c.gform === '共有済') why.push('Googleフォームの回答をもらう');
      if (c.production && !c.avatar && !c.voiceId) why.push('顔と声を用意する');
      if (!String(c.feePay || '').trim()) why.push('月額の支払い方法を入れる');
      if (!why.length) return;
      out.push({
        key: 'cust:' + c.name,
        src: '顧客',
        title: c.name,
        why,
        due: '',
        since: c.contract || '',
        person: who(c.cs, c.sales),
        ref: { kind: 'cust', key: c.name },
        auto: true,
      });
    });

  (data.pays || [])
    .filter((p) => !p.ok && p.date && p.date < today)
    .forEach((p) => {
      const cust = (data.custs || []).find((c) => c.name === p.customer);
      out.push({
        key: 'pay:' + (p.key || p.payKey || p.id),
        src: '入金',
        title: (p.customer || '') + '　' + yen(p.amount),
        why: ['入金を確かめる（' + (p.method || '支払い方法が空') + '）'],
        due: p.date || '',
        person: who(cust && cust.sales),
        ref: { kind: 'cust', key: p.customer },
        auto: true,
      });
    });

  (data.reqs || []).forEach((r) => {
    const base = {
      key: 'req:' + r.id,
      src: '制作',
      title: r.id + (r.theme ? '　' + r.theme : ''),
      due: '',
      ref: { kind: 'req', key: r.id },
      auto: true,
    };
    if (r.waiting === '営業') {
      out.push(Object.assign({}, base, { why: ['依頼を進める（' + r.status + '）'], person: who(r.sales) }));
    } else if (r.waiting === 'お客様' && Number(r.waitDays) >= 3) {
      out.push(
        Object.assign({}, base, {
          why: ['お客様に確かめる（' + r.status + '・' + r.waitDays + '営業日待ち）'],
          person: who(r.sales),
        })
      );
    } else if (r.waiting === '青柳') {
      out.push(Object.assign({}, base, { why: [r.status], person: '青柳' }));
    }
  });

  (data.camps || []).forEach((cp) => {
    const st = String(cp.state || '').trim();
    if (!cp.date || cp.date >= today || st === '開催済' || st === '開催済み' || st === '中止') return;
    out.push({
      key: 'camp:' + (cp.id || cp.name),
      src: '施策',
      title: cp.name,
      why: ['開催の状態と参加者を入れる（開催日を過ぎた）'],
      due: cp.date,
      person: who(String(cp.pm || '').replace(/[（(].*?[）)]/g, '')),
      ref: { kind: 'camp', key: cp.id || cp.name },
      auto: true,
    });
  });

  return out.sort(
    (a, b) =>
      String(a.due || '9999').localeCompare(String(b.due || '9999')) ||
      a.src.localeCompare(b.src, 'ja') ||
      a.title.localeCompare(b.title, 'ja')
  );
}

module.exports = { buildAutoTasks, NOBODY };
