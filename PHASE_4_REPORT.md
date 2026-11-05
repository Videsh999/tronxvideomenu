# Phase 4 Report — Inventory, Procurement, CRM & Multi-Outlet

**Date:** 2026-11-05  
**Status:** Foundation delivered; **Phase 4.1 hardening** documented in `PHASE_4_1_REPORT.md`.  
**Tests:** Run `npm test` (Phases 1–4.1 unit suites).

---

## What was implemented

### 1. Inventory
- Ingredient catalogue with base units + conversion map (`lib/inventory/units.ts`).
- Recipes mapped 1:1 to dishes; estimated recipe cost from average/last purchase cost.
- Inventory movement ledger with unique `idempotencyKey` (duplicate events are no-ops).
- Automatic consumption when an order reaches `inventorySettings.consumptionPoint` (default `PREPARING`), hooked from `order.service` status transitions.
- Idempotent consume key `consume:{orderId}`; restore key `restore:{orderId}`.
- Restoration rules: **no silent restore** after prep started or after `allowRestoreBefore` gate — records `BLOCKED_NO_RESTORE` instead.
- Adjustments, wastage, physical reconciliation, low-stock list, stock valuation.
- Admin UI: `/admin/[slug]/inventory`.

### 2. Procurement
- Suppliers, purchase orders, goods receipts.
- Receiving posts `PURCHASE_RECEIPT` movements and updates average unit cost.
- Outstanding POs + reorder suggestions from reorder levels.
- Admin UI: `/admin/[slug]/procurement` (supplier + list focused; PO create/receive via API).

### 3. Food cost / profitability
- `costRecipeLines`, `estimateDishMargin` clearly mark results as **estimated**, not verified accounting profit.
- API: `GET /api/inventory/profitability/[dishId]`.

### 4. CRM & loyalty
- Customer profiles (phone unique per restaurant), opt-in flags, segments field.
- Loyalty transactions with idempotent earn keys (`loyalty-earn:{orderId}`) — balances never change without a ledger row.
- Coupons + preview/redeem helpers; feedback collection.
- Admin UI: `/admin/[slug]/crm`.

### 5. Multi-outlet
- Additive `Organization` model; restaurants may set `organizationId`.
- Outlet listing, attach outlet, inter-branch stock transfers (same-org only).
- Outlet comparison reporting helper.
- Feature flag `MULTI_OUTLET` (ENTERPRISE).

### 6. Reporting
- Dashboard aggregating sales, inventory, purchases, retention (`/admin/[slug]/reports`, `/api/reports/dashboard`).
- Date-range parameters supported on sales/outlet comparison.

### Feature flags (additive)
| Key | Default plans |
|-----|----------------|
| `INVENTORY` | PRO, ENTERPRISE |
| `PROCUREMENT` | ENTERPRISE |
| `CRM_LOYALTY` | PRO, ENTERPRISE |
| `MULTI_OUTLET` | ENTERPRISE |
| `ANALYTICS` | ENTERPRISE (reports also usable with ORDER_MANAGEMENT) |

---

## Incomplete / deferred (honest)

| Area | Gap |
|------|-----|
| Recipe admin UI | Recipes saved via API; no dedicated visual recipe editor yet |
| PO create/receive UI | List + suppliers in UI; full PO line editor is API-first |
| Partial line cancellation restore | Whole-order restore rules only; per-line cancel inventory split not built |
| Loyalty earn on payment | Helper + ledger exist; POS/QR auto-earn wiring to customer phone is not fully productized |
| Coupon at POS checkout | Preview/redeem services exist; POS terminal not yet coupon-aware |
| Organization admin UI | API complete; no polished org dashboard page yet |
| Central menu / branch overrides | `organizationId` + transfers only; no central menu publish/sync |
| Branch employees / RBAC | Still SUPER_ADMIN / RESTAURANT_ADMIN / CAPTAIN — no org-level roles |
| Concurrent stock | Idempotent keys + unique indexes; not full transactional multi-doc Mongo sessions |
| Expiry workflows | Field + “expiring soon” report count; no auto-wastage jobs |
| Supplier performance scorecards | Purchase history available; dedicated KPI UI deferred |
| Customer retention deep cohort | Basic counts only |

---

## Integration rules followed
- Additive Mongo collections / restaurant fields only.
- Same `restaurantId` tenancy; org boundaries enforced on transfers.
- Order snapshots and POS/QR flows unchanged except optional inventory side effects (failures do not block kitchen status).
- Docs: this file + `PROJECT_AUDIT.md` updated.
