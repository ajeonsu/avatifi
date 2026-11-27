# Preview deploy checklist (Vercel + Supabase)

**Repo:** https://github.com/ajeonsu/avatifi  
**Vercel team:** https://vercel.com/taoyagi-4963s-projects  
**Supabase:** https://supabase.com/dashboard/project/qxzftftbvgysgzhqgfoz  

Do **not** promote to production or buy paid add-ons without boss OK.

## 1) Supabase (SQL draft — preview)

1. Open project → **SQL Editor**.
2. Paste `supabase/migrations/20261127_avatifi_schema_draft.sql` (uses `IF NOT EXISTS`).
3. Run once. Confirm tables: `app_users`, `deals`, `customers`, `requests`, …
4. (Optional seed) insert one preview user with `passphrase_hash` = SHA-256 hex of a ≥20-char passphrase (same as GAS `crmHash_`).

Env for Vercel / local (Settings → API; share keys via secure channel only):

```
SUPABASE_URL=https://qxzftftbvgysgzhqgfoz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…   # server only
# or SUPABASE_ANON_KEY=… with RLS policies
CRM_MOCK=0
```

## 2) Vercel (link GitHub → preview)

1. Log in as a member of **taoyagi-4963s-projects**.
2. **Add New Project** → Import `ajeonsu/avatifi`.
3. Framework: Other / static. Root = repo root. Output = none (serves `public/` + `api/`).
4. Set env vars from §1.
5. Deploy → open `*.vercel.app` → `#k=<preview-passphrase>`.

CLI (after `vercel login` into that team):

```bash
cd avatifi-crm-migration   # or cloned ajeonsu/avatifi
npx vercel link
npx vercel env add SUPABASE_URL
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel --prod=false
```

## 3) Still blocked for full parity

- Spreadsheet export (data migration + integrity)
- Drive / Forms / Claude hybrid confirm
- Boss OK before production cutover

## Local without cloud

```powershell
npm run preview:mock          # pack harness :8780
$env:CRM_MOCK="1"; npx vercel dev
npm run test:mock-api
```
