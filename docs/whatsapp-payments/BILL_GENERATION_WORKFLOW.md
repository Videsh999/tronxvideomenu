**Draft.**

> **ADR alignment.** Where this draft disagreed with ADR 0009 or ADR 0010, the ADR wording is kept. Conflicts:
> 1. Finance D1 ordered policy as outlet+order-type, then outlet default, then org+order-type, then org default. ADR 0009 precedence is order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release stays a separate policy.
> 2. The drafts omitted the ADR 0009 channel defaults: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release: dine-in on order; prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
> 3. The drafts omitted who may create a partial instalment. ADR 0009: Cashier, Manager, or Admin. A captain can only display or share an existing request. Refunds and MANUAL_REVIEW stay Manager or Admin only.
> 4. ADR 0010 sets a default tip cap of 25% of the post-discount, pre-tax subtotal. It is configurable. The drafts did not state that cap.
> 5. BILL_GENERATION_WORKFLOW said a tip change keeps the same bill version. ADR 0010: adding, changing, or removing a tip increments billVersion.

# Bill Generation Workflow
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` did **not exist** at time of writing, so every provider fee, settlement timeline, capability, and report format below is **TBD**. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

> Board: ROS-E15-T017. Target path in the repo is `docs/whatsapp-payments/BILL_GENERATION_WORKFLOW.md`. This draft lives in this folder, to be committed via the CEO's commit path.

## 1. Pipeline
```mermaid
flowchart LR
  O[Order(s)] --> RB[Running bill snapshot]
  RB --> BV[Bill version N: FINAL]
  BV --> C[calculateRestaurantBill: repo, outputs TBD from Backend]
  C --> T{Tips ON for outlet + order type?}
  T -- no --> PR[Payment request: amount = bill total]
  T -- yes --> TS[Customer tip choice + confirm; tip outside calculator, D5/D6/D9]
  TS --> PR2[Payment request: amount = bill total + tip]
  PR --> V[Verified payment] --> R[Receipt]
  PR2 --> V
```
1. **Order:** one or more orders. A PAY_AFTER_MEAL table session holds several.
2. **Running bill:** a snapshot is kept for every change, with audit history.
3. **Bill version:** finalized by trigger (order submit / customer request / captain / checkout, per mode). Version N is immutable once FINAL.
4. **calculateRestaurantBill** (`lib/billing/calculate-bill.ts`, in the repo): it is the single source for subtotal, discount, packaging, service charge, CGST/SGST/IGST and total. No other formula is allowed (ROS-E02-T001, E03-T001..3). Output values are TBD until Backend supplies them. Discount clamp and validation error rule: D7.
5. **Tip:** added after the bill total as a separate ledger component. No tax in-system. % base = post-discount, pre-tax item subtotal (excl. packaging and service charge), rounded half-up to ₹1, shown before confirm (ADR 0010). Default cap is 25% of that subtotal and is configurable. A tip is never preselected. If the base is ₹0, the tip prompt is hidden entirely (D12). Changing the tip increments billVersion.
6. **Payment request:** bound to org, outlet, order, bill+version, merchant account, expected amount (INR), expiry and provider ref. Never reused. Expiry limits and exact-amount enforcement are TBD (provider research).
7. **Verification → receipt:** see PAYMENT_WORKFLOWS.md.

## 2. Revisions and supersession
| Event | Effect |
|---|---|
| Items added/cancelled, discount or coupon change after FINAL | New bill version N+1 (re-run calculator). Open PR on N → superseded (the PR is flagged superseded and can no longer be paid. This is a flag, not a ledger/bill status, D11). New PR for N+1. WhatsApp sends the new version once (no duplicate sends per version). |
| Tip changed ("Change tip") | Per ADR 0010: adding, changing, or removing a tip increments billVersion. The open PR is superseded and a new PR is issued for the new version after re-confirm. The Finance row that kept the same bill version is not used. |
| Payment arrives on a superseded PR | D8 → MANUAL_REVIEW. Current PR stays live. |
| Partial payment verified (partials ON) | No new bill version. A remainder PR is issued from the ledger balance (D2, D4). |
| Order cancelled before payment | PR cancelled. Bill void (audited). |
| Order cancelled after payment | Refund flow (Manager/Admin). |

## 3. Open
Calculator outputs (Backend). Provider expiry, cancel-request support and exact-amount enforcement (PROVIDER_CAPABILITY_RESEARCH.md). Founder confirmation of D1–D9 and D12; CTO confirmation of D10–D11.

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

