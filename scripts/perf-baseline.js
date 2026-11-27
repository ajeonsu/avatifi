/**
 * Latency baseline for Avatifi CRM preview (Vercel + Supabase).
 * Usage: node scripts/perf-baseline.js
 * Writes docs/baseline-supabase-preview-YYYY-MM-DD.json
 */
const fs = require('fs');
const path = require('path');

const pass = process.env.CRM_PREVIEW_KEY || 'avatifi-preview-key-2026-ok';
const base = process.env.CRM_URL || 'https://avatifi.vercel.app';
const api = base.replace(/\/$/, '') + '/api/crm';
const N = Number(process.env.CRM_PERF_N || 5);

const CASES = [
  ['appBoot', []],
  ['appHome', [false]],
  ['appList', ['deal']],
  ['appList', ['cust']],
  ['appList', ['req']],
  ['appPayments', []],
  ['appTasks', []],
  ['appGoals', [new Date().toISOString().slice(0, 7)]],
  ['appMonthCounts', []],
  ['appSettings', []],
  ['appAnalysis', [new Date().toISOString().slice(0, 7), new Date().toISOString().slice(0, 7), 'route']],
];

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

async function once(fn, args) {
  const t0 = Date.now();
  const r = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm: 1, fn, args: [pass, ...args] }),
  });
  const j = await r.json().catch(() => ({}));
  const ms = Date.now() - t0;
  if (!j.ok) throw new Error(`${fn}: ${j.error || r.status}`);
  return ms;
}

(async () => {
  const results = [];
  for (const [fn, args] of CASES) {
    const samples = [];
    for (let i = 0; i < N; i++) {
      samples.push(await once(fn, args));
    }
    const sorted = samples.slice().sort((a, b) => a - b);
    const label = args.length ? `${fn}(${args.join(',')})` : fn;
    results.push({
      fn: label,
      n: N,
      p50: pct(sorted, 50),
      p90: pct(sorted, 90),
      samples,
    });
    console.error(label, 'p50=', pct(sorted, 50), 'p90=', pct(sorted, 90));
  }
  const day = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    backend: 'supabase',
    url: base,
    note:
      'Cold/warm mix over Vercel serverless + Supabase REST; p50/p90 from ' +
      N +
      ' samples each. Compare to docs/baseline-mock-*.json (local mock, not same host) and future Sheets/prod baseline when available.',
    results,
  };
  const out = path.join(__dirname, '..', 'docs', `baseline-supabase-preview-${day}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ written: out, results }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
