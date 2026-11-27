/**
 * Vercel serverless entry — mirrors GAS doPost crmApi_ contract.
 * Body: text/plain JSON { crm:1, fn, args:[passphrase,...] }
 * Response: { ok, crm:1, value } | { ok:false, crm:1, error }  (Vue UI requires crm:1)
 * Phase 1: wire to Supabase. CRM_MOCK=1 → local sample store (never prod).
 */

const { dispatchMock } = require('./mockStore');

const ALLOWED = new Set([
  'appAddPerson', 'appAgencyStats', 'appAnalysis', 'appBoot', 'appCardToDeal',
  'appCardUpload', 'appChurn', 'appCustBulk', 'appCustomerActivity', 'appDealBulk',
  'appDealMove', 'appDelete', 'appFeePayouts', 'appFeeSave', 'appFormAnswers',
  'appGoals', 'appGoalSave', 'appHistory', 'appHome', 'appImportHolidays',
  'appImportPreview', 'appImportRun', 'appKpi', 'appKpiTargets', 'appList',
  'appMakeFormLinks', 'appMonthCounts', 'appPayAdd', 'appPayConfirm', 'appPayDelete',
  'appPayEdit', 'appPayments', 'appPeopleToDeal', 'appReferrals', 'appReqCost',
  'appReqMemo', 'appReqStatus', 'appRevenue', 'appRevenuePlan', 'appSave',
  'appSettings', 'appSettingsSave', 'appTaskDelete', 'appTaskDone', 'appTasks',
  'appTaskSave', 'appUserKey',
]);

function useMock() {
  const raw = process.env.CRM_MOCK;
  return raw === '1' || String(raw || '').toLowerCase() === 'true';
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, crm: 1, error: 'POST only' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { ok: false, crm: 1, error: 'Invalid JSON' });
    }
  }

  if (!body || body.crm !== 1 || typeof body.fn !== 'string') {
    return sendJson(res, 400, { ok: false, crm: 1, error: 'Invalid CRM payload' });
  }
  if (!ALLOWED.has(body.fn)) {
    return sendJson(res, 400, { ok: false, crm: 1, error: `Unknown or blocked function: ${body.fn}` });
  }

  const args = Array.isArray(body.args) ? body.args : [];
  if (!args[0]) {
    return sendJson(res, 401, { ok: false, crm: 1, error: '合言葉がありません' });
  }

  if (useMock()) {
    try {
      const value = dispatchMock(body.fn, args);
      return sendJson(res, 200, { ok: true, crm: 1, value });
    } catch (err) {
      const status = err && err.status ? err.status : 400;
      return sendJson(res, status, {
        ok: false,
        crm: 1,
        error: err.message || String(err),
      });
    }
  }

  // Preview stub — Supabase handlers land in Phase 1
  return sendJson(res, 501, {
    ok: false,
    crm: 1,
    error: `${body.fn} not implemented yet (Supabase Phase 1)`,
    meta: {
      service: 'avatifi-crm-migration',
      phase: '0/1-scaffold',
      fn: body.fn,
      hint: 'Set CRM_MOCK=1 for local sample responses',
      github: 'https://github.com/ajeonsu/avatifi',
      supabaseRef: 'qxzftftbvgysgzhqgfoz',
    },
  });
};
