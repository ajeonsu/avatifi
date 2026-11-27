/**
 * Vercel serverless entry — mirrors GAS doPost crmApi_ contract.
 * Body: text/plain JSON { crm:1, fn, args:[passphrase,...] }
 * Response: { ok, crm:1, value } | { ok:false, crm:1, error }  (Vue UI requires crm:1)
 *
 * Order:
 *   CRM_MOCK=1 → mock store
 *   else Supabase env → supabaseHandlers
 *     (CRM_FALLBACK_MOCK=1 → unimplemented fns fall back to mock)
 *   else 501
 */

const { dispatchMock } = require('./mockStore');
const { dispatchSupabase } = require('./supabaseHandlers');
const sb = require('./supabaseClient');

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
  const wantMock = raw === '1' || String(raw || '').toLowerCase() === 'true';
  if (!wantMock) return false;
  // When Supabase is wired, prefer it unless CRM_FORCE_MOCK=1 (keeps local mock override).
  const force = process.env.CRM_FORCE_MOCK;
  if (sb.configured() && force !== '1' && String(force || '').toLowerCase() !== 'true') {
    return false;
  }
  return true;
}

function useFallbackMock() {
  const raw = process.env.CRM_FALLBACK_MOCK;
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

  if (sb.configured()) {
    try {
      const value = await dispatchSupabase(body.fn, args);
      if (value != null) {
        return sendJson(res, 200, { ok: true, crm: 1, value });
      }
      if (useFallbackMock()) {
        try {
          const mockVal = dispatchMock(body.fn, args);
          return sendJson(res, 200, { ok: true, crm: 1, value: mockVal });
        } catch (mockErr) {
          const status = mockErr && mockErr.status ? mockErr.status : 501;
          return sendJson(res, status, {
            ok: false,
            crm: 1,
            error: mockErr.message || `${body.fn} not implemented on Supabase yet`,
          });
        }
      }
      return sendJson(res, 501, {
        ok: false,
        crm: 1,
        error: `${body.fn} not implemented on Supabase yet`,
      });
    } catch (err) {
      const status = err && err.status ? err.status : 400;
      return sendJson(res, status >= 400 && status < 600 ? status : 400, {
        ok: false,
        crm: 1,
        error: err.message || String(err),
      });
    }
  }

  return sendJson(res, 501, {
    ok: false,
    crm: 1,
    error: `${body.fn} not implemented yet (set CRM_MOCK=1 or SUPABASE_URL + key)`,
    meta: {
      service: 'avatifi-crm',
      phase: '1-wiring',
      fn: body.fn,
      github: 'https://github.com/ajeonsu/avatifi',
      supabaseRef: 'qxzftftbvgysgzhqgfoz',
      vercelTeam: 'taoyagi-4963s-projects',
    },
  });
};
