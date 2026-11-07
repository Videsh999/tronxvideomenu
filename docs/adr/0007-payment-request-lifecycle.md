# ADR 0007 — Versioned payment requests

- Status: Proposed
- Date: 2026-11-07

## Context

A running snapshot, final bill, request, collection, and receipt are separate. ADRs 0003–0004 freeze pricing and require versions/transactions. An old QR must not settle a changed bill or another order; remote closure cannot eliminate delayed-payment races.

## Decision

Persist immutable identity/quote fields on `PaymentRequest`: `organizationId`, `restaurantId` (outlet), `orderId`, stable `billId`, monotonic `billVersion`, `billSnapshotHash`, `paymentRequestId`; provider, environment, connection id, immutable merchant account id, credential-version reference, provider request/reference; positive safe-integer `amountPaise`, `currency` (INR initially), base/charges/confirmed-tip component snapshot, expiry/provider expiry; status, active flag, creation idempotency key/payload hash, creation state, ledger-derived collection projection, collection revision, supersedes/superseded-by references, actor/reason, timestamps and correlation id. Never embed credential values.

Only B finalizes/version-controls bills and calculates outstanding balances. Item/discount/cancel/reprice/tip add/change/removal increments billVersion; presentation changes do not. Running snapshots cannot generate payable requests. Table-session consolidation across orders requires an explicit B bill-allocation contract; do not reuse one order's QR across orders.

Lifecycle: `PENDING` -> `SUCCESS`, `PARTIALLY_PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, or `SUPERSEDED`; `MANUAL_REVIEW` quarantines ambiguity. Refund projections `REFUND_PENDING`/`REFUNDED` reflect ledger events and retain original collection history. SUCCESS means the request amount was verified, not necessarily the order's full current balance. Timeouts remain pending/reconciling, not confirmed failed. Aggregate bill statuses include PARTIALLY_PAID until the ledger covers its full obligation.

Every bill-version change must atomically set all old active requests `SUPERSEDED`, `active=false`, effective expiry now, preserve prior expiry/reason/history, and enqueue provider close/expire. Preserve superseded identity even after natural expiry; naturally expired requests become EXPIRED. B's writer owns this transaction/version fence, directly integrating the O-owned repository contract only after review. Block request issuance if the atomic invariant is unavailable. Provider close is asynchronous, durable and retried; late payments follow ADR 0008 regardless of provider close success.

At most one active request per order/bill version AND one active per order across versions. Reserve locally under B's version/balance compare-and-swap, then create at provider through an outbox with a stable key; never call network inside a Mongo transaction. Retry the same provider key or reconcile status after timeout, not a fresh blind create. If provider create lacks idempotency/lookup sufficient to disambiguate the attempt, keep it creation-unknown and block a second request pending review. If a bill changes in flight, save the returned provider reference against the superseded row and close it, never reactivate.

Partials default OFF. If enabled, B atomically authorizes/reserves an exact instalment <= current outstanding amount. A 500 bill may issue a fixed 200 request; verified 200 closes/deactivates that request, shows PARTIALLY_PAID, and creates a new exact 300 request. They may share billVersion but use different collection revisions/ids and never overlap as active. A payment of 200 against a fixed 500 request is a mismatch, not supported partial payment. Balance changes fence creation using bill version plus collection revision. Excess or second payments are visible unallocated review, never extra order credit. No new request for a zero balance.

Unique indexes (staged and reviewed by H):

- `paymentRequestId` globally; `(organizationId, restaurantId, createIdempotencyKey)` with payload-hash conflict check.
- Partial unique `(organizationId, restaurantId, orderId, billVersion)` where `active=true`; partial unique `(organizationId, restaurantId, orderId)` where `active=true`.
- Partial unique `(provider, environment, merchantAccountId, providerRequestReference)` only where reference is a string, excluding absent/null values. Payment transaction references are separately unique per ADR 0008.
- Query indexes `(organizationId, restaurantId, status, expiresAt)` and `(organizationId, restaurantId, orderId, billVersion, createdAt)`.

No TTL deletion of financial/request history. Expiry job changes status; retention is a separate approved policy. H backfills organization ids before required compound constraints and supplies staged index/backfill/rollback/backup/restore notes per ADR 0004.

## Consequences

Local invalidation is immediate but old payment surfaces might still receive money. Ledger truth wins over provider/request projections. POS/captain share version fences and balance reservation. Bill/payment history stays auditable; requests cannot migrate to another merchant or bill.

## Alternatives

Mutable per-order QRs, per-device active requests and deleting superseded rows lose financial identity or allow duplication and are rejected.

## Security

Derive tenant/merchant/amount server-side, reject unsafe/fractional/negative integers, protect public status via opaque narrow expiring tokens, and rate-limit creation/lookup. IDs alone authorize nothing. Never log protected QR/link tokens or permit client-selected merchant context.

## Test/acceptance criteria

- Concurrent POS/captain create yields one active row; same key returns same result, changed payload conflicts, null provider refs do not conflict.
- Bill mutation vs create/callback, collection vs remaining-request issuance, replica-set failure, and crash retry preserve all fences and one-active indexes.
- Items/discount/tip/reprice invalidate requests; unsupported closure, expiry, unknown create, double pay, wrong merchant/currency/version and late old payments remain visible and safe.
- Demonstrate supported 500 -> exact 200 + exact 300; wrong 200 against 500 quarantines, no zero/negative-balance request, no old-request revival. Required tests must execute, not skip.
