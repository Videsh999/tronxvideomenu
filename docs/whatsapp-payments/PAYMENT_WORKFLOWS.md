**Draft.**

> **ADR alignment.** Where this draft disagreed with ADR 0009 or ADR 0010, the ADR wording is kept. Conflicts:
> 1. Finance D1 ordered policy as outlet+order-type, then outlet default, then org+order-type, then org default. ADR 0009 precedence is order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release stays a separate policy.
> 2. The drafts omitted the ADR 0009 channel defaults: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release: dine-in on order; prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
> 3. The drafts omitted who may create a partial instalment. ADR 0009: Cashier, Manager, or Admin. A captain can only display or share an existing request. Refunds and MANUAL_REVIEW stay Manager or Admin only.
> 4. ADR 0010 sets a default tip cap of 25% of the post-discount, pre-tax subtotal. It is configurable. The drafts did not state that cap.
> 5. BILL_GENERATION_WORKFLOW said a tip change keeps the same bill version. ADR 0010: adding, changing, or removing a tip increments billVersion.

# Payment Workflows: Bill → Payment Request → Payment → Receipt
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` did **not exist** at time of writing, so every provider fee, settlement timeline, capability, and report format below is **TBD**. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

## 1. Separate objects (per Founder order 2)
| Object | Key fields | Status values |
|---|---|---|
| Order | orgId, outletId, orderId, orderType | (existing) |
| Bill (versioned) | billId, version, snapshot from `calculateRestaurantBill`, payableAmount, tipAmount | RUNNING → FINAL → SETTLED / PARTIALLY_PAID / VOID |
| PaymentRequest (PR) | supersededBy/supersededReason flag (D11; not a status), prId, billId+version, merchantAccountId, expectedAmount, currency=INR, expiry, providerRef | PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED (incl. superseded), PARTIALLY_PAID*, MANUAL_REVIEW |
| Payment (collection) | paymentId, prId, providerPaymentRef, amount, method, verifiedVia (webhook-signature / status-check) | VERIFIED, FAILED, REFUND_PENDING, REFUNDED, MANUAL_REVIEW |
| Receipt | receiptId, billId+version, payments[] | ISSUED |

\*PARTIALLY_PAID sits on the **Bill**. A PR is single-amount: either it is paid in full, or it closes and a new PR is issued for the remainder (§4).

The Wave 1 payment ledger is the source of truth. Payment status changes only on a signature-verified webhook or an authenticated provider status check, and the handler is idempotent on providerPaymentRef. Front-end amounts are never trusted.

## 2. Common guards (all modes)
- G1: A PR is created only from a FINAL bill version, and the amount comes from the server-side bill (+ confirmed tip).
- G2: A PR is bound to one bill version and one merchant account and is never reused.
- G3: If the bill changes (items added or cancelled, discount, tip change), the open PR is CANCELLED (superseded), the bill gets a new version, and a new PR is issued.
- G4: The verification check must match merchant, providerRef, prId/orderRef, amount, currency and status. Any mismatch goes to MANUAL_REVIEW (§5).
- G5: The receipt and the WhatsApp confirmation are sent only after the Bill reaches SETTLED.
- G6: Exact-amount enforcement by the provider is **TBD** (PROVIDER_CAPABILITY_RESEARCH.md). Until it is confirmed, assume the payer can send any amount.
- G7: Captains cannot refund, settle or cash-close by default.

## 3. Modes
### 3.1 PAY_BEFORE_PREPARATION
Trigger for the bill: order submission. Kitchen release is a **separate policy** and is not forced by payment (Founder order).
```mermaid
stateDiagram-v2
  [*] --> OrderSubmitted
  OrderSubmitted --> BillFinal: billing service finalizes v1
  BillFinal --> TipStep: tips enabled
  TipStep --> PR_Pending: customer confirms tip/no tip
  BillFinal --> PR_Pending: tips off
  PR_Pending --> PartiallyPaid: verified amount < expected
  PartiallyPaid --> PR_Pending: new PR for remainder
  PR_Pending --> Settled: verified amount == outstanding
  PR_Pending --> PR_Expired: expiry passes
  PR_Expired --> PR_Pending: staff/customer re-issues
  PR_Pending --> ManualReview: mismatch / overpay / duplicate
  PR_Pending --> Cancelled: order cancelled before payment
  Settled --> ReceiptIssued
  ReceiptIssued --> [*]
  Cancelled --> [*]
  ManualReview --> Settled: manager resolves
  ManualReview --> RefundPending: manager approves refund
  RefundPending --> Refunded
  Refunded --> [*]
```
If the order is cancelled after a verified payment, the case goes to REFUND_PENDING, which needs a manager role. The kitchen-release policy then reads Bill status as an input only.

### 3.2 PAY_AFTER_MEAL
A table session holds multiple orders and one running bill. Bill-timing triggers: customer request, captain, or checkout.
```mermaid
stateDiagram-v2
  [*] --> SessionOpen
  SessionOpen --> RunningBill: orders added (snapshots kept)
  RunningBill --> RunningBill: more orders / cancels (new snapshot)
  RunningBill --> BillFinal: bill requested (customer/captain/checkout)
  BillFinal --> RunningBill: items added after final (version++, old PR superseded)
  BillFinal --> TipStep: tips enabled
  TipStep --> PR_Pending
  BillFinal --> PR_Pending: tips off
  PR_Pending --> PartiallyPaid
  PartiallyPaid --> PR_Pending: remainder PR
  PR_Pending --> Settled
  PR_Pending --> PR_Expired
  PR_Expired --> PR_Pending
  PR_Pending --> ManualReview
  Settled --> ReceiptIssued --> SessionClosed
  SessionClosed --> [*]
```
The table session cannot close while the Bill is PARTIALLY_PAID or MANUAL_REVIEW, and never while any payment is in MANUAL_REVIEW (D10, no override).

### 3.3 FLEXIBLE
The effective policy (3.1 or 3.2) is resolved per order and stamped on the order at creation, so later setting changes don't affect open orders. Precedence, per ADR 0009 (CEO default, configurable, pending Founder confirmation): order override, then table or session, then channel, then outlet, then organization, then default. Dine-in is PAY_AFTER_MEAL. Takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release is separate: dine-in on order, prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen. Managers always see the effective policy. A partial instalment is created only by a Cashier, Manager, or Admin. A captain can only display or share an existing request.
```mermaid
stateDiagram-v2
  [*] --> ResolvePolicy
  ResolvePolicy --> PayBeforePreparation: effective = PBP
  ResolvePolicy --> PayAfterMeal: effective = PAM
  PayBeforePreparation --> [*]
  PayAfterMeal --> [*]
```
Terminal states in all modes: ReceiptIssued/SessionClosed, Cancelled (no money), Refunded, and VOID (a manager-approved write-off, audited).

## 4. Partial payments and overpayments
| Case | Rule |
|---|---|
| **500 = 200 + 300** | PR1 (500) gets a verified 200. Record 200 in the ledger and set Bill = PARTIALLY_PAID (outstanding 300). PR1 → closed (it can't take more). Issue PR2 for 300 (outstanding comes from the ledger, not the UI) and resend on WhatsApp. Bill = SETTLED only when the 300 is verified on PR2. One receipt lists both payments. |
| Partial payments enabled? | **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]** (D2): **OFF by default**, enabled per outlet. When OFF, any under-payment → MANUAL_REVIEW and no remainder PR is auto-issued. The 500 = 200 + 300 flow above applies only when the outlet has enabled partials. |
| Wrong amount, under | Same as partial if the outlet has enabled partials (D2). Otherwise → MANUAL_REVIEW. |
| Wrong amount, over (e.g. 600 on a 500 PR) | Never auto-settled as 600, and the excess is never booked as revenue or tip. **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]** (D3): never auto-accepted → MANUAL_REVIEW. The **only** outcome is: the manager applies the expected amount and the excess is refunded through the provider (REFUND_PENDING → REFUNDED). It is never converted to a tip, revenue or credit. |
| Double payment (two verified payments on one PR, or a second PR paid after the Bill was SETTLED) | The first verified payment settles. The second → MANUAL_REVIEW → refund flow. Duplicate webhooks with the same providerPaymentRef are an idempotent no-op, not a double payment. |
| Late payment on a superseded/cancelled/expired PR | **D8** (CEO product default 2026-11-07, Founder may override): never applied silently and **never auto-cancels** the current PR. → MANUAL_REVIEW linked to the current bill version. The current open PR stays live, and staff UI shows a "payment pending review" warning. Only Manager/Admin resolves. On apply: balance recalculated from the ledger → if still outstanding, the current PR stays for the rest. If now covered, the current PR is cancelled/expired where the provider allows (TBD), and any excess (incl. a second payment that then lands on the live PR) → refund per D3. Or the Manager/Admin refunds the late payment in full. |
| Payment on wrong merchant/outlet | → MANUAL_REVIEW. Never moved between outlets in the ledger. |
| Tip in a partial | **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]** (D4): payments cover the bill components first, and the tip only once the bill total is fully covered. Example: bill 500 + tip 50, pay 200 → bill 200 / tip 0; then pay 350 → bill 300 / tip 50. |

## 5. Reconciliation workflow (ROS-E15-T007)
The board names no filename for T007, so this section is the T007 deliverable. Board ACs: a late payment on a superseded/expired request → Manual review, never Paid (D8, §4, §5.2). Wrong amount/duplicate → MANUAL_REVIEW, and the bill is Paid once (§4, §5.1). The ledger stays the source of truth (§1, §5.2).

### 5.1 Provider settlement ↔ ledger
Report format, fields, frequency, fees and settlement timing are **all TBD**, pending PROVIDER_CAPABILITY_RESEARCH.md. The rules below are provider-neutral. Output goes to PAYMENT_RECONCILIATION_REPORT.md (owner per Founder order).

**Match keys (in priority order):** 1) providerPaymentRef = ledger.providerPaymentRef; 2) fallback: provider order/PR ref = prId, plus merchantAccountId. Then check: amount (exact, in paise), currency INR, merchant account = outlet's account, status.
**Tolerance:** **zero.** No tolerance is sourced. If the provider deducts fees from settlements, gross = ledger amount and fees are a separate line. The fee schedule is TBD and is never estimated.

| Outcome | Action |
|---|---|
| Exact match on all checks | MATCHED |
| In report, not in ledger | MANUAL_REVIEW (possible missed webhook). An authenticated status check may *propose* a ledger entry, and a manager confirms it |
| In ledger as SUCCESS, missing from report after the expected settlement window | Window **TBD** (provider research). Until it is sourced, flag UNSETTLED_AGED for manual follow-up, not MANUAL_REVIEW by date |
| Amount, currency or merchant mismatch | MANUAL_REVIEW |
| Same providerPaymentRef twice in reports | DUPLICATE → MANUAL_REVIEW |
| Refund/chargeback lines | Matched to REFUND_PENDING/REFUNDED entries. Unmatched → MANUAL_REVIEW |
| Payment against superseded/cancelled/expired PR | MANUAL_REVIEW (§4) |
| Ledger SUCCESS that was verified neither via signature nor status check | MANUAL_REVIEW (should be impossible, so it gets audited) |

### 5.2 MANUAL_REVIEW resolution workflow
1. **Raise:** create a review item with: type, paymentId/providerRef, prId, bill+version, expected amount, received amount, ledger balance at the time, and source (webhook / status check / settlement report). The ledger records the received money as *unapplied* (it is not revenue, not a tip, and not settled).
2. **Warn:** the bill shows "Needs review" (UX_SPEC status label) and a "payment pending review" warning. Close bill is blocked while any review item is open on the bill. The review must be resolved first, with no override (D10).
3. **Resolve (Manager/Admin only, reason required, audited):** the allowed actions are
   - **Apply:** the amount is applied up to the outstanding amount as recalculated from the ledger. Any excess → D3 refund.
   - **Refund:** full provider refund (REFUND_PENDING → REFUNDED). Refund API and timing are TBD.
   - **Match to existing:** for a report line whose ledger entry already exists (missed webhook), confirmed against an authenticated provider status check.
4. **After resolve:** recalculate the balance from the ledger. If it is 0, the bill → SETTLED, the current PR is cancelled/expired where the provider allows (TBD), and the receipt is sent. If > 0, the current PR stays live (or a new PR is issued for the remainder if partials are ON, D2).
5. **Never:** auto-resolve, convert money to a tip (D3), move money across outlets, or mark a bill Paid twice.
6. **Audit:** each raise/resolve records actor, role, action, reason, timestamp, and before/after balance.

**MANUAL_REVIEW exactly when:** any verification-field mismatch; over- or under-payment when partials are disabled; overpayment; second payment on a settled bill; a payment on a non-current PR; a wrong merchant/outlet; a report line without a ledger entry; a duplicate report line; an unmatched refund or chargeback; or a webhook and status check that disagree. Only manager-plus roles resolve these, with a reason, and every action is audit-logged.


## Decision log: D1–D12 (2026-11-07)
D1–D7 are CEO product defaults (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed. D8 is a CEO product default (2026-11-07), Founder may override. D9 is a Finance proposal pending Founder confirmation. D10: PD proposal, pending CTO confirmation. D11: PD interim, pending CTO decision. D12: PD default, Founder may override.
| # | Decision |
|---|---|
| D1 | Precedence, highest first, per ADR 0009 (CEO default, configurable, pending Founder confirmation): order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release is a separate policy. The Finance D1 order (outlet+order-type > outlet default > org+order-type > org default) is not used. Managers still see the effective policy and its source. |
| D2 | Partial payments are OFF by default and enabled per outlet. |
| D3 | Overpayment is never auto-accepted. It goes to MANUAL_REVIEW, and the only outcome is a provider refund of the excess. It is never converted to a tip. |
| D4 | In partial payments, bill components are paid first and the tip last. |
| D5 | The tip is outside `calculateRestaurantBill`. It is added after the bill total as its own ledger component, with no in-system tax, pending CA. |
| D6 | Percentage tip base = post-discount, pre-tax subtotal (the base is configurable). Rounded half-up to the whole rupee and shown before the customer confirms. Default cap is 25% of that subtotal and is configurable (ADR 0010). A tip is never preselected. |
| D7 | A discount is clamped to the subtotal (total ≥ 0). A discount above the subtotal is a validation error unless a manager overrides it, and every override is audited. |
| D8 | Late payment on a superseded/cancelled/expired request: **never auto-cancel.** → MANUAL_REVIEW. The current open request stays live, and the UI warns "payment pending review". Only Manager/Admin resolves. On apply, the balance is recalculated from the ledger. If it is now covered, the current request is cancelled/expired **where the provider allows** (TBD, PROVIDER_CAPABILITY_RESEARCH.md), and any excess follows D3 (refund). *CEO product default 2026-11-07, Founder may override.* |
| D9 | Tip base = **post-discount, pre-tax item subtotal**. Packaging and any service charge are **excluded** (a tip on service charge double-charges for service, and packaging is not service). Confirms the Designer's worked example (UX_SPEC §5). *Finance proposal, pending Founder confirmation.* |
| D10 | A bill **cannot be closed** while any payment on it is in MANUAL_REVIEW. The review must be resolved first, and there is no override. *PD proposal 2026-11-07, pending CTO confirmation.* |
| D11 | "Superseded" is a **flag on the old payment request** (e.g. `supersededBy` + reason), **not** a ledger or bill status. *PD interim, pending CTO decision.* |
| D12 | When the tip base is ₹0, the tip prompt is **hidden entirely**, with no %, fixed or custom tip. *PD default, Founder may override.* |

## 6. Open questions
1. Founder confirmation of D1–D9 and D12; CTO confirmation of D10–D11.
2. **Provider (TBD → PROVIDER_CAPABILITY_RESEARCH.md, from the CEO):** exact-amount enforcement, PR expiry limits, partial-payment support, refund API (needed for D3) and timing, settlement report format, keys and frequency, settlement timeline, fees/MDR, webhook retry behaviour.
