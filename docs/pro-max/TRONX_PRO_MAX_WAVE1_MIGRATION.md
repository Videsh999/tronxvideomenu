# Wave 1 data changes

No collection is renamed or dropped. New fields are optional. Old documents stay valid.

## Deploy

1. Deploy the application. Mongoose accepts documents that do not yet have `version`, `gstRateSnapshot`, `billingSettingsSnapshot`, or `cancelledQuantity`.
2. Do not run a backfill during deploy. The first append or cancel of a legacy order freezes billing from its stored `billSnapshot` (see Reconciliation).
3. Confirm the unique indexes listed under Index check before taking payment traffic.

## Rollback

1. Roll the application back to the previous build.
2. Leave the new fields in place. The previous build ignores unknown strict-schema paths on write and does not require them on read.
3. Orders created by this build keep `billingSettingsSnapshot` and `version`. The previous build will not update `version`. After a rollback, do not run this build's cancel path against those orders until the forward build is restored.

## Reconciliation

Legacy mixed-rate orders have no `gstRateSnapshot` on some lines. Recompute uses the line snapshot when it exists, otherwise the order's stored `taxRatePercent`. It does not read the dish's current tax rate.

Legacy orders also have no `billingSettingsSnapshot`. Packaging and service charge are frozen as a fixed per-order amount equal to the amounts already stored on `billSnapshot`, with that snapshot's price mode and supply type. A later change to the outlet's packaging percent does not change an open legacy check.

`cancelledQuantity` was stripped by Mongoose strict mode before this wave. A line can have a lower `itemTotal` while `cancelledQuantity` is missing. Do not guess the quantity from the price. Compare `orderLineCancellations` for that order and line, sum `quantityCancelled` where `orderLineId` is the line, and set `cancelledQuantity` to that sum when the field is missing. Lines with no cancellation rows stay at 0.

## Captain table session

`tables.guestCount`, `tables.occupiedSince`, `tables.area`, and `tables.section` are optional. `order.items.kotNumber` is optional. No collection is renamed, no document is rewritten, and no index is added. Opening a table writes the guest count and the time. Freeing a table removes those two fields. Older documents without them still load.

## Index check

This wave does not create or drop indexes. Before deploy, confirm the existing unique indexes are present:

- `orders`: `{ restaurantId: 1, orderNumber: 1 }` unique, `{ restaurantId: 1, idempotencyKey: 1 }` unique
- `orderLineCancellations`: `{ restaurantId: 1, idempotencyKey: 1 }` unique

In mongosh, against the target database only:

```
db.orders.getIndexes()
db.orderLineCancellations.getIndexes()
```

If either unique index is missing, stop and create it before serving writes. Do not build it in the request path.

## Additive fields

| Place | Field | Old documents |
| --- | --- | --- |
| `orders` | `version` | Missing means 0. |
| `orders` | `billingSettingsSnapshot` | Missing uses the legacy freeze above. |
| `orders.items` | `gstRateSnapshot` | Missing uses `order.taxRatePercent`. |
| `orders.items` | `cancelledQuantity` | Missing means 0 until reconciliation. |
| `orders.payment.ledger` | `idempotencyKey` | Missing on old rows. New payments require one. |
| `orderLineCancellations` | `applyStatus` | Missing means the cancellation already applied. |

## Cancellation atomicity

The marker is inserted or updated to `APPLIED` in the same MongoDB transaction as the order totals, line rows, and `CANCELLED` status. A crash after the totals statement and before commit aborts the transaction, so the totals are not visible. Inventory restore runs after that commit and is idempotent by movement key.

## What was not migrated

Staff memberships are not in this wave. Password ciphertext is not rewritten. See `TRONX_PRO_MAX_CREDENTIAL_ROTATION.md`.
