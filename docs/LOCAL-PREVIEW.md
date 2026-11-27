# Local preview (no Google / no paid cloud)

## A) Full CRM mock (recommended for parity smoke)

Uses the client pack’s own harness: fake Sheets + real `依頼台帳.gs` / `営業.gs` in a VM.

```bash
cd avatifi-crm-migration
npm run preview:mock
```

Open the printed `http://127.0.0.1:8780/#k=…` link (passphrase is local-only).

Netlify-shaped POST path (same as Vercel UI → `/exec`):

```bash
npm run preview:mock:netlify
```

**Does not** touch production Sheets/Drive. Sample names only (見本…).

## B) Vercel shell (UI + `/api/crm`)

```bash
npx vercel dev
```

Default: `/api/crm` returns **501** until Supabase handlers land.

**Local sample API** (no Google / no Supabase):

```powershell
$env:CRM_MOCK="1"; npx vercel dev
```

Or unit-smoke without Vercel:

```bash
npm run test:mock-api
```

Do **not** set `CRM_MOCK=1` on a shared/production Vercel project.  
Do **not** `vercel --prod` without boss OK on project ownership.

## Hybrid Forms / Drive / Claude

See `docs/HYBRID-INTEGRATIONS.md` (P0.5 recommendation — await boss confirm).

## Baseline timings

- Pack mock (A): `docs/baseline-mock-2026-11-27.json` (sample DB).
- Prod Sheets baseline: still blocked on access.
- Compare later to Vercel+Supabase preview.
