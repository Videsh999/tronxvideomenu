# Bill Generation Workflow
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` (this folder) is now cited where used; anything it does not state stays **TBD**. ADRs 0007/0009/0010 (this folder) and `CTO_REVIEW_SIX_DOCS.md` win over earlier text here. **Revision R2 (2026-11-07, 13:26 IST):** CTO verdict + ADR alignment applied (D13–D20); where an older section conflicts with D13–D20, D13–D20 win. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

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
5. **Tip:** added after the bill total as a separate ledger component composed/finalized by B; kept outside the tax calculation, GST treatment pending CA (D20). Cap default 25% (D14); integer paise. % base = post-discount, pre-tax item subtotal (excl. packaging and service charge, D9), rounded half-up to ₹1, shown before confirm (D6). If the base is ₹0, the tip prompt is hidden entirely (D12).
6. **Payment request:** bound to org, outlet, order, bill+version, merchant account, expected amount (INR), expiry and provider ref. Never reused. Expiry limits and exact-amount enforcement are TBD (provider research).
7. **Verification → receipt:** see PAYMENT_WORKFLOWS.md.

## 2. Revisions and supersession
| Event | Effect |
|---|---|
| Items added/cancelled, discount or coupon change after FINAL | New bill version N+1 (re-run calculator). Open PR on N → superseded (the ACTIVE PR → **SUPERSEDED** status with supersededBy, in the same transaction, D16/D17). New PR for N+1. WhatsApp sends the new version once (no duplicate sends per version). |
| Tip added/changed/removed | **New billVersion** (ADR 0010). Current PR → SUPERSEDED in the same transaction; new PR after re-confirm. |
| Payment arrives on a superseded PR | D8 → MANUAL_REVIEW. Current PR stays live. |
| Exact instalment verified (partials ON) | No new bill version. A remainder request is created only by deliberate Cashier/Manager/Admin action (D15). |
| Short/wrong amount | MANUAL_REVIEW (D13/D15). Never auto-issued remainder. |
| Payment after bill close, or racing close/terminate | Post-close exception → MANUAL_REVIEW, never silent reopen (D19). |
| Tips disabled while a confirmed tip is open | New bills only; open confirmed bills keep their tip (D14). |
| Order cancelled before payment | PR cancelled. Bill void (audited). |
| Order cancelled after payment | Refund flow (Manager/Admin). |

## 3. Open
Calculator outputs (Backend). Provider expiry, cancel-request support and exact-amount enforcement (PROVIDER_CAPABILITY_RESEARCH.md). Founder confirmation of D1–D9, D12, D13 and the 'Tip (voluntary)' label (CEO bundling D1–D9); ADR 0007/0009/0010 remain Proposed.

## Decision log: D1–D20 (2026-11-07)
D1–D7 are CEO product defaults (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed. D8 is a CEO product default (2026-11-07), Founder may override. D9 is a Finance proposal pending Founder confirmation. D10: PD proposal, pending CTO confirmation. D11: PD interim, pending CTO decision. D12: PD default, Founder may override. D13: CEO default pending Founder. D14: CTO/ADR alignment. D15–D20: CTO decisions (override earlier entries where they conflict). D9 and the 'Tip (voluntary)' label are defaults pending Founder; the CEO is bundling D1–D9 for him.
| # | Decision |
|---|---|
| D1 | ~~Replaced by D14 (ADR 0009 six-level precedence).~~ Was: FLEXIBLE precedence: outlet+order-type rule > outlet default > org+order-type rule > org default. Effective policy is always shown to managers. |
| D2 | Partial payments are OFF by default and enabled per outlet. When ON, this means staff may create exact instalment requests (D15). An underpayment is never an instalment. |
| D3 | Overpayment is never auto-accepted. It goes to MANUAL_REVIEW, and the only outcome is a provider refund of the excess. It is never converted to a tip. |
| D4 | Verified money (exact instalments or Manager/Admin-applied reviews) is allocated to bill components first and the tip last. |
| D5 | The tip is outside `calculateRestaurantBill` as its own ledger component, composed and finalized by B (no second writer). Its tax treatment is **narrowed by D20**: kept outside the tax calculation (`calculateRestaurantBill`); its GST treatment is pending CA confirmation, and live tips are gated on Finance/CA sign-off. |
| D6 | Percentage tip base = post-discount, pre-tax subtotal (the base is configurable). Cap: default 25% of that base (D14). The tip is computed in integer paise, then rounded half-up to the whole rupee, and shown before the customer confirms (ADR 0010). |
| D7 | A discount is clamped to the subtotal (total ≥ 0). A discount above the subtotal is a validation error unless a manager overrides it, and every override is audited. |
| D8 | Late payment on SUPERSEDED or CANCELLED goes to MANUAL_REVIEW (ADR 0007). A late payment on EXPIRED auto-matches only if the bill version is unchanged and the amount matches exactly; otherwise it goes to MANUAL_REVIEW. The current request is never auto-cancelled. The current open request stays live, and the UI warns "payment pending review". Only Manager/Admin resolves. On apply, the balance is recalculated from the ledger. If it is now covered, the current request is cancelled/expired **where the provider allows** (TBD, PROVIDER_CAPABILITY_RESEARCH.md), and any excess follows D3 (refund). *CEO product default 2026-11-07, Founder may override.* **R2 amendments:** a payment after a closed request, or after an EXPIRED request whose bill changed or whose amount does not match, takes the MANUAL_REVIEW path. An EXPIRED payment that matches the unchanged bill exactly is auto-matched (ADR 0007) (close/terminate can race an active payment; PROVIDER_CAPABILITY_RESEARCH.md §3 Razorpay `qr_code.closed` is not sent on auto-expiry; §4 Cashfree terminate may return `TERMINATION_REQUESTED` and active payments can prevent it, and an EXPIRED link can coexist with a successful payment; §11.6). When Manager/Admin applies the late money, the ledger balance changes, so the current request is SUPERSEDED in the same transaction (D17) and a new exact-balance request is issued only by staff action. |
| D9 | Tip base = **post-discount, pre-tax item subtotal**. Packaging and any service charge are **excluded** (a tip on service charge double-charges for service, and packaging is not service). Confirms the Designer's worked example (UX_SPEC §5). *Finance proposal, pending Founder confirmation.* |
| D10 | A bill **cannot be closed** while any payment on it is in MANUAL_REVIEW. The review must be resolved first, and there is no override. *PD proposal 2026-11-07, pending CTO confirmation.* |
| D11 | **SUPERSEDED by D16 (CTO decision, ADR 0007).** Was: "Superseded" is a **flag on the old payment request** (e.g. `supersededBy` + reason), **not** a ledger or bill status. *PD interim, pending CTO decision.* |
| D12 | When the tip base is ₹0, the tip prompt is **hidden entirely**, with no %, fixed or custom tip. *PD default, Founder may override.* |
| D13 | Short/wrong payment when partials are OFF: stays **unapplied** in MANUAL_REVIEW. Manager/Admin either (a) applies it as a **one-off instalment**, an audited override that issues a new request for the exact ledger balance, or (b) refunds it. It is never auto-applied. *CEO default 2026-11-07, pending Founder.* |
| D14 | **ADR alignment:** where these drafts differ from ADR 0009/0010, the ADR wording wins. Policy precedence (ADR 0009, replaces D1): order-level Manager/Admin override with reason > table/session override > outlet order-type/channel map > outlet default > org default > compatibility default `PAY_AFTER_MEAL` (labelled as defaulted). FLEXIBLE expands to a concrete rule. The policy is snapshotted per order/bill. Kitchen release is a separate resolver, and the verified-payment kitchen gate excludes the tip (CTO review). Tips (ADR 0010): integer paise; configurable cap, **default 25% of the post-discount pre-tax subtotal**, server-enforced for fixed, % and custom; a tip add/change/remove **increments billVersion** and supersedes the old request; disabling tips affects **new bills only**. *CTO/ADR, CEO note 2026-11-07.* |
| D15 | **An underpayment is never an instalment.** An instalment is only an exact-amount request deliberately created by Cashier/Manager/Admin (captains display/share only). Any short or wrong amount → MANUAL_REVIEW, even with partials ON. Partials are OFF by default (D2). Allocation of verified money: bill components first, tip last (D4). *CTO decision, overrides earlier D2/D4 flow.* |
| D16 | Supersession follows ADR 0007: **SUPERSEDED is a canonical request status** with `supersededBy` lineage + reason + the changed bill version. Canonical request enum (CTO review): CREATED, ACTIVE, PAID, SUPERSEDED, EXPIRED, CANCELLED, MANUAL_REVIEW, REFUNDED. PARTIALLY_PAID belongs to the bill. FAILED / REFUND_PENDING describe attempts/refund operations. *CTO decision; replaces D11.* |
| D17 | Any change to the **balance or the bill version** supersedes the current ACTIVE request **in the same transaction** (B single writer) before any new request is issued. Only one ACTIVE request per bill. *CTO decision.* |
| D18 | Close guard (extends D10): a bill cannot close while any associated payment/request is in MANUAL_REVIEW **or any request is ACTIVE and not yet expired**. No override. *CTO decision.* |
| D19 | **Post-close exception:** money arriving after the bill is closed → MANUAL_REVIEW, reconciled by Finance; the bill is **never reopened silently**. The same path covers the race between a close/terminate call and an in-flight payment, and a payment arriving after a request was closed/expired (D8): provider closure is best effort (PROVIDER_CAPABILITY_RESEARCH.md §3, §4, §11.6). *CTO decision + CEO note.* |
| D20 | Tip tax wording (narrows D5): never say tips are untaxed. The tip is kept outside the tax calculation (`calculateRestaurantBill`); its GST treatment is pending CA confirmation, and live tips are gated on Finance/CA sign-off. *CTO decision.* |

