# Deployment targets (confirmed 2026-11-27)

| Resource | URL / ref | Notes |
|----------|-----------|--------|
| GitHub | https://github.com/ajeonsu/avatifi | Public repo — **empty** as of 2026-11-27; scaffold will be pushed here |
| Vercel team | https://vercel.com/taoyagi-4963s-projects | Host Vue UI + `/api/crm` preview |
| Supabase project | https://supabase.com/dashboard/project/qxzftftbvgysgzhqgfoz | Project ref `qxzftftbvgysgzhqgfoz` · API host `https://qxzftftbvgysgzhqgfoz.supabase.co` |

## Rules
- Use these for migration preview work.
- Do **not** apply destructive schema or production cutover without boss confirmation.
- Do **not** put secrets in git; use Vercel/Supabase env + `.env.example` names only.
- Hybrid Forms/Drive/Claude still needs IDs (see `ACCESS-REQUEST.md` / `HYBRID-INTEGRATIONS.md`).
