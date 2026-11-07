# ADR 0009 — Billing policy resolution and independent kitchen release

- Status: Proposed
- Date: 2026-11-07

## Context

Dine-in running checks and takeaway prepayment share an order aggregate. Payment timing is not kitchen authorization. B/C/E already own billing logic, POS/captain billing callers and floor/kitchen respectively. O must consume their contracts, not create duplicate policy or pricing logic.

## Decision

B owns a pure server-side policy resolver and immutable effective-policy/source snapshot in its billing contract. O queues changes to B; every UI and WhatsApp workflow consumes the same result.

### CEO defaults (configurable, pending Founder confirmation)

- Dine-in is `PAY_AFTER_MEAL`. Takeaway and delivery are `PAY_BEFORE_PREPARATION`.
- Kitchen release is a separate policy. Dine-in releases on order. Prepay channels release on verified payment.
- The prepay kitchen gate is the bill total excluding tip. A tip never blocks the kitchen.
- Precedence, highest first: order override, then table or session, then channel, then outlet, then organization, then default.
- Partial instalments are created by Cashier, Manager, or Admin. A captain can only display or share an existing request.
- Refunds and `MANUAL_REVIEW` resolution are Manager or Admin only.

- `PAY_BEFORE_PREPARATION`: collection is expected before preparation. The expectation alone does not block/enqueue a KOT; independent kitchen-release policy governs execution. Show a warning for configurations allowing unpaid kitchen release.
- `PAY_AFTER_MEAL`: table session/running bill, finalized at checkout or authorized bill request. Cross-order table consolidation requires B's explicit aggregate/allocation contract before shared-bill collection (ADR 0007).
- `FLEXIBLE`: choose a configured concrete pay-before/pay-after rule by dine-in/takeaway/delivery/reservation channel. Display resolved rule and winning source, not an ambiguous flexible flag.

Precedence, highest first:

1. Explicit order-level manager/admin override with reason.
2. Explicit table/session override, outlet-bound and valid only for that session.
3. Outlet order-type/channel mapping.
4. Outlet default.
5. Organization default.
6. Compatibility system default `PAY_AFTER_MEAL`, visibly labelled defaulted.

Table wins over channel. Pick the highest present setting. If it is FLEXIBLE, expand using the outlet's concrete channel map, then org concrete channel map, then explicit outlet/org concrete fallback, ultimately PAY_AFTER_MEAL. This expansion does not override a higher-priority explicit concrete rule. Mapping/fallback values cannot themselves be FLEXIBLE: validate against recursion. Missing/invalid configuration generates a repair warning; no implicit authorization bypass. UI shows the source hierarchy, config version and effective concrete rule. The proposed compatibility fallback is a Founder-confirmation item, not a claim about the existing implementation.

Organization admins change org defaults only within authorized organization membership. Outlet admins/managers configure their outlet defaults/channel maps/table-session and order overrides. Until D/H membership work lands, enable only equivalent verified restaurant-admin capabilities. Cashiers, Managers, and Admins may create partial instalments. A captain can only display or share an existing request. Refunds and `MANUAL_REVIEW` resolution are Manager or Admin only. Captains cannot override policy, configure merchants, refund, settle, or cash-close by default. Audit actor, scope, before/after, reason, source, config version, time and correlation id. A caller's supplied policy never grants permission.

Snapshot policy at order/bill creation. New configuration does not silently change historical/open orders. Changing an existing order's effective policy is an explicit audited manager/admin action; payable changes also version the bill and invalidate requests. A timing-only policy override does not rewrite monetary history. Settings/override writes use optimistic concurrency.

Kitchen release is a separate server resolver with outlet default and audited manager/admin order override:

- `ON_ACCEPTANCE` (proposed compatibility default for dine-in): existing authorized order transitions may release without verified payment.
- `AFTER_VERIFIED_PAYMENT`: prepay orders wait in an **awaiting payment** KDS lane. They release only when the ledger verifies payment of the bill total excluding tip. A partial base, a pending payment, a failed payment, or `MANUAL_REVIEW` does not release the lane. A paid base with an unpaid tip does release. Zero-due final bills use B's explicit zero-balance rule, not a fictitious provider payment.
- `MANUAL_AUTHORIZED_RELEASE`: a Manager or Admin may release the awaiting-payment lane with an audited reason. A captain cannot. An aging alert fires when an order has been in that lane for 10 minutes.

Permission matrix:

| Action | Captain | Cashier | Manager | Admin |
|---|---|---|---|---|
| Display or share an existing request | Yes | Yes | Yes | Yes |
| Create an instalment | No | Yes | Yes | Yes |
| Refund | No | No | Yes | Yes |
| Resolve `MANUAL_REVIEW` | No | No | Yes | Yes |

Expose the effective policy pair. Odd combinations (pay-before plus acceptance release, pay-after plus payment gate) require clear configuration acknowledgement; never silently rewrite one from the other. Existing order transitions still apply. After paid/released items are appended, gate only the new/unreleased KOT batch against the new outstanding balance; never retract prepared batches or print them twice. E/K integrate through B's transitions. Print failure follows ADR 0005 alerts/retries, not a new money state machine. Payment verification schedules one idempotent release effect, not duplicate KOT commands.

Separate preferences control bill timing (`ON_SUBMISSION`, `ON_CUSTOMER_REQUEST`, `BY_AUTHORIZED_STAFF`, `AT_CHECKOUT`), auto/manual sharing, request expiry, authorized partial-payment enablement and receipts. Validate combinations with effective workflow; show unmet expectations without implying payment proof. Flow is running snapshot -> final bill -> optional confirmed tip -> request -> collection -> verification -> receipt. Only final versions generate payable QR or final-bill sends. Paid confirmations/receipts require committed verification; partial acknowledgements state remaining balance.

## Consequences

One resolver for POS, captain, WhatsApp and server enforcement; kitchen release is not forced by payment policy. Snapshots/audit keep historical behavior explainable. C owns existing Billing Preferences and billing screens; E owns floor/kitchen callers; O integrates through queued patches. Rollout defaults and warnings need Founder confirmation before implementation.

## Alternatives

A pay-before flag that always gates KOT violates independence. Frontend-only resolution, silent repricing/repolicy on settings changes, and universal captain overrides are rejected.

## Security

Handler-level capabilities, outlet/org authorization, CSRF/origin checks, validated enums/maps, audit reasons and concurrency checks are mandatory. UI hiding is not a guard. Kitchen never trusts browser “paid” or a stale cached payment flag.

## Test/acceptance criteria

- Precedence matrix covers all levels, table-vs-channel conflict, FLEXIBLE expansion/fallback, invalid maps, historical snapshots, concurrent changes and POS/captain/WhatsApp parity.
- Synthetic restaurant A: pay-before, tips OFF; B: pay-after, tips ON (5/10/15 percent/custom); C: flexible by order type. Cross payment modes with each independent release mode.
- A partial base, a pending payment, a failed payment, or review cannot satisfy verified-payment release. A paid base with an unpaid tip does release. Full and zero-due paths, and a Manager or Admin release with an audited reason, release the eligible batch once. Append-after-release and print failures preserve history and do not print a batch twice.
- Unauthorized captain/customer/cross-outlet overrides fail. Existing orders do not change on config edits. The permission matrix above is the acceptance table: captains only display or share an existing request; Cashier, Manager, and Admin create instalments; only Manager and Admin refund or resolve `MANUAL_REVIEW`.
- M records demonstrations in the actual app and POS/Captain/QR/KDS/payment regressions in BILLING_POLICY_E2E_REPORT.md. Part H tests 1–20 are enumerated in the Founder brief and in `docs/whatsapp-payments/TEST_TRACEABILITY.md`.
- Order submission under pay-before finalizes exactly one bill version from the server calculator and uses that server total. A running snapshot does not issue a payable QR.
- Pay-after-meal keeps the running bill through the meal. No payment request and no paid confirmation exist before finalisation at customer request, captain request, or checkout.
- Appending to a running order updates the running total and keeps the prior lines' frozen prices and tax rates. The append does not issue a payable QR for the running state.
- When the customer requests the bill, that authorized request finalizes the current server amount, retains the running snapshots, and only then may create a payment request.
- Precedence cases walk order override, then table or session, then channel, then outlet, then organization, then default, including a case where the table or session wins over the channel.
- Prepay KOT cases: the order is held in the awaiting-payment lane; it releases only on a ledger-verified payment of the bill total excluding tip; a paid base with an unpaid tip is released; a Manager or Admin release records the reason; the aging alert fires at 10 minutes; dine-in still releases on order; a released batch is not sent twice.
