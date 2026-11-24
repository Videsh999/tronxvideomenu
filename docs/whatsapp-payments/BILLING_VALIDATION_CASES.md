# Billing Validation Cases (taxes, discounts, totals, tips)
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` (this folder) is now cited where used; anything it does not state stays **TBD**. ADRs 0007/0009/0010 (this folder) and `CTO_REVIEW_SIX_DOCS.md` win over earlier text here. **Revision R2 (2026-11-07, 13:26 IST):** CTO verdict + ADR alignment applied (D13–D20); where an older section conflicts with D13–D20, D13–D20 win. The amounts are INR. Arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts` in the ROS repo, which is not on the box), and this doc defines no tax or rounding rules of its own.

## Status
`calculateRestaurantBill` exists in the ROS repo (`lib/billing/calculate-bill.ts`; refs: `../TRONX_PRO_MAX_TASK_BOARD.md` lines 182, 283–318; `tasks.csv` ROS-E02-T001, E03-T001..3, E13-T004) but is not on the box. **Backend will run these cases and supply the outputs** (e.g. via `tests/billing-calculator.test.ts`, ROS-E03-T003). Until then, all bill-side expected values are **TBD**. Tip amounts marked **(rule D6)** are derived by hand from CEO default D6 on a *stated* subtotal, **not** from the calculator. Provider behaviour is TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

Defaults exercised: D1–D9 (D8 = CEO product default, Founder may override; D9 = Finance proposal pending Founder). D1–D7 are **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]** (see the decision log below). Tip is outside the calculator (D5).

| # | Inputs | Expected bill (subtotal / discount / packaging / service / CGST / SGST / IGST / total) | Tip | Expected QR / outcome | Notes |
|---|---|---|---|---|---|
| V01 | 1 item, exclusive tax, intra-state, no extras | TBD (Backend) | 0 | = bill total | baseline |
| V02 | Same, inter-state | TBD | 0 | = total | IGST only |
| V03 | Tax-inclusive mode | TBD | 0 | = total | |
| V04 | Mixed rates (5% + 12% dishes) | TBD | 0 | = total | |
| V05 | Packaging + service charge non-zero | TBD | 0 | = total | |
| V06 | Percent coupon | TBD | 0 | = total | |
| V07 | Fixed coupon | TBD | 0 | = total | |
| V08 | Expired coupon | rejected / no discount | 0 | = total | |
| V09 | Discount **equal** to subtotal | discount = subtotal; taxable base 0; total TBD (Backend; packaging/service may keep it > 0) | 0 | = total, ≥ 0 | D7 |
| V10 | Discount **above** subtotal, no override | **Validation error**, bill not finalized, no PR | — | none | D7 |
| V11 | Discount above subtotal, **manager override** | discount clamped to subtotal; total TBD, ≥ 0; audit record (who, reason, time) written | 0 | = total | D7 |
| V12 | Line cancel after bill | TBD = calc on remaining lines | 0 | new PR, old superseded | ROS-E02-T001 |
| V13 | Bill total 500, fixed tip 50 | 500 (stated) | 50 | **550** | Founder example; tip kept outside the tax calculation, GST pending CA (D20) |
| V14 | Stated post-discount pre-tax subtotal ₹250, tip 5% | total TBD | **₹13** (12.50 → half-up, rule D6) | total + 13 | .50 rounds up |
| V15 | Subtotal ₹249, tip 5% | TBD | **₹12** (12.45 → 12, rule D6) | total + 12 | below .50 |
| V16 | Subtotal ₹255, tip 10% | TBD | **₹26** (25.50 → 26, rule D6) | total + 26 | .50 rounds up |
| V17 | Subtotal ₹1,010, tip 15% | TBD | **₹152** (151.50 → 152, rule D6) | total + 152 | |
| V18 | Subtotal ₹1,000, discount ₹100 (post-discount ₹900), tip 10% | TBD | **₹90** (rule D6; discount reduces base) | total + 90 | base = post-discount |
| V19 | **Tip base changed** by config (e.g. to post-tax total), same order as V18 | TBD | TBD: needs calc total, then rule D6 rounding | total + tip | base configurable (D6); old PR superseded if changed mid-bill |
| V20 | Tip amount shown before confirm | — | the displayed tip equals the stored tip | QR = displayed total | D6; no preselection |
| V21 | Custom tip 0 / no tip | calc | 0 | = total | no tip line |
| V22 | Tips disabled, client sends tip | calc | ignored/rejected | = total | |
| V23 | Negative or non-integer custom tip | — | rejected | — | whole rupees |
| V24 | Partials ON: staff create exact 200 then exact 300 on a 500 bill | 500 | 0 | PR(500) SUPERSEDED → PR(200) PAID → bill PARTIALLY_PAID → staff create PR(300) → PAID → SETTLED | D15/D17 |
| V25 | Partials **OFF** (default): 200 paid on 500 | 500 | 0 | MANUAL_REVIEW, unapplied; no auto PR2 | D2/D13 |
| V26 | Partials ON: bill 500 + tip 50; staff create exact 200, then exact 350 | 500 | 50 | after 200: bill 200 / tip 0; after 350: bill 300 / tip 50 → SETTLED | D4 tip last, D15 |
| V27 | Partials ON: bill 500 + tip 50; customer pays 520 on the 550 request | 500 | 50 | **MANUAL_REVIEW** (short amount is not an instalment); nothing auto-issued | D15 (was auto-allocation) |
| V28 | **Overpayment**: 600 on a 500 PR | 500 | 0 | MANUAL_REVIEW → apply 500, refund 100 via provider (REFUND_PENDING → REFUNDED); tip stays 0 | D3; refund capability TBD (provider research) |
| V29 | Overpayment on a PR with a tip: 600 on 550 (500 + 50) | 500 | 50 | apply 550, refund 50; tip stays 50, not 100 | D3 |
| V30 | Items added after QR | v2 TBD | | v1 superseded | |
| V31 | Client-altered amount | server amount wins | | server | |
| V33 | **D9** Stated item subtotal ₹1,000, discount ₹100, packaging ₹40, service charge ₹90; tip 10% | TBD (Backend) | **₹90** (base ₹900 = items − discount; packaging and service excluded, rule D6/D9) | total + 90 | not ₹103 |
| V34 | **D9** Item subtotal ₹517 (UX_SPEC §5 example), packaging ₹20, tip 5% / 10% / 15% | TBD | **₹26 / ₹52 / ₹78** (25.85 / 51.70 / 77.55, rule D6/D9) | total + tip | matches UX_SPEC |
| V35 | **D9** Item subtotal ₹250 + service charge ₹25, tip 5% | TBD | **₹13** (12.50 → 13; service excluded, rule D6/D9) | total + 13 | |
| V36 | **D9** Packaging/service only (item subtotal ₹0 after full discount), tip 10% | TBD | **none**: tip prompt hidden entirely, no %/fixed/custom (D12) | = total | no tip line; client-sent tip rejected |
| V37 | **D8** Bill 500 v1 → v2 550 (PR1 SUPERSEDED, PR2 ACTIVE). A late 500 arrives on PR1 | v2 TBD (550 stated) | 0 | → MANUAL_REVIEW, unapplied; PR2 remains ACTIVE; "payment pending review" warning; bill not Paid; close blocked | D8/D16/D18 |
| V38 | **D8** V37, partials ON, Manager applies the 500 | 550 | 0 | balance 50 from ledger; PR2 SUPERSEDED in the same transaction (provider close best effort, PCR §11.6); staff create an exact 50 request | D17 |
| V39 | **D13** V37, partials OFF, Manager/Admin resolves | 550 | 0 | the 500 stays unapplied until resolved; never auto-applied. Option A: audited one-off instalment override → apply 500, PR2 SUPERSEDED, new exact 50 request. Option B: refund 500 | D13 (CEO default, pending Founder) |
| V40 | **D8** Bill v2 = 500 (dropped item), late 550 on v1 PR | 500 | 0 | MANUAL_REVIEW → apply 500, balance 0 → PR2 SUPERSEDED/closed (provider best effort); excess 50 → D3 refund | |
| V41 | **D8** Late payment and current PR both paid | 500 | 0 | first verified settles; the other → MANUAL_REVIEW → full refund (D3); bill Paid once | T007 AC |
| V42 | **D8** Captain/Cashier attempts to resolve review | — | — | denied; only Manager/Admin | audit entry of the attempt (proposal) |
| V43 | **D10** Bill with one payment in MANUAL_REVIEW; Manager/Admin clicks Close bill | — | — | **blocked**, with message to resolve the review first; no override; bill stays open | after resolve, close allowed if balance 0 |
| V44 | **D8/D19** Request closed/expired (close API called), then the customer's in-flight payment lands | 500 | 0 | MANUAL_REVIEW; never auto-applied; Manager/Admin apply or refund | close races active payment (PCR §3, §4, §11.6) |
| V45 | **D15** Partials ON, customer pays 200 on a 500 request (no staff instalment) | 500 | 0 | MANUAL_REVIEW, unapplied; no auto-issued 300 | underpayment ≠ instalment |
| V46 | **D15** Captain tries to create a 200 instalment | 500 | 0 | denied (Cashier/Manager/Admin only); audit attempt | |
| V47 | **D17** Item added while PR(500) ACTIVE | v2 TBD | 0 | PR(500) → SUPERSEDED with supersededBy=PR(v2) in the same transaction; never two ACTIVE | |
| V48 | **D17** Manager/Admin applies a review payment, which changes the balance, while PR ACTIVE | TBD | 0 | current PR SUPERSEDED in the same transaction before any new request | |
| V49 | **D18** Close bill with a request ACTIVE and unexpired, balance otherwise 0 (e.g. zero-due after review apply not yet superseded) | — | — | **blocked** | |
| V50 | **D18** Close after the request EXPIRED/SUPERSEDED and no review open, balance 0 | — | — | allowed | |
| V51 | **D19** Payment arrives after bill CLOSED | — | — | post-close exception → MANUAL_REVIEW; bill stays closed; Finance reconciles | never silent reopen |
| V52 | **D19** Close bill and payment webhook arrive concurrently | — | — | exactly one outcome: either the payment commits first (close re-checks the guard) or close commits first and the payment → post-close exception | atomic guard |
| V53 | **D14** Base ₹400, custom tip ₹120 (30%) | TBD | rejected: over cap ₹100 (25%) | — | server-enforced cap |
| V54 | **D14** Base ₹400, custom tip ₹100 (=25%) | TBD | ₹100 accepted | total + 100 | boundary |
| V55 | **D14** Base ₹2, 25% cap = ₹0.50; fixed tip ₹1 | TBD | rejected (over cap); whole-rupee tip not possible ≤ cap → no tip | — | tiny base; rounding never exceeds the cap (Finance default, see FINANCE_RESPONSE Q4) |
| V56 | **D14** Tip changed 50 → 30 after confirm | v(n+1) | 30 | billVersion++, old PR SUPERSEDED, new PR bill + 30 | ADR 0010 |
| V57 | **D14** Tips disabled while a bill with a confirmed ₹50 tip is open | v(n) | 50 kept | open request unchanged; new bills have no tip UI | new bills only |
| V58 | **D20** Receipt with tip | — | 50 | tip line "Tip (voluntary)"; no text stating the tip is untaxed / tax-free | wording |
| V59 | **D14** Kitchen gate AFTER_VERIFIED_PAYMENT with tip confirmed: bill paid, tip unpaid | 500 | 50 | kitchen release **not** blocked by the unpaid tip | tip excluded from kitchen gate |
| V32 | Demo amounts Rs 1/20/149/520/1250 | build via calc (Backend) | 0 | same | |

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

## Still open
- **Tip rounding conflict:** D6 (whole rupee) vs the box copy of ADR 0010 (nearest-paise half-up, computed by B). TEST_TRACEABILITY.md records ADR 0010 as 'half-up rupee'. The box ADR copy may be stale (it lacks the 25% cap the CTO cites). If paise rounding applies: V14 ₹12.50, V15 ₹12.45, V16 ₹25.50, V17 ₹151.50, V34 ₹25.85/51.70/77.55, V35 ₹12.50. **CTO to confirm.**
- Founder confirmation of D1–D9, D12, D13 and the 'Tip (voluntary)' label (CEO bundling D1–D9); ADR 0007/0009/0010 remain Proposed.
- CA tax treatment of tips (TIP_ACCOUNTING_AND_RECONCILIATION.md §5).
- Provider refund, partial and exact-amount support (PROVIDER_CAPABILITY_RESEARCH.md).
- Unit of the calculator (paise vs rupees), confirmed by Backend.
