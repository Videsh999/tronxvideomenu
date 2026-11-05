# Phase 4.1 Report — Production Readiness & Data Integrity

**Date:** 2026-11-05  
**Nature:** Hardening milestone (not a greenfield rewrite)

---

## 1. Existing issues discovered (audit)

| Issue | Severity |
|-------|----------|
| No org/outlet RBAC beyond session `restaurantId` | Critical |
| Inventory consume/restore whole-order only; no per-line cancel restore | Critical |
| Stock deductions not conditionally atomic when enforcing stock | Critical |
| No Mongo transaction helper; multi-doc ops idempotency-only | High |
| PO receive lacked ordered-qty over-receive guard | High |
| POS not wired to coupon/loyalty services | High |
| Recipe / full PO / org dashboard UIs incomplete | Medium |
| Central menu sync missing | Medium |
| `PROJECT_AUDIT.md` still described multi-outlet as absent in §2 | Docs drift |

Checklist: `PHASE_4_1_CHECKLIST.md`

---

## 2. Changes implemented

### RBAC (Completed and tested — unit)
- `OrgRole`: `ORG_OWNER` | `ORG_ADMIN` | `OUTLET_MANAGER` | `OUTLET_STAFF`
- Additive fields on `RestaurantAdminAccount`: `organizationId`, `orgRole`, `outletIds`
- `lib/org-rbac.ts` permission matrix + `assertOutletPermission` / `resolveAccessibleOutletIds`
- `requireOutletPermission` in `lib/admin-api.ts` — **never trusts client outlet/org ids without server check**
- Inventory ingredient routes + procurement receive use outlet permission gates

### Inventory integrity (Completed and tested — unit)
- Consumption lines now carry `orderLineId` + `restoredQuantityBase`
- Status `PARTIALLY_RESTORED`
- `enforceStock` setting → atomic `$inc` with `quantityOnHand: { $gte: needed }`
- `restoreForCancelledLines` + `lib/inventory/line-restore.ts` (unrelated lines never restored; prepared lines blocked)
- Movement insert failure compensates stock reverse

### Procurement (Completed and tested — unit/service logic)
- Over-receive blocked vs ordered quantity
- Receive UI with confirmation on procurement page

### Mongo consistency (Implemented; env-dependent for real tx)
- `lib/db/mongo-tx.ts` `withOptionalTransaction` — uses transactions when replica set supports them; otherwise idempotent compensating mode
- Strategy table below

### POS coupon / loyalty (Completed; integration via createPosOrder)
- Server-side coupon preview + redeem; loyalty redeem via ledger
- Snapshots: `couponCodeSnapshot`, `couponDiscountAmount`, `loyaltyPointsRedeemed`, `customerId`
- POS UI: phone, coupon, redeem points

### UIs
- Recipe editor `/admin/[slug]/inventory/recipes`
- Procurement PO create + receive
- Organization dashboard `/admin/[slug]/organization`
- POS loyalty/coupon fields

### Central menu sync (Completed foundation)
- `MenuSyncJob` model + `menuSyncService` preview/publish
- Preserves branch `price` / `isAvailable` / `sortOrder` / `kitchenStation` by default
- API `/api/organization/menu-sync`

---

## 3. Files / models modified (high level)

- `types/index.ts`, `lib/db/models.ts`, `lib/org-rbac.ts`, `lib/admin-api.ts`
- `lib/inventory/*`, `lib/services/inventory.service.ts`, `lib/repositories/inventory.repository.ts`
- `lib/services/order.service.ts`, `lib/services/procurement.service.ts`, `lib/services/menu-sync.service.ts`
- `lib/db/mongo-tx.ts`, `lib/crm/loyalty.ts` (existing)
- Admin components: RecipeEditor, ProcurementManager, OrganizationDashboard, PosTerminal, AdminSidebar
- APIs under `/api/inventory`, `/api/procurement`, `/api/organization/menu-sync`

---

## 4. API routes added/changed

| Route | Change |
|-------|--------|
| `GET/POST /api/inventory/ingredients` | Outlet permission + optional `outletId` query/body |
| `POST .../purchase-orders/[poId]/receive` | `OUTLET_PROCUREMENT_RECEIVE` |
| `POST /api/pos/orders` | Coupon/loyalty via `createPosOrder` body fields |
| `GET/POST /api/organization/menu-sync` | New |

---

## 5. RBAC permission matrix

| Permission | ORG_OWNER | ORG_ADMIN | OUTLET_MANAGER | OUTLET_STAFF | Legacy admin (no orgRole) |
|------------|-----------|-----------|----------------|--------------|---------------------------|
| ORG_MANAGE | ✓ | | | | session outlet only |
| ORG_ATTACH_OUTLET | ✓ | ✓ | | | |
| ORG_VIEW_REPORTS | ✓ | ✓ | | | |
| ORG_MENU_SYNC | ✓ | ✓ | | | |
| ORG_TRANSFER_STOCK | ✓ | ✓ | | | |
| OUTLET_INVENTORY_* | ✓ | ✓ | assigned | assigned (limited) | session restaurant |
| OUTLET_PROCUREMENT_WRITE | ✓ | ✓ | assigned | | session |
| OUTLET_PROCUREMENT_RECEIVE | ✓ | ✓ | assigned | ✗ | session |
| OUTLET_CRM_WRITE | ✓ | ✓ | assigned | | session |
| OUTLET_REPORTS_READ | ✓ | ✓ | assigned | assigned | session |

Captain ≈ OUTLET_STAFF for inventory read/write + reports only.

---

## 6. MongoDB consistency strategy

| Workflow | Strategy |
|----------|----------|
| Inventory movement | Unique `idempotencyKey`; atomic stock `$inc`; compensate on movement insert failure |
| Order consumption | Unique consumption key `consume:{orderId}`; per-ingredient/line movement keys |
| Line restore | `restore-line:{orderId}:{lineId}:{ingredientId}` |
| PO receive | Receipt id + `recv:{receiptId}:{ingredientId}`; ordered-qty validation |
| Stock transfer | Existing `xfer-out/in:{transferId}:{ingredientId}` |
| Loyalty | Unique `idempotencyKey` on loyaltyTransactions |
| Coupon redeem | Redemption count increment (duplicate POS order blocked by order idempotency first) |
| Multi-doc optional tx | `withOptionalTransaction` — TRANSACTION if supported else IDEMPOTENT_COMPENSATING |

**Standalone MongoDB (typical local / some PaaS):** transactions unavailable → compensating/idempotent path.  
**Replica set / Atlas:** transactions used when `withOptionalTransaction` callers adopt it (helper ready; not every path fully wrapped yet — see gaps).

---

## 7. Inventory lifecycle & restoration policy

1. Consume at `inventorySettings.consumptionPoint` (default PREPARING), once per order.
2. Lines tagged with `orderLineId`.
3. Full cancel: existing whole-order restore if gate + no prep started.
4. Partial cancel: `restoreForCancelledLines` restores only eligible cancelled lines; prepared lines never auto-restored.
5. Refunds do **not** auto-restore stock.
6. `enforceStock: true` fails concurrent oversell with insufficient-stock error.

---

## 8. Coupon & loyalty behavior

- Discount amounts never trusted from client.
- Coupon eligibility + limits validated server-side; snapshot stored on order.
- Loyalty redeem uses ledger; insufficient points → 400.
- Duplicate POS submit: order idempotency key returns existing order without re-redeeming.

---

## 9. UI workflows completed

- Recipe editor with cost/margin estimates  
- PO create + receive with confirm  
- Organization dashboard + outlet cards  
- POS phone / coupon / points  

---

## 10. Test commands & results

| Command | Result |
|---------|--------|
| `npm test` | **95/95 pass**, 0 fail, 0 skipped |
| `npm run typecheck` | **pass** (`tsc --noEmit`) |
| `npm run build` | **pass** (Next.js 16.3.6 production build) |

No tests were deleted or weakened. Live Mongo concurrency races remain env-dependent (not skipped — not present as integration tests).

---

## 11. Remaining gaps

| Item | Class |
|------|-------|
| Assign orgRole/outletIds via Super Admin UI | Deferred |
| Wrap every multi-doc path in `withOptionalTransaction` | Implemented helper; not fully wired everywhere |
| Live concurrent DB race integration tests (need Mongo) | Deferred / env-dependent |
| Coupon redemption atomic vs maxRedemptions under extreme concurrency | Partial (count increment, not conditional) |
| Menu sync rollback of dish payloads | Deferred (status ROLLED_BACK field only) |
| Per-line cancel exposed as first-class POS/API UX | Service ready; dedicated route/UI thin |
| Independent security/compliance review | Not claimed |

---

## 12. Deployment / migration

- Additive schema fields only — no destructive migrations.
- Deploy app; existing documents continue to work with defaults.
- To enable stock enforcement: set `restaurant.inventorySettings.enforceStock = true`.
- To enable org RBAC: set admin `organizationId`, `orgRole`, optional `outletIds`.
- Feature flags unchanged: INVENTORY / PROCUREMENT / CRM_LOYALTY / MULTI_OUTLET.

## 13. Rollback / recovery

- Revert deploy; additive fields remain harmless.
- Incomplete inventory ops: inspect `inventoryMovements` + `inventoryConsumptions` by `idempotencyKey` / `orderId`; compensate with ADJUSTMENT/WASTAGE.
- Failed PO receive: movements keyed by receipt id — safe to retry same receipt key.
- Menu sync: re-publish from source or manually edit branch dishes; preserved fields were not overwritten.
