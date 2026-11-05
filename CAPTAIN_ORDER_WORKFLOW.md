# Captain Order Workflow

## Walk-in (no phone)

1. Captain opens **My Tables** → selects table → **New order** / **Add items**.
2. Order pad: categories, search, variants, add-ons, notes, cart.
3. Submit → `POST /api/captain/orders` (idempotency key).
4. Server validates table assignment + menu prices.
5. If table already has an open unpaid order → **append** items; else `createPosOrder`.
6. Totals from `calculateRestaurantBill` (same as POS/QR).
7. Optional send-to-kitchen → status `PREPARING` (KOT/KDS/device path unchanged).
8. Confirmation shown in pad / table workspace.

## Add items

- Same pad with `?table=N`.
- Append recalculates bill; new lines `QUEUED` for kitchen.
- Retry with same UUID does not duplicate lines.

## Bill handoff

- Workspace **Request bill** → table `BILL_REQUESTED` + BILL service request.
- Captain sees totals; settlement remains cashier/POS authorized payment APIs.
