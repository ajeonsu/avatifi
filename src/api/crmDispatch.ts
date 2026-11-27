/**
 * CRM API adapter stub — mirrors GAS crmApi_ / app* contract.
 * UI posts: { crm: 1, fn: "appList", args: [passphrase, ...entityArgs] }
 *
 * Phase 1: implement handlers against Supabase.
 * Do not deploy to production without boss confirmation.
 */

export type CrmRequest = {
  crm: 1;
  fn: string;
  args: unknown[];
};

export type CrmUser = {
  name: string;
  roles: string[];
  admin: boolean;
  prodOnly: boolean;
  active: boolean;
};

export type CrmHandler = (user: CrmUser, args: unknown[]) => Promise<unknown>;

/** Allowlisted app* names (from pack 営業.gs). Unknown fn → error. */
export const APP_FUNCTIONS = [
  'appAddPerson',
  'appAgencyStats',
  'appAnalysis',
  'appBoot',
  'appCardToDeal',
  'appCardUpload',
  'appChurn',
  'appCustBulk',
  'appCustomerActivity',
  'appDealBulk',
  'appDealMove',
  'appDelete',
  'appFeePayouts',
  'appFeeSave',
  'appFormAnswers',
  'appGoals',
  'appGoalSave',
  'appHistory',
  'appHome',
  'appImportHolidays',
  'appImportPreview',
  'appImportRun',
  'appKpi',
  'appKpiTargets',
  'appList',
  'appMakeFormLinks',
  'appMonthCounts',
  'appPayAdd',
  'appPayConfirm',
  'appPayDelete',
  'appPayEdit',
  'appPayments',
  'appPeopleToDeal',
  'appReferrals',
  'appReqCost',
  'appReqMemo',
  'appReqStatus',
  'appRevenue',
  'appRevenuePlan',
  'appSave',
  'appSettings',
  'appSettingsSave',
  'appTaskDelete',
  'appTaskDone',
  'appTasks',
  'appTaskSave',
  'appUserKey',
] as const;

export type AppFunction = (typeof APP_FUNCTIONS)[number];

const handlers: Partial<Record<AppFunction, CrmHandler>> = {
  // Wire in Phase 1 — example shape only
  async appBoot(_user, _args) {
    throw new Error('appBoot not implemented — Supabase Phase 1');
  },
};

/**
 * Authenticate passphrase (args[0]) then dispatch.
 * Replace with Supabase Auth / hashed passphrase lookup.
 */
export async function crmDispatch(body: CrmRequest): Promise<unknown> {
  if (!body || body.crm !== 1 || typeof body.fn !== 'string') {
    throw new Error('Invalid CRM payload');
  }
  if (!APP_FUNCTIONS.includes(body.fn as AppFunction)) {
    throw new Error(`Unknown or blocked function: ${body.fn}`);
  }
  const args = Array.isArray(body.args) ? body.args : [];
  const passphrase = String(args[0] ?? '');
  if (!passphrase) throw new Error('合言葉がありません');

  const user = await authByPassphrase(passphrase);
  const fn = body.fn as AppFunction;
  const handler = handlers[fn];
  if (!handler) throw new Error(`${fn} not implemented yet`);
  return handler(user, args.slice(1));
}

async function authByPassphrase(_passphrase: string): Promise<CrmUser> {
  // TODO Phase 1: look up app_users.passphrase_hash / migrate to Supabase Auth
  throw new Error('authByPassphrase not implemented — Supabase Phase 1');
}

export function registerHandler(fn: AppFunction, handler: CrmHandler): void {
  handlers[fn] = handler;
}
