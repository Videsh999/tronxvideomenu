# POS order creation — bugfix report

**Date:** 2026-11-05  
**Related:** Captain Portal 2.0 Stage A

## Defects found

1. **Dine-in without table** — Default channel `POS_DINE_IN` requires a table, but Place buttons only checked shift + cart. Users could tap Place and get a status message with no clear disable state.
2. **CLOSED tables in dropdown** — POS page listed inactive-open tables and CLOSED ones if still `isActive`.
3. **Idempotency** — New UUID every submit → retries after timeout could create duplicates.
4. **Stale shift** — After close elsewhere, UI kept shift until opaque failure.
5. **Proxy blocked captains** on `/api/pos/orders` and `/api/orders/*/payment` (`staff` class) even though handlers allowed CAPTAIN.
6. **KOT timing** — Place creates `PENDING`/`UNPAID`; KOT runs on accept→kitchen (by design). Captain place now auto-advances to PREPARING when `sendToKitchen` is true.

## Fixes shipped

| Fix | File(s) |
|-----|---------|
| Disable Place when `canPlaceOrder()` fails; show amber hint | `PosTerminal.tsx` |
| Filter `status !== "CLOSED"` | `app/admin/[slug]/pos/page.tsx` |
| Reuse in-flight idempotency key; rotate after success | `PosTerminal.tsx` |
| Clear local shift on “shift is not open” | `PosTerminal.tsx` |
| Proxy class `floor` for POS create + payment + cancel-lines | `lib/api-authz.ts` |
| Captain place via shared `createPosOrder` | `app/api/captain/orders/route.ts` |

## Verification

- Schema: dine-in without table still rejected server-side (`placePosOrderSchema`).
- Create remains payment-independent (`UNPAID`).
- QR public orders unchanged.
