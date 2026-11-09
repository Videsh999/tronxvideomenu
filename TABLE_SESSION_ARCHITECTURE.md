# Table Session Architecture

## Aggregate boundaries

`TableSession` is the stable visit identity. It is scoped by `restaurantId` and `serviceLocationId`; table numbers are snapshots only. A partial unique index permits one `ACTIVE`, `BILLING`, or `PAYMENT_PENDING` session per location. Historical sessions remain immutable and queryable.

Every dine-in/room QR, Captain, and POS order stores `tableSessionId`. Orders remain independent records with their existing status, events, KOT, inventory and payment snapshots. Legacy open orders are attached once when the first session is resolved.

`MasterBill` is an immutable versioned checkout snapshot. It references every included order and line using `orderId:lineId` allocation keys. A changed order fingerprint requires an explicit revision. Partial payment blocks revision to avoid moving a live payment target.

## Concurrency

- Active-session creation uses a database unique index and duplicate-key winner reload.
- Bill generation uses a Mongo transaction and expected latest version.
- Split configuration uses bill version and requires zero master payments.
- Payment recording compares bill version, previous amount paid and outstanding balance.
- Payment idempotency keys are stored in the bill ledger.
- Session closure requires `billingStatus=PAID` atomically.

## Security

Captain APIs re-check table assignment server-side. Restaurant/outlet IDs come from the authenticated session, never request bodies. Customer QR identity alone does not grant access to another party's private bill or payment ledger.

## Compatibility

Takeaway/delivery retain virtual-counter behavior and do not require table sessions. Existing per-order pricing, KOT, inventory, coupon, loyalty and payment services remain intact.
