# Wave 1 data changes

No collection is renamed, dropped, or backfilled. No index is added or removed. Existing documents stay valid.

## Additive order fields

| Place | Field | Meaning for old documents |
| --- | --- | --- |
| `orders` | `version` | Missing means 0. Writers match version 0 or a missing field, then store the next integer. |
| `orders.items` | `gstRateSnapshot` | Missing lines keep the order's stored `taxRatePercent` on recompute. They are not re-read from the live dish. |
| `orders.items` | `cancelledQuantity` | Missing means 0. This field was already set by cancel code but Mongoose `strict` dropped it. It is stored from this wave on. |
| `orders.payment.ledger` | `idempotencyKey` | Optional. Old ledger rows have none. |
| `orderLineCancellations` | `applyStatus`, `baseVersion`, `plannedCancelled` | Missing `applyStatus` is treated as `APPLIED`, so a cancellation written before this wave stays idempotent. |

The unique indexes `{ restaurantId, idempotencyKey }` on orders and on line cancellations are unchanged.

## Snapshot policy

Documented in code as `ORDER_BILL_SNAPSHOT_POLICY` in `lib/billing/order-bill.ts`.

Line unit price, variant, add-on prices, item discount, and `gstRateSnapshot` stay as they were when the line was added. Append and cancel do not re-price those lines from the current catalog. `priceMode` and `supplyType` stay on the order's first `billSnapshot` when one exists, so a later outlet toggle cannot tax a line twice or flip CGST/SGST to IGST. Packaging and service charge are recomputed from the current outlet settings because they depend on the open check.

## What was not migrated

Staff memberships, cashier logins, and kitchen logins are not in this wave. Recoverable password ciphertext already in the database is not re-encrypted. See `TRONX_PRO_MAX_CREDENTIAL_ROTATION.md`.
