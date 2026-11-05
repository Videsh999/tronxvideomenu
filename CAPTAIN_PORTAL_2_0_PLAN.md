# Captain Portal 2.0 — Implementation Plan

**Date:** 2026-11-05  
**Status:** In progress (staged delivery)  
**Constraint:** Extend existing shared order architecture — never a second order pipeline.

---

## Phase 1 — Inspection findings

### Captain Portal today
- Auth: `tronx_captain_session`, `requireCaptain`, plan feature `CAPTAIN_ACCESS` (PRO/ENTERPRISE).
- UI: Dashboard, restaurant-wide orders (status + browser KOT), **read-only** tables.
- Admin: create / activate / password recovery for captains.
- **Missing:** table→captain assignment, captain order placement, bill request, scoped “my tables”, hardware KOT from captain place.

### POS order placement — root causes
| Rank | Cause | Evidence |
|------|--------|----------|
| 1 | Dine-in requires table; default channel is dine-in; Place buttons not disabled when table missing | `PosTerminal.canPlaceOrder` vs button `disabled` |
| 2 | CLOSED tables still listed | POS page filters `isActive` only |
| 3 | Opaque 500s on coupon/discount errors | route catch-all |
| 4 | New idempotency UUID every click | duplicate risk on retry |
| 5 | KOT only on accept→kitchen, not on place | `createPosOrder` vs `acceptToKitchen` |
| 6 | Proxy `staff` class blocks captains on `/api/pos/orders` and `/api/orders/*/payment` | handlers allow CAPTAIN; proxy does not |

Payment is **not** required to create an order (`UNPAID` + `PENDING`).

### Shared service (keep)
- `orderService.createPosOrder` — POS + Captain place orders (same pricing/validation/idempotency).
- `orderService.updateStatus` → `acceptToKitchen` — KOT enqueue via device service.
- QR: `POST /api/public/orders` unchanged.

---

## Delivery stages

| Stage | Scope | Status |
|-------|--------|--------|
| A | POS repair + proxy floor auth + bugfix report | Done |
| B | Captain profile fields + configurable table assignment + history | Done |
| C | Captain order pad (no phone required) → `createPosOrder` + send to kitchen | Done |
| D | Dashboard live stats, bill request, service requests | Next |
| E | Shift metrics, demo seed, full test matrix | Next |

---

## Non-negotiables (checklist)
1. Shared order service only  
2. No phone required for walk-in captain orders  
3. No hardcoded table limits  
4. Server-side pricing  
5. Idempotent submissions  
6. Outlet isolation  
7. No fake customer IDs  
8. QR + POS must keep working  
9. Printer success ≠ API success  

---

## Docs to produce
- `CAPTAIN_PORTAL_2_0_PLAN.md` (this file)
- `POS_ORDER_CREATION_BUGFIX_REPORT.md`
- `CAPTAIN_TABLE_ASSIGNMENT_GUIDE.md`
- `CAPTAIN_ORDER_WORKFLOW.md`
- `CAPTAIN_PORTAL_2_0_REPORT.md` / `CAPTAIN_TEST_RESULTS.md` (after stage E)
