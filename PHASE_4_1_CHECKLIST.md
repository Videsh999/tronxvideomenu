# Phase 4.1 Implementation Checklist (from audit)

## Critical findings
1. **RBAC gap:** Only SUPER_ADMIN / RESTAURANT_ADMIN / CAPTAIN. Org APIs trust session `restaurantId` but no org-role matrix; client can pass `organizationId` in some bodies.
2. **No Mongo sessions/transactions** anywhere in app code — multi-doc ops rely on unique idempotency keys only.
3. **Inventory:** Whole-order consume/restore only; no per-line cancel restore; no conditional stock guard against oversell.
4. **Procurement:** Partial receive exists; line over-receive / duplicate receive batch hardening incomplete.
5. **POS:** Coupon/loyalty services exist but not wired into `createPosOrder` / POS UI.
6. **UI gaps:** Recipe editor, full PO workflow, org dashboard deferred.
7. **Central menu sync:** Not implemented.

## Prioritized work
1. Org/outlet RBAC helpers + membership model + API guards + isolation tests
2. Inventory per-line cancel + atomic stock + idempotent consume/restore tests
3. Mongo tx helper (optional) + procurement/transfer receive guards
4. POS coupon/loyalty server pipeline + UI
5. Recipe / PO / org dashboard UIs
6. Central menu publish with branch override preservation
7. Full test / typecheck / build + PHASE_4_1_REPORT
