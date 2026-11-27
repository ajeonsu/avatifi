# Hybrid integrations (v1) — Forms / Drive / Claude

**Status:** AJ recommendation for Phase 0.5 — **await boss confirmation** before coding cloud adapters.  
**Rule:** No production cutover or paid Google/Supabase changes without boss OK.  
**Related:** Capydo `TSK-01-013`, plan §4 / §6 Phase 3, `ACCESS-REQUEST.md`.

---

## Decision (recommended)

Keep **Google Forms + Drive folder trees + Claude webhook** on GAS (or thin adapters) for **v1 preview**.  
Move **CRM CRUD / analytics / auth** to **Supabase + Vercel** first.

| Path | v1 | Later |
|------|----|-------|
| CRM `app*` (sales, cust, pay, tasks, KPI…) | Supabase | — |
| Request Form → new 依頼 row + folders | Keep Forms `onFormSubmit` → write Supabase (or dual-write) | In-app form |
| Recording Form | Keep Forms | In-app upload |
| Drive `ROOT_FOLDER` / `01_依頼` / `02_台本` / `03_納品` | Keep Drive IDs in `drive_links` | Supabase Storage |
| Claude `doPost` (`API_TOKEN`) | Keep webhook → adapter → Supabase requests | Same contract, new host |
| Business-card OCR | Defer or edge fn + vision API | Replace GAS OCR |

**Why hybrid:** Full Forms/Drive/Claude replacement in v1 adds ~1–3 weeks and needs live IDs/secrets we still lack. Hybrid ships CRM preview sooner with feature flags.

---

## Script properties (need from client — never paste secrets in chat)

| Property | Role |
|----------|------|
| `SPREADSHEET_ID` | Ledger workbook |
| `ROOT_FOLDER_ID` | Drive customer root |
| `FORM_ID` | 依頼 form |
| `REC_FORM_ID` | 録音 form |
| `API_TOKEN` | Claude automation (separate from user `#k=` passphrase) |
| `APP_KEY_*` | Per-user passphrase hashes / links (sales CRM) |

---

## Claude webhook contract (keep stable)

Source: `依頼台帳.gs` `apiHandle_` / `CLAUDE_STATUSES`.

**Auth:** POST JSON `{ token, action, … }` — token = `API_TOKEN` (not CRM `#k=`).

**Allowlisted statuses Claude may set:** `聞き返し中` · `台本づくり` · `社内確認待ち` · `納品済み`

**Actions (v1 adapter must support):**

| action | Purpose |
|--------|---------|
| `ping` | Health / request count |
| `list` / `get` | Read requests |
| `setStatus` | Status within Claude allowlist |
| `memo` | Append memo |
| `setEstimate` | `estUsd` / `estCr` |
| `setCustomerIds` | `avatar_id` / `voice_id` (overwrite flag) |
| `putFile` | Only folders `02_台本`, `03_納品` (≤30MB) |

CRM UI path remains `{ crm:1, fn, args }` — **do not mix** with Claude token.

---

## Feature flags (env)

Implement as env vars on Vercel / local `.env` (names only here):

| Flag | Default v1 | Meaning |
|------|------------|---------|
| `CRM_HYBRID_FORMS` | `1` | Forms submit → ledger adapter enabled |
| `CRM_HYBRID_DRIVE` | `1` | Resolve / attach Drive folder URLs |
| `CRM_HYBRID_CLAUDE` | `1` | Accept Claude webhook on adapter route |
| `CRM_REPLACE_FORMS` | `0` | In-app forms (Phase 2+) |
| `CRM_REPLACE_DRIVE` | `0` | Supabase Storage primary |
| `CRM_OCR_ENABLED` | `0` | Card OCR (defer until decided) |
| `CRM_MOCK` | `0` | Local in-memory `/api/crm` (no Google/Supabase) |

Code stub: `src/config/featureFlags.ts`.

---

## Adapter sketch (Phase 3 — do not deploy unpaid)

```
Google Form onFormSubmit  →  Vercel /api/integrations/forms  →  Supabase requests + drive_links
Claude POST               →  Vercel /api/integrations/claude →  same request mutations as apiHandle_
Drive folder create       →  optional GAS helper OR Drive API service account (needs ownership OK)
```

Until IDs/access arrive: use pack mock (`npm run preview:mock`) and `CRM_MOCK=1` on `vercel dev`.

---

## Boss ask (confirm)

1. Approve **hybrid v1** (yes/no). If no → re-estimate full Forms/Drive/Claude cut (+buffer).  
2. Provide items in `ACCESS-REQUEST.md` (sheet export, Drive/Form IDs, Claude notes, Vercel/Supabase owner).  
3. Confirm OCR: defer vs include in preview scope.
