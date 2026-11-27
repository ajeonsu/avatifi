# Avatifi CRM — Access request (Phase 0)

**To:** Boss / Forspect  
**From:** AJ  
**Date:** 2026-11-27  
**Why:** Full Vercel + Supabase migration is approved; pack has code only. Need the following to finish discovery, lock ETA, and start preview work.

## Please provide

| # | Item | Why | Status |
|---|------|-----|--------|
| 1 | Google Spreadsheet「依頼台帳」 — view access **or** full export (all tabs) | Schema finalize + data migration + integrity checks | **Needed** |
| 2 | Google Drive root / customer folder notes (IDs OK) | Delivery folders + customer file links | **Needed** |
| 3 | Google Forms (依頼 / 録音) IDs or owner access | Form → request automation | **Needed** |
| 4 | Apps Script: how Claude webhook / `API_TOKEN` is used (no secret in chat — share via secure channel) | Keep production automation during hybrid v1 | **Needed** |
| 5 | Capydo **implementation** task link (estimate was `TSK-01-012`) | Scope alignment | **Done** — `TSK-01-013` In progress |
| 6 | Who creates/owns **Vercel** + **Supabase** projects (and billing) | Preview deploy; no paid add-ons without your OK | **Done** — see below |
| 7 | Current Netlify (or public) CRM URL for baseline timing | Before/after perf | Nice to have |

## Confirmed targets (2026-11-27)

| Resource | Target |
|----------|--------|
| GitHub | https://github.com/ajeonsu/avatifi |
| Vercel | https://vercel.com/taoyagi-4963s-projects |
| Supabase | https://supabase.com/dashboard/project/qxzftftbvgysgzhqgfoz (`qxzftftbvgysgzhqgfoz`) |

Details: `docs/TARGETS.md`

## Already have
- Deploy pack `Avatifi管理システム_デプロイ用_20261125` (Vue UI + GAS + offline tests)
- GitHub / Vercel team / Supabase project links (above)

## Constraints we will follow
- Preserve UI / workflows  
- No production cutover without your confirmation  
- No extra paid services without your confirmation  

## After access
Confirm preview ETA (currently ~2027-01-23 if access arrives this week).

## Progress note (2026-11-27)

Supabase-backed preview is live at https://avatifi.vercel.app/ (`#k=avatifi-preview-key-2026-ok`). Core CRM + settings/people/card/history + auto tasks work on Postgres.

**Item 1 is the critical path** for data integrity / migration: please export or share 依頼台帳 (all tabs as CSV/XLSX is fine). Compare tool is ready: `npm run integrity:sheets -- <export-folder>` (expects `商談.csv` / `顧客.csv` / `依頼.csv` …).

Remaining blockers for full parity: **items 1–4** (sheet export, Drive, Forms, Claude notes). No production cutover and no paid add-ons without your OK.
