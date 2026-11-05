# Excel Menu Import Bugfix Report

**Date:** 2026-11-05  
**Surface:** `/admin/[slug]/menu/import`  
**Trigger file:** `Triparna_Kitchen_Menu_By_Category.xlsx` (blank Description / SKU cells)

## Root cause

Two defects combined into the inconsistent UI seen in production-facing admin:

1. **Optional string schema rejected `null`.**  
   `PATCH /api/admin/menu-import/[jobId]/preview` used `z.string().optional()` for `description` and `sku`. Zod optional allows `undefined`, not `null`. After Mongo Mixed round-trips (or client JSON with explicit nulls), empty Excel cells resurfaced as `null` and failed validation with dozens of `expected string, received null` issues. Zod’s default `error.message` is a raw JSON dump of every issue.

2. **`savePreview()` swallowed failures before commit.**  
   `MenuImportWizard.commit()` always called `savePreview()` first. `savePreview` set the red error banner on failure but **did not rethrow**, so commit continued, created dishes, and showed **Import complete** while the Zod JSON dump remained on screen.

Blank Description/SKU were never business-rule failures; they were schema/transport failures.

## Fix summary

### Normalization (centralized)

- Added `normalizeOptionalString` / `normalizeRequiredString` in `lib/menu-import/normalize.ts`.
- Empty / null / undefined / whitespace → `undefined` for optional fields (no fake SKUs).
- Applied in row inference, draft normalization, preview PATCH preprocess, and client save payload.

### Validation

- Shared `importItemDraftSchema` with nullish preprocess (`lib/menu-import/item-schema.ts`).
- `validateImportItemDraft` / `summarizeValidation` classify blocking errors vs warnings (`lib/menu-import/validate-draft.ts`).
- Optional blanks never block; missing name/price/category do.
- API returns human-readable `formatImportZodError` — no raw Zod JSON to admins.

### Import completion logic

- Statuses extended: `VALIDATING`, `READY_TO_IMPORT`, `IMPORTING`, `COMPLETED_WITH_WARNINGS`, `PARTIALLY_COMPLETED` (legacy statuses retained).
- Commit blocked when included rows still have errors, or when zero valid rows selected.
- Result payload includes `totalRows`, `validRows`, `invalidRows`, `failedRows`, `warningCount`.
- Final status derived from actual created/updated vs intended and failures.
- Wizard `savePreview` now **rethrows**; success banner only for successful terminal statuses.

### UI

- Expandable validation summary (error/warning counts, row-level messages).
- Done state distinguishes complete / with warnings / partial / failed.
- History shows human status labels and invalid counts when present.

## Files changed

| File | Change |
|------|--------|
| `lib/menu-import/normalize.ts` | Optional/required string normalization |
| `lib/menu-import/item-schema.ts` | **New** — Zod schemas + format helper |
| `lib/menu-import/validate-draft.ts` | **New** — field-level validation |
| `lib/menu-import/infer-rows.ts` | Use optional normalization + validate |
| `lib/menu-import/match-existing.ts` | Warning count in summary |
| `lib/menu-import/commit-import.ts` | Richer commit result counters |
| `lib/menu-import/types.ts` | Status + result fields |
| `lib/db/import-job-model.ts` | Status enum expanded |
| `lib/services/menu-import.service.ts` | Status flow, blocking commit guards |
| `app/api/admin/menu-import/[jobId]/preview/route.ts` | Null-safe schema + readable errors |
| `app/api/admin/menu-import/[jobId]/mapping/route.ts` | Nullish `variantName` |
| `components/admin/MenuImportWizard.tsx` | Validation UX, savePreview rethrow, statuses |
| `tests/menu-import.test.ts` | Regression coverage |
| `EXCEL_IMPORT_BUGFIX_REPORT.md` | This report |

## Schema changes

- Job status enum: additive values only (backward compatible with existing jobs).
- Commit `result` Mixed document: additive count fields.
- No dish/category schema changes. Optional `description` / `sku` remain omit-or-string.

## Tests and verification

| Suite | Result |
|-------|--------|
| `tests/menu-import.test.ts` | **11 pass** (incl. empty description/sku, null round-trip, mixed invalid, create-only/smart-merge, excel/csv) |
| Full `npm run test:unit` | **166 pass / 0 fail** |
| `npm run typecheck` | **pass** |
| `npm run build` | **pass** |

## Follow-up fix (READY_TO_IMPORT enum)

After deploy of the optional-field fix, upload failed with:

`MenuImportJob validation failed: status: 'READY_TO_IMPORT' is not a valid enum value for path 'status'.`

**Cause:** Mongoose compiled model still had the old status enum (HMR/cache). New statuses were rejected at create time.

**Fix:** Removed the Mongoose `status` enum constraint; statuses are validated in the repository against `MENU_IMPORT_JOB_STATUSES`. Stale HMR models that still have an enum are rebuilt. Dev server restarted.

## Remaining limitations

- Empty **item name** rows are skipped entirely by the grid builder (not listed as invalid rows). Only rows with a name and bad price/category surface as invalid.
- Existing Native South import that already created 80 dishes was **not** rolled back by this fix (per instruction: do not delete those dishes during testing). Use the import history **Roll back** action for that job if desired.
- Physical Excel file `Triparna_Kitchen_Menu_By_Category.xlsx` was not re-uploaded in CI; behaviour is covered by equivalent empty Description/SKU fixtures through the same pipeline.

## Acceptance scenario (100 dishes, some blank description/SKU)

- Blank optional fields → no validation errors.
- Valid dishes import.
- Required-field errors reported with row numbers in a readable summary.
- No raw Zod JSON dump.
- Import counts match commit result / history.
- Rollback still limited to that job’s created/updated IDs.
