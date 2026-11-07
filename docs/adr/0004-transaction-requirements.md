# ADR 0004 — Transactions, versions, and crash retry

- Status: Proposed
- Date: 2026-11-07
- Author: TRONX BACKEND ENGINEER (pending CTO confirmation)

## Context

`withOptionalTransaction` falls back to a non-transactional callback when Mongo is not a replica set. `replaceItemsAndTotals` updates by restaurant and id with no version check. `cancelOrderLines` writes the new totals and only then inserts the parent idempotency marker (`lib/services/order.service.ts:1543` then `:1610`). Mongoose does not migrate existing documents and does not drop indexes removed from a schema.

## Decision

Deployed environments run a Mongo replica set. Payment, coupon redemption, stock movement, cancellation, and append do not use the silent non-transactional fallback. If the transaction probe fails, those operations fail rather than continuing.

`replaceItemsAndTotals` compare-and-swaps on a version or on `updatedAt`. A losing writer re-reads and reapplies. Two concurrent appends cannot both commit the snapshot they read.

The cancellation idempotency marker is written in the same transaction as the money update. A crash between those writes must not be observable. The retry returns the already-cancelled order and does not cancel the quantity again.

Required tests, owned by B, and not present yet:

- lost update on one order
- crash retry of cancel after the money write and before the marker

Schema changes, owned by H:

- versioned backfill, safe to run twice
- staged indexes: add, backfill, switch readers, drop the old index in a later release
- the new app reads old documents; the previous app still reads documents from before the backfill
- a backup of the affected collections is taken before the backfill and before the index build, and the PR names the restore steps

## Consequences

L's backup drill uses this restore procedure on a synthetic copy. RPO and RTO targets for that drill are 15 minutes and 1 hour for orders and payments. Those are design targets until a drill records a measured result. Full-role demo data is loaded only after H's indexes and D's memberships exist.
