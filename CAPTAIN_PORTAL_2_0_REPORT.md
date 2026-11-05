# Captain Portal 2.0 — Delivery Report

**Date:** 2026-11-05  
**Scope:** Visible captain console rebuild + table workspace + billing settings milestone (coordinated with Part B).

## What changed in the UI (required)

| Route | Before | After |
|-------|--------|-------|
| `/captain/[slug]` | Greeting + 3 cards + Order queue / Tables links | Dark hero floor console, live DB metrics, quick actions, my-tables + attention panels |
| `/captain/[slug]/tables` | Read-only status cards (“availability… read-only”) | Interactive **My Tables** grid → workspace links, amounts, kitchen/payment chips |
| `/captain/[slug]/tables/[tableId]` | Missing | Full table workspace: order, add items, KOT link, requests, bill, cleaning |
| Nav | Dashboard · Take order · Orders · Tables | Dashboard · My Tables · New Order · Active · Kitchen · Requests · Shift |
| `/captain/.../kitchen` | Missing | KOT/prep status for assigned tables |
| `/captain/.../requests` | Missing | Acknowledge / complete guest requests |
| `/captain/.../shift` | Missing | Today’s sales snapshot (read-only) |

## Backend wiring

- Captain place order still uses `orderService.createPosOrder` (shared with POS).
- Active table orders **append items** via `appendItemsToOrder` (idempotent).
- Floor actions: `PATCH /api/captain/tables/[tableId]`.
- Service requests: `/api/captain/requests`.
- Billing: Admin `/admin/[slug]/settings/billing` + shared `calculateRestaurantBill`.

## Acceptance checklist (captain)

1. Portal visibly redesigned — **yes**
2. Tables interactive — **yes**
3. Order without phone — **yes** (phone optional)
4. Add items to existing order — **yes** (auto-append)
5. KOT/KDS path — captain send-to-kitchen / prep statuses (existing pipeline)
6. Table assignment — Admin Captains (prior + exclusive assign)
7. Customer requests — **yes**
8. Bill handoff — REQUEST_BILL + service request BILL
9. Shared order service — **yes**

## Tests executed

| Suite | Result |
|-------|--------|
| `tests/billing-calculator.test.ts` | **12 pass / 0 fail** |
| `tests/captain-order-schema.test.ts` + `captain-assignment.test.ts` | **5 pass / 0 fail** |

## Limitations

- Screenshots not embedded in git; capture from local `/captain/...` and `/admin/.../settings/billing` after login.
- Guest count on order is not yet patched via SET_GUEST_COUNT (UI collects; note/request path works).
- Shift summary is calendar-day based, not POS shift clock-in.
- Full-project `tsc` hung in this environment when the Next plugin/`@types` resolution stalled; billing unit suite and scoped edits were verified instead. Re-run `npm run typecheck` / `npm run build` locally.
- Demo restaurant seed for “TRONX Captain & Billing Demo” should be run via existing demo seed scripts when Atlas is available.
