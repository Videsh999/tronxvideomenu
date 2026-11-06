# Captain POS Implementation Report

## Summary

Captain Portal now includes a full POS-style ordering module for assigned tables: menu browse, variants/add-ons, per-table carts, coupons/discounts (permission-gated), **Place order & send to kitchen**, optional payment recording, bills list, and admin permission controls. Admin POS cart/payment overlap is repaired.

## Delivered

| Area | Status |
|------|--------|
| Captain POS UI (`CaptainOrderPad`) | Done — table-isolated carts, coupon/discount, place+KOT, pay |
| Shared order pipeline (`createPosOrder` / append) | Done — CAPTAIN_DIRECT, no second approval |
| Additional-item KOT | Done — `appendItemsToOrder` enqueues KOT |
| Permissions model + admin editor | Done — server-enforced |
| Bills & payments page | Done — `/captain/[slug]/bills` |
| Admin POS layout repair | Done — independent scroll regions |
| Nav | Done — POS + Bills |

## Key paths

- `components/captain/CaptainOrderPad.tsx`
- `app/captain/[slug]/take-order/page.tsx` (+ `/pos` alias)
- `app/api/captain/orders/route.ts`
- `lib/captain-permissions.ts`
- `components/admin/PosTerminal.tsx`
- `components/admin/CaptainManagement.tsx`

## Authorization rule

Captain-entered orders use `CAPTAIN_DIRECT` → `CAPTAIN_APPROVED`. QR orders may still require Approvals. No second captain approval for captain POS submits.
