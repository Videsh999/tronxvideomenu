# ADR 0008 — Verified events, idempotency, and the single ledger

- Status: Proposed
- Date: 2026-11-07

## Context

Callbacks retry, arrive late/out of order, or never arrive. Browser success, scans and screenshots prove nothing. Wave 1's single billing writer and ADR 0004 transactions must remain the only money-mutation authority.

## Decision

1. Provider-specific handlers verify signatures over original raw bytes before trust or processing, with body limits, constant-time comparison, correct environment/credential version and documented algorithm. Validate signed timestamps/nonces against the provider's documented replay tolerance (initial design target five minutes where supported, clock-skew allowance). Event occurrence time is not necessarily signature time. Do not invent a signed timestamp for protocols lacking one: dedupe authenticated events and require an authenticated provider status check for financial application when freshness cannot be established. Genuine delayed events outside the window likewise go through status reconciliation, not blind rejection of received money.
2. Match trusted request org/outlet, merchant, provider/environment, provider request/transaction refs, order/bill ref, current billVersion, amountPaise/currency and documented final captured/success status. If callback has no billVersion, map its immutable provider request reference to the stored version and compare locally. No matching merely by current amount or client metadata. Authorized/pending/scanned is not final success.
3. Verified-event inbox stores provider/environment/merchant/event id, raw-body hash, minimal normalized evidence, occurrence/receipt/verification times, verification key version, request/correlation ids and `RECEIVED/PROCESSING/APPLIED/REVIEW/RETRY` state. Unique `(provider, environment, merchantAccountId, eventId)`. Same id with changed body hash alerts without reapplication. If no stable event id exists, adapter defines a documented semantic identity (transaction + event kind + state revision), or requires status reconciliation. No randomly generated dedupe identity. Encrypt bounded-retention diagnostic payloads; never retain raw secrets/phones unnecessarily.
4. Event dedupe alone is insufficient. Unique financial identity `(provider, environment, merchantAccountId, providerPaymentReference, entryKind)` prevents duplicate collection through separate event ids or polling. Refund identity uses provider refund reference; partial refunds have distinct references and cannot exceed collected refundable components. B's writer command key derives from canonical collection/refund identity, not HTTP delivery id. Maintain database unique constraints as well as application checks.
5. A durable worker feeds B's single billing writer. One replica-set transaction fences request/bill/collection revisions, records immutable verified money, appends ledger entries/component allocations, marks applied, updates projections and enqueues receipt/notification outbox intents. No webhook/adapter direct order mutations, no alternate payment ledger. If inbox storage prevents a shared transaction, writer idempotency plus retryable acknowledgement must still guarantee replay has no second money effect. Never mark processed before writer commit. Return success only after authenticated durable persistence or durable reconciliation handoff; unavailable storage is retryable failure. Invalid signatures create no financial event.
6. Wrong amount/currency/merchant/reference/version, a `SUPERSEDED` or `CANCELLED` request, and extra or double payment go to `MANUAL_REVIEW`. A late payment on an `EXPIRED` request is auto-matched only when the bill version is unchanged and the amount matches exactly. Every other late expired payment goes to `MANUAL_REVIEW`. A late payment on a `SUPERSEDED` request always goes to `MANUAL_REVIEW` and never settles the new version, even when the amounts are equal. Authenticated received money is recorded by B as unallocated or suspense collection, not silently lost or applied to the order. Refund or reallocation needs explicit authorized audited review; automatic refunds are OFF until separately approved. Failed or out-of-order events cannot erase a success; refunds and disputes are new ledger events.
7. PD-1 is confirmed. A bill cannot close while any of its PaymentRequests is `MANUAL_REVIEW`, or `ACTIVE` and unexpired. Only a Manager or Admin resolves `MANUAL_REVIEW`, by accepting, refunding, or rejecting it with a reason, and every resolution is audit-logged. A payment that arrives after the bill has closed leaves the bill closed and goes to `MANUAL_REVIEW` as a post-close exception for Finance to reconcile. A closed bill is never silently reopened.
8. Reconciliation polls pending, creation-unknown, recently expired, superseded, review, and refund-pending records through the correct merchant's authenticated status API. Durable cursor/lookback, per-merchant quotas, bounded jittered retries, age/mismatch alerts and worker health checks are mandatory. Design targets: one-minute pending sweep, daily broader reconciliation (not measured promises). Normalize through the same inbox/writer keys as webhooks. Settlement reports reconcile separately; bank settlement and collection verification are different states. If consent/token revoked, stop privileged API access and escalate unresolved historical requests rather than use revoked secrets.

Provider security must be product-specific. ADR 0006's spot check found Cashfree Embedded PG signs `timestamp + rawBody` using partnerApiKey, not the ordinary PG merchant secret; onboarding events have a separate contract. Razorpay callback freshness must not be assumed from an unsigned occurrence time; use authenticated status where a signed freshness signal is absent. Pin provider fixtures/SDK behavior before coding.

Receipts/paid confirmations originate only from committed verified full-balance ledger state. A verified instalment may produce an explicitly partial acknowledgement and next exact balance request, never a final paid receipt. Refund receipts reflect verified refund status. A message-delivery webhook never changes financial state.

## Consequences

At-least-once delivery with effectively-once money application through transactional unique identities, not a promise of exactly-once webhooks. Inbox backlog and received-but-unallocated money are operationally visible. Receipt retries cannot repeat a charge/credit; POS and captain expose one ledger-derived balance.

## Alternatives

Trusting redirects, writing orders in routes, deduping only by event id, webhook-only capture and blindly retrying provider creation are rejected. Polling-only increases latency/load; both mechanisms share one normalizer/writer.

## Security

TLS, raw-body verification, replay controls, quotas/body limits, key rotation/overlap and redacted correlation logs. A queues exact anonymous-at-edge callback handlers, not blanket anonymous `/api/webhooks/**`; O authenticates callbacks. Merchant routing hints are untrusted until verified. Only a Manager or Admin resolves `MANUAL_REVIEW`, by accepting, refunding, or rejecting it with a reason, tenant scope, and an audit log. Captains have none of those actions by default. Refund to original payment method unless a separately approved lawful exception applies.

## Test/acceptance criteria

- Wrong/missing signature, altered raw body, stale/future timestamp, replay, rotation, cross-merchant/environment and oversized payload cannot settle.
- Same event twice, different events for one payment, concurrent polling/webhook, and duplicate refunds produce one financial effect and receipt intent.
- Crash before/after inbox insert, writer commit, event acknowledgement, outbox enqueue and dispatch recovers without missing/duplicated money; replica-set integration/concurrency tests must run and skipped gates fail CI.
- Exercise wrong/edited amount, currency, old bill, expired request, parallel pay, exact partial instalments, reversed event order, refunds racing collections and disconnected merchant.
- Missed webhook and timeout-after-create reconcile safely. A late payment on a changed bill never auto-applies. An expired request auto-matches only when the bill version is unchanged and the amount matches exactly. Review cases, balances, and financial reports reconcile. Publish actual evidence in PAYMENT_WEBHOOK_SECURITY.md and PAYMENT_RECONCILIATION_REPORT.md; no tests are claimed passed by this proposal.
- Close is rejected while any PaymentRequest on the bill is `MANUAL_REVIEW`.
- Close is rejected while any PaymentRequest on the bill is `ACTIVE` and unexpired.
- A Manager or Admin can accept, refund, or reject `MANUAL_REVIEW` only with a reason, and the action is audit-logged. A Captain or Cashier cannot.
- A payment that arrives after close leaves the bill closed, creates a `MANUAL_REVIEW` post-close exception, and does not reopen the bill.
