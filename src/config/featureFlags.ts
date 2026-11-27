/**
 * Hybrid / replacement feature flags for Avatifi CRM migration.
 * Read from process.env on Vercel / Node. Defaults match v1 hybrid recommendation.
 * See docs/HYBRID-INTEGRATIONS.md — await boss OK before enabling cloud adapters.
 */

export type FeatureFlags = {
  hybridForms: boolean;
  hybridDrive: boolean;
  hybridClaude: boolean;
  replaceForms: boolean;
  replaceDrive: boolean;
  ocrEnabled: boolean;
  /** Local in-memory /api/crm — never use in production */
  crmMock: boolean;
};

function envFlag(env: NodeJS.ProcessEnv, name: string, defaultOn: boolean): boolean {
  const raw = env[name];
  if (raw == null || raw === '') return defaultOn;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export function loadFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    hybridForms: envFlag(env, 'CRM_HYBRID_FORMS', true),
    hybridDrive: envFlag(env, 'CRM_HYBRID_DRIVE', true),
    hybridClaude: envFlag(env, 'CRM_HYBRID_CLAUDE', true),
    replaceForms: envFlag(env, 'CRM_REPLACE_FORMS', false),
    replaceDrive: envFlag(env, 'CRM_REPLACE_DRIVE', false),
    ocrEnabled: envFlag(env, 'CRM_OCR_ENABLED', false),
    crmMock: envFlag(env, 'CRM_MOCK', false),
  };
}

/** Claude webhook may only set these statuses (依頼台帳.gs CLAUDE_STATUSES). */
export const CLAUDE_STATUSES = ['聞き返し中', '台本づくり', '社内確認待ち', '納品済み'] as const;

export const CLAUDE_API_FOLDERS = ['02_台本', '03_納品'] as const;
