**Draft.**

> **ADR alignment.** Where this draft disagreed with ADR 0009 or ADR 0010, the ADR wording is kept. Conflicts:
> 1. Finance D1 ordered policy as outlet+order-type, then outlet default, then org+order-type, then org default. ADR 0009 precedence is order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release stays a separate policy.
> 2. The drafts omitted the ADR 0009 channel defaults: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release: dine-in on order; prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
> 3. The drafts omitted who may create a partial instalment. ADR 0009: Cashier, Manager, or Admin. A captain can only display or share an existing request. Refunds and MANUAL_REVIEW stay Manager or Admin only.
> 4. ADR 0010 sets a default tip cap of 25% of the post-discount, pre-tax subtotal. It is configurable. The drafts did not state that cap.
> 5. BILL_GENERATION_WORKFLOW said a tip change keeps the same bill version. ADR 0010: adding, changing, or removing a tip increments billVersion.

# Billing Validation Cases (taxes, discounts, totals, tips)
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` did **not exist** at time of writing, so every provider fee, settlement timeline, capability, and report format below is **TBD**. The amounts are INR. Arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts` in the ROS repo, which is not on the box), and this doc defines no tax or rounding rules of its own.

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
| V13 | Bill total 500, fixed tip 50 | 500 (stated) | 50 | **550** | Founder example; no tax on tip (D5) |
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
| V24 | Partials ON: 500 paid 200 + 300 | 500 | 0 | PR1 500, PR2 300 | |
| V25 | Partials **OFF** (default): 200 paid on 500 | 500 | 0 | MANUAL_REVIEW; no auto PR2 | D2 |
| V26 | Partials ON: bill 500 + tip 50, pay 200 then 350 | 500 | 50 | after 200: bill 200 / tip 0, PR2 350; after 350: bill 300 / tip 50 → SETTLED | D4 tip last |
| V27 | Partials ON: bill 500 + tip 50, pay 520 total (520 < 550) | 500 | 50 | bill 500 paid, tip 20 allocated, outstanding 30 | D4 |
| V28 | **Overpayment**: 600 on a 500 PR | 500 | 0 | MANUAL_REVIEW → apply 500, refund 100 via provider (REFUND_PENDING → REFUNDED); tip stays 0 | D3; refund capability TBD (provider research) |
| V29 | Overpayment on a PR with a tip: 600 on 550 (500 + 50) | 500 | 50 | apply 550, refund 50; tip stays 50, not 100 | D3 |
| V30 | Items added after QR | v2 TBD | | v1 superseded | |
| V31 | Client-altered amount | server amount wins | | server | |
| V33 | **D9** Stated item subtotal ₹1,000, discount ₹100, packaging ₹40, service charge ₹90; tip 10% | TBD (Backend) | **₹90** (base ₹900 = items − discount; packaging and service excluded, rule D6/D9) | total + 90 | not ₹103 |
| V34 | **D9** Item subtotal ₹517 (UX_SPEC §5 example), packaging ₹20, tip 5% / 10% / 15% | TBD | **₹26 / ₹52 / ₹78** (25.85 / 51.70 / 77.55, rule D6/D9) | total + tip | matches UX_SPEC |
| V35 | **D9** Item subtotal ₹250 + service charge ₹25, tip 5% | TBD | **₹13** (12.50 → 13; service excluded, rule D6/D9) | total + 13 | |
| V36 | **D9** Packaging/service only (item subtotal ₹0 after full discount), tip 10% | TBD | **none**: tip prompt hidden entirely, no %/fixed/custom (D12) | = total | no tip line; client-sent tip rejected |
| V37 | **D8** Bill 500 v1 → v2 550 (PR2 live). A late 500 arrives on PR1 | v2 TBD (550 stated) | 0 | PR1 payment → MANUAL_REVIEW; **PR2 stays live**; "payment pending review" warning; bill not Paid | no auto-cancel |
| V38 | **D8** V37, Manager applies the 500 (partials ON) | 550 | 0 | balance from ledger = 50; PR2 (550) superseded by a 50 PR where the provider allows (TBD) | |
| V39 | **D8** V37, partials OFF, Manager applies | 550 | 0 | balance 50 → Manager either refunds the 500 or applies it and the remaining 50 is collected via a new PR. Exact path with partials OFF **open** | |
| V40 | **D8** Bill v2 = 500 (dropped item), late 550 on v1 PR | 500 | 0 | MANUAL_REVIEW → apply 500, balance 0 → PR2 cancelled/expired where the provider allows (TBD); excess 50 → D3 refund | |
| V41 | **D8** Late payment and current PR both paid | 500 | 0 | first verified settles; the other → MANUAL_REVIEW → full refund (D3); bill Paid once | T007 AC |
| V42 | **D8** Captain/Cashier attempts to resolve review | — | — | denied; only Manager/Admin | audit entry of the attempt (proposal) |
| V43 | **D10** Bill with one payment in MANUAL_REVIEW; Manager/Admin clicks Close bill | — | — | **blocked**, with message to resolve the review first; no override; bill stays open | after resolve, close allowed if balance 0 |
| V32 | Demo amounts Rs 1/20/149/520/1250 | build via calc (Backend) | 0 | same | |

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

## Still open
- Founder confirmation of D1–D9 and D12; CTO confirmation of D10–D11.
- V39: the D8 apply path when partials are OFF.
- CA tax treatment of tips (TIP_ACCOUNTING_AND_RECONCILIATION.md §5).
- Provider refund, partial and exact-amount support (PROVIDER_CAPABILITY_RESEARCH.md).
- Unit of the calculator (paise vs rupees), confirmed by Backend.
