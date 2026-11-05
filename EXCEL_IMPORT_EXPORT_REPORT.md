# Excel Import / Export Report

**Date:** 2026-11-05

## Findings

| Item | Status | Notes |
| --- | --- | --- |
| Menu import wizard | Present | XLSX / XLS / CSV via `MenuImportWizard` |
| Empty optional cells | Fixed earlier | `normalizeOptionalString` → `undefined`, not `null` |
| Sample template download | Working | `/api/admin/menu-import/template` (CSV) |
| Catalogue export | **Was missing** | Only sample template existed |

## Fixes in this audit

1. Added `lib/menu-export/build-workbook.ts`
   - Exports Menu + Categories sheets
   - Half/Full variants, dietary, SKU, availability, add-ons summary
   - Formula-injection sanitization for cells starting with `= + - @`
2. Added `GET /api/admin/menu-export?format=xlsx|csv` (auth required)
3. UI entry points:
   - Dishes manager → **Export Excel**
   - Import wizard → **Export current menu**
4. Automated tests: `tests/menu-export.test.ts` (4 passing)
5. Demo workbook: `fixtures/tronx-demo-kitchen-menu.xlsx` (80 menu rows + Negative-Tests sheet)

## Verification evidence

- Unit tests for row shape, xlsx round-trip, CSV headers, formula sanitization: **pass**
- Unauthenticated export request returns **401/403** (auth gate intact)
- Fixture workbook parses through import pipeline (`Menu` sheet → drafts)

## Remaining limitations

- Orders / inventory / CRM exports are not implemented as spreadsheet downloads yet (diagnostics JSON export exists for devices).
- Agent shell could not seed Mongo Atlas in this session (SRV DNS refused); seed script is ready for local run.
