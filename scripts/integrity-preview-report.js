/**
 * Integrity snapshot against live Supabase-backed preview API.
 * Usage: node scripts/integrity-preview-report.js
 */
const pass = process.env.CRM_PREVIEW_KEY || 'avatifi-preview-key-2026-ok';
const url = process.env.CRM_URL || 'https://avatifi.vercel.app/api/crm';

async function crm(fn, args = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ crm: 1, fn, args: [pass, ...args] }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${fn}: ${j.error || r.status}`);
  return j.value;
}

function stageDist(deals) {
  const o = {};
  deals.forEach((d) => {
    const s = d.stage || '(empty)';
    o[s] = (o[s] || 0) + 1;
  });
  return o;
}

(async () => {
  const [boot, deals, custs, reqs, pays, goals, analysis, revenue] = await Promise.all([
    crm('appBoot'),
    crm('appList', ['deal']),
    crm('appList', ['cust']),
    crm('appList', ['req']),
    crm('appPayments'),
    crm('appGoals', [new Date().toISOString().slice(0, 7)]),
    crm('appAnalysis', [new Date().toISOString().slice(0, 7), new Date().toISOString().slice(0, 7), 'route']),
    crm('appRevenue', []),
  ]);

  const paySum = (pays.rows || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const report = {
    generatedAt: new Date().toISOString(),
    url,
    backend: boot.meta && boot.meta.backend,
    counts: {
      deals: deals.length,
      customers: custs.length,
      requests: reqs.length,
      payments: (pays.rows || []).length,
      paymentAmount: paySum,
    },
    dealStages: stageDist(deals),
    goals: {
      month: goals.month,
      owner: goals.owner,
      kgiWon: goals.kgi && goals.kgi.won,
      kpiApo: goals.kpi && goals.kpi.apo,
    },
    analysis: {
      from: analysis.from,
      to: analysis.to,
      total: analysis.total,
      routeRows: (analysis.rows || []).length,
    },
    revenue: {
      from: revenue.from,
      to: revenue.to,
      months: (revenue.rows || []).length,
      now: (revenue.rows || []).find((r) => r.now) || null,
    },
    notes: [
      'Preview seed only — not a Sheets parity integrity check.',
      'Replace with sheet export comparison when client provides ledger data.',
    ],
  };
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
