# TRONX Menu Import Engine

**Status:** Phase 2 implemented (working end-to-end)  
**Admin entry:** `/admin/{slug}/menu/import` (PRO / ENTERPRISE via `MENU_IMPORT`)

## Architecture

Hybrid pipeline:

1. **Deterministic parse** (`lib/menu-import/parse-workbook.ts`) — SheetJS reads display values only (`cellFormula: false`).
2. **Header normalization + fuzzy synonyms** (`map-columns.ts`) — maps columns to a canonical schema with confidence scores; detects Half/Full/Regular/Large/Family as variant price columns.
3. **Row inference** (`infer-rows.ts`) — category header rows, items, variants, add-ons; never invents prices.
4. **Existing menu matching** (`match-existing.ts`) — SKU/slug + name/category similarity; strategies `CREATE_ONLY`, `UPDATE_MATCHING`, `SMART_MERGE`.
5. **Admin approval** — editable preview; only `included` rows without errors commit.
6. **Deterministic writes** (`commit-import.ts`) — creates categories/dishes; variants become required **Size** addon groups (compatible with current QR ordering). Compensating **rollback** supported.

AI semantic layer today = synonym dictionaries + fuzzy matching + confidence. Optional LLM refinement can be plugged in later without allowing the model to write to MongoDB.

## Data model (additive)

- `dishes.sku` (optional, sparse index with restaurantId)
- Collection `menuImportJobs` — file metadata, sheet samples, mappings, preview, result, rollback snapshot (raw grids cleared after success/cancel)

## API (restaurant admin + MENU_IMPORT)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/menu-import` | History / upload |
| GET | `/api/admin/menu-import/template` | Sample CSV |
| GET | `/api/admin/menu-import/[jobId]` | Job status |
| POST | `/api/admin/menu-import/[jobId]/analyze` | Select sheet |
| PATCH | `/api/admin/menu-import/[jobId]/mapping` | Confirm mapping + strategy |
| PATCH | `/api/admin/menu-import/[jobId]/preview` | Edit preview rows |
| POST | `/api/admin/menu-import/[jobId]/commit` | Approve & write |
| POST | `/api/admin/menu-import/[jobId]/cancel` | Cancel or `{ rollback: true }` |

## Safety

- Tenant scoped (`requireRestaurantAdmin` + restaurantId on every job query)
- 8 MB upload limit; extension allow-list; formula execution disabled
- No silent overwrites (`CREATE_ONLY` skips matches; Smart Merge requires explicit include)
- Rollback removes created dishes/addons/categories (empty only) and restores updated dish snapshots

## Tests

`tests/menu-import.test.ts` — header mapping, variants, strategies, xlsx parse, malformed prices.
