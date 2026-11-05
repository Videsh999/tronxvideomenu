# TRONX Restaurant OS — Master Audit Plan

**Date:** 2026-11-05  
**Scope:** Production readiness audit of existing platform (Phases 0–6.3 preserved)  
**Environment:** Local / staging only — no production destructive tests

## Architecture snapshot

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, Tailwind 4 |
| Backend | Next.js route handlers, Zod validation |
| Data | MongoDB + Mongoose |
| Auth | Cookie sessions (restaurant admin / super admin / captain) + RBAC / feature flags |
| Hardware | Device fleet + local connector (SIMULATOR ≠ PHYSICALLY_VERIFIED) |
| Menu IO | Excel/CSV import wizard; export (being completed in this audit) |

## Critical defects (P0) — Stage 2

| ID | Defect | Evidence | Priority |
| --- | --- | --- | --- |
| P0-POS-OVERFLOW | POS order panel clipped beyond viewport | Screenshot `/admin/lilles/pos` | P0 |
| P0-MENU-EXPORT | No real catalogue export (only sample CSV template) | Code audit of `app/api/admin` | P0 |
| P0-THEME-CONTRAST | White theme text on white customer cards hid names/prices | Fixed earlier this session | P0 (done) |

## High defects (P1)

| ID | Area | Notes |
| --- | --- | --- |
| P1-IMPORT-EMPTY | Empty Description/SKU → null validation | Fixed in prior Excel import work; re-verify |
| P1-ADMIN-WIDTH | `max-w-6xl` on all admin pages starves POS/KDS | Fix immersive routes |
| P1-RESPONSIVE | Admin tables/POS not validated across breakpoints | Stage 3 |

## Module inventory (audit checklist)

- [ ] Auth / sessions / RBAC
- [ ] Dashboard metrics
- [ ] Menu: categories, dishes, add-ons, media, availability
- [ ] Excel import + export
- [ ] Customer QR menu + cart + order
- [ ] POS (layout, pay, shift)
- [ ] Kitchen / KDS
- [ ] Orders + payment ledger + refunds
- [ ] Inventory + recipes
- [ ] Procurement
- [ ] CRM / loyalty
- [ ] Reports / analytics
- [ ] Multi-outlet / organization
- [ ] AI intelligence
- [ ] Devices / connector / printers
- [ ] Tables & QR / reservations / captains

## Implementation stages

1. **Discovery** — this document  
2. **Critical defects** — POS overflow, menu export, import regression  
3. **UI / responsive** — shell, POS, key admin pages  
4. **Workflows** — import → menu → POS → order → reports  
5. **Demo restaurant** — TRONX Demo Kitchen + dummy workbook  
6. **Performance** — local concurrent benchmark (labeled as local)  
7. **Final regression** — typecheck, unit, integration, build + evidence reports  

## Non-negotiables honored

- No second order/payment pipeline  
- No Mongo replacement  
- No RBAC bypass  
- No false PHYSICALLY_VERIFIED claims  
- No fabricated test/performance numbers  
- Additive, backward-compatible changes  

## Deliverables (end of audit)

- `MASTER_AUDIT_REPORT.md`
- `MASTER_TEST_RESULTS.md`
- `RESPONSIVE_AUDIT_REPORT.md`
- `PERFORMANCE_BENCHMARK_REPORT.md`
- `SECURITY_AUDIT_REPORT.md`
- `EXCEL_IMPORT_EXPORT_REPORT.md`
- `DEMO_RESTAURANT_GUIDE.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `UI_UX_AUDIT_REPORT.md`
