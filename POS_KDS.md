# Phase 3 — POS, Billing & Kitchen Display

Shared menu + order architecture for QR ordering and staff POS. Historical bills store immutable item/price/tax snapshots; later menu edits do not rewrite past tickets.

## Feature flags

| Key | Plan default | Surfaces |
|-----|--------------|----------|
| `POS` | PRO, ENTERPRISE | `/admin/[slug]/pos`, `/api/pos/**` |
| `KITCHEN_DISPLAY` | PRO, ENTERPRISE | `/admin/[slug]/kitchen`, `/api/kitchen/**` |

## Menu foundation

- Dishes support optional first-class `variants[]` (name, price, availability, sku).
- Existing Size **addon groups** remain valid for QR; POS prefers variants when present.
- Categories/dishes may set `kitchenStation`: `MAIN` | `BAR` | `BAKERY` | `DESSERT` | `OTHER`.
- Restaurant `billing.taxRatePercent` / `taxLabel` drive server-side tax on create.

## Unified orders

Channel: `QR` | `POS_DINE_IN` | `POS_TAKEAWAY` | `POS_DELIVERY`  
Source: `QR` | `POS`

On create, each line snapshots dish name, variant, addons, unit price, item discount, kitchen station, and line total. Bill stores `subtotal`, `billDiscountAmount`, `taxRatePercent`, `taxAmount`, `total`.

State machine (`lib/order-transitions.ts`):

`PENDING → ACCEPTED → PREPARING → READY → SERVED → COMPLETED`  
Also: reject/cancel from early states; `COMPLETED → REFUNDED`. Invalid transitions return 409.

Payments are ledgered server-side (`CHARGE` / `REFUND`). Partial payments allowed. Refunds require restaurant admin. Returning to a “success” page never marks payment paid—only authenticated staff recording APIs do.

## POS

- Touch UI: channel, table (dine-in), search, categories, variants/modifiers, qty, notes, item/bill discounts, tax preview, cash/UPI/card, partial pay.
- Shift open/close with cash reconciliation (`openingFloat`, expected cash from ledger, counted cash).
- Receipt reprint writes `receiptReprintLogs` + order event.

## Kitchen display

- Polls `/api/kitchen/orders` every 4s (reconnect/recovery on error).
- Station filter, age/priority/delayed badges, start/item-ready actions, fullscreen + sound.
- Item prep updates push order events; all items ready can promote order to `READY`.

## Security notes

- Tenant scoped by session `restaurantId`.
- POS/KDS gated by feature flags + auth (admin or captain with order management).
- Refunds: admin only.
- Idempotency keys on POS/QR create prevent duplicate tickets.
