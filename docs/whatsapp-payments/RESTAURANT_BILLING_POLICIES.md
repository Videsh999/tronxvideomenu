**Draft.**

> **ADR alignment.** Where this draft disagreed with ADR 0009 or ADR 0010, the ADR wording is kept. Conflicts:
> 1. Finance D1 ordered policy as outlet+order-type, then outlet default, then org+order-type, then org default. ADR 0009 precedence is order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release stays a separate policy.
> 2. The drafts omitted the ADR 0009 channel defaults: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release: dine-in on order; prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
> 3. The drafts omitted who may create a partial instalment. ADR 0009: Cashier, Manager, or Admin. A captain can only display or share an existing request. Refunds and MANUAL_REVIEW stay Manager or Admin only.
> 4. ADR 0010 sets a default tip cap of 25% of the post-discount, pre-tax subtotal. It is configurable. The drafts did not state that cap.
> 5. BILL_GENERATION_WORKFLOW said a tip change keeps the same bill version. ADR 0010: adding, changing, or removing a tip increments billVersion.

# Restaurant Billing Policies (reference)
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` did **not exist** at time of writing, so every provider fee, settlement timeline, capability, and report format below is **TBD**. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

> Board: ROS-E15-T016. Target path in the repo is `docs/whatsapp-payments/RESTAURANT_BILLING_POLICIES.md`. This draft lives in this folder, to be committed via the CEO's commit path.

This is a policy reference. Mechanics live in PAYMENT_WORKFLOWS.md, BILL_GENERATION_WORKFLOW.md, TIP_ACCOUNTING_AND_RECONCILIATION.md and BILLING_VALIDATION_CASES.md.

## 1. Payment modes
| Mode | Meaning | Bill timing |
|---|---|---|
| PAY_BEFORE_PREPARATION | Pay after order submission. Kitchen release is a **separate** policy and is not forced. | at order submission |
| PAY_AFTER_MEAL | Table session, multiple orders, running bill. | customer request / captain / checkout |
| FLEXIBLE | Resolved by ADR 0009 precedence: order override, then table or session, then channel, then outlet, then organization, then default. CEO channel defaults, pending Founder confirmation: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Stamped on the order at creation. | per resolved mode |

## 2. Policies
- **Amounts:** server-side only. Bill = `calculateRestaurantBill` output (repo, `lib/billing/calculate-bill.ts`). QR = bill total + confirmed tip. Client amounts are never trusted.
- **Bill versions:** any change → new version. The open request is flagged superseded (D11, not a status) and a new one issued (BILL_GENERATION_WORKFLOW.md).
- **Partials (D2):** OFF by default, enabled per outlet. With a tip, the tip is paid last (D4).
- **Overpayment (D3):** never auto-accepted → MANUAL_REVIEW → provider refund of the excess only. Never converted to a tip.
- **Late payment on superseded requests (D8):** MANUAL_REVIEW. No auto-cancel. Current request stays live, with a warning.
- **Discounts (D7):** clamped to the subtotal, so total ≥ 0. A discount above the subtotal is a validation error unless a Manager overrides it, and the override is audited.
- **Tips (ADR 0010):** `ENABLE_CUSTOMER_TIPS` default OFF, per outlet/order type. Never preselected. Neutral copy is "Add a tip (optional)" and "No tip". Outside the calculator, no in-system tax. % base = post-discount, pre-tax item subtotal, excluding packaging and service charge. Rounded half-up to ₹1 and shown before confirm. Default cap is 25% of that subtotal and is configurable. Turning tips off affects new bills only; historical tips stay intact. Separate from food revenue. Never promised to a specific employee. Base ₹0 → tip prompt hidden entirely (D12). Tax treatment awaits the CA.
- **Kitchen release (ADR 0009):** separate from payment timing. Dine-in releases on order. Prepay channels release on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
- **Partial instalments (ADR 0009):** created by Cashier, Manager, or Admin. A captain can only display or share an existing request.
- **Refunds:** Manager/Admin only (captains have no refund, settlement or cash-close rights by default). Via the provider. Refund API and timing TBD (PROVIDER_CAPABILITY_RESEARCH.md). Tip reversal on refund is open (CA Q7).
- **Verification:** signature-verified webhook or authenticated status check only. Idempotent on provider ref. Merchant, ref, order, amount, currency and status must all match.
- **MANUAL_REVIEW:** triggers and resolution workflow are in PAYMENT_WORKFLOWS.md §5. Only Manager/Admin resolves, with a mandatory reason. Money held in review is unapplied (not revenue or tip). A bill cannot be closed while any payment is in review (D10).
- **Receipt:** only after verified payment. The tip is a separate line after the bill total (TIP_ACCOUNTING §4a).
- **Audit:** recorded for bill versions, supersede/cancel, tip selection and confirmation, discount overrides, every MANUAL_REVIEW raise/resolve, refunds, and policy-setting changes. Each record holds actor, role, reason, timestamp, and before/after values.
- **Isolation:** each outlet has its own merchant config. No cross-outlet money moves.
- **Live money:** none until merchant onboarding, production credentials and Founder approval are in place.

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


## Open
Founder confirmation of D1–D9 and D12; CTO confirmation of D10–D11. CA tip questions (TIP_ACCOUNTING §5). All provider capabilities, fees and timelines are TBD (PROVIDER_CAPABILITY_RESEARCH.md).
