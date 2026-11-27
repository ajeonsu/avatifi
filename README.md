# Avatifi CRM — Vercel + Supabase migration (local workspace)

**Goal:** Same CRM Forspect uses today (Vue UI), backend moved from Sheets/GAS → Supabase/PostgreSQL, preview on Vercel.  
**Plan:** `../FORSPECT-Avatifi-CRM-Full-Migration-Plan.md`  
**Tracker:** `../FORSPECT-Avatifi-CRM-TRACKER.md`  
**Targets:** [docs/TARGETS.md](docs/TARGETS.md) — GitHub `ajeonsu/avatifi` · Vercel `taoyagi-4963s-projects` · Supabase `qxzftftbvgysgzhqgfoz`

## Rules
- Preserve existing Vue UI / workflows (no Next.js UI rewrite unless boss asks).
- No production cutover and no paid add-ons without boss confirmation.
- Schema SQL here is a **DRAFT** until live spreadsheet export is available.

## Layout
```
avatifi-crm-migration/
  public/index.html               # Vue UI from pack; API_URL=/api/crm
  api/crm.js                      # Vercel serverless (501 or CRM_MOCK)
  api/mockStore.js                # sample in-memory handlers
  scripts/smoke-mock-api.js
  vercel.json
  docs/
    ACCESS-REQUEST.md
    HYBRID-INTEGRATIONS.md        # P0.5 Forms/Drive/Claude recommendation
    LOCAL-PREVIEW.md
    API-AND-ENTITY-INVENTORY.md
  supabase/migrations/
    20261127_avatifi_schema_draft.sql
  src/api/crmDispatch.ts
  src/config/featureFlags.ts
  src/domain/crmConstants.ts
```

## Capydo
- Project: Forspect
- Estimate: **TSK-01-012** (done)
- Implementation: **TSK-01-013** In progress (due 2026-12-11)

## Local commands
```bash
npm run preview:mock      # pack harness :8780
npm run test:mock-api     # CRM_MOCK handlers smoke
```
PowerShell Vercel mock: `$env:CRM_MOCK="1"; npx vercel dev`

## Next (Phase 0 blockers)
1. Spreadsheet export or shared copy  
2. Drive / Forms / Claude access notes + hybrid confirm (`docs/HYBRID-INTEGRATIONS.md`)  
3. Who owns Vercel + Supabase projects  

