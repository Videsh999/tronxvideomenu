**Draft.**

> **ADR alignment.** Where this draft disagreed with ADR 0009 or ADR 0010, the ADR wording is kept. Conflicts:
> 1. Finance D1 ordered policy as outlet+order-type, then outlet default, then org+order-type, then org default. ADR 0009 precedence is order override, then table or session, then channel, then outlet, then organization, then default. Kitchen release stays a separate policy.
> 2. The drafts omitted the ADR 0009 channel defaults: dine-in is PAY_AFTER_MEAL; takeaway and delivery are PAY_BEFORE_PREPARATION. Kitchen release: dine-in on order; prepay channels on verified payment of the bill total excluding tip. A tip never blocks the kitchen.
> 3. The drafts omitted who may create a partial instalment. ADR 0009: Cashier, Manager, or Admin. A captain can only display or share an existing request. Refunds and MANUAL_REVIEW stay Manager or Admin only.
> 4. ADR 0010 sets a default tip cap of 25% of the post-discount, pre-tax subtotal. It is configurable. The drafts did not state that cap.
> 5. BILL_GENERATION_WORKFLOW said a tip change keeps the same bill version. ADR 0010: adding, changing, or removing a tip increments billVersion.

# Tip Accounting & Reconciliation
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` did **not exist** at time of writing, so every provider fee, settlement timeline, capability, and report format below is **TBD**. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

## 1. Principles (from Founder order 2)
- ENABLE_CUSTOMER_TIPS is default OFF. When off, no tip lines appear except on historical records.
- A tip is only recorded with explicit customer confirmation. It is never preselected.
- Tips are kept **separate from food revenue** in every report and ledger.
- **No tax treatment is assumed.** This doc does not say whether GST applies, whether tips are part of the taxable value, or how they are treated for TDS or income. See §5.
- We never promise that a tip goes directly to an employee. Allocation reporting only runs under a configured, legitimate outlet policy.

## 1a. Tip calculation rules **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]**
- D5: The tip is **outside `calculateRestaurantBill`**. It is added after the bill total as its own ledger component. No tax is applied to it in-system, pending CA answers (§5 stays open). QR amount = bill total + confirmed tip.
- D6/D9, kept as ADR 0010: Percentage tip = rate × **post-discount, pre-tax item subtotal**, **excluding packaging and service charge**. The base is configurable per restaurant. Rounded **half-up to the whole rupee** (e.g. ₹12.50 → ₹13, ₹12.49 → ₹12). Default cap is **25% of that subtotal** and is configurable. The amount is shown before the customer confirms. A tip is never preselected. Neutral copy is "Add a tip (optional)" and "No tip". Fixed and custom tips are whole rupees as entered. Turning tips off affects new bills only; historical tips stay intact.
- D12: if the tip base is ₹0, the tip prompt is hidden entirely (no %, fixed or custom).
- D4: In partial payments the tip is allocated last.
- D3: An overpayment is never converted into a tip. The excess is refunded through the provider.

## 2. Tip record (per Founder order)
amount, currency=INR, selectionSource (none/fixed/percentage/custom), confirmation (who, when), orderId, billId+version, paymentRef, outletId, timestamp, plus a proposed field: policyIdAtTime.

## 3. Ledger accounts (proposed chart, per outlet; account names are placeholders pending CA)
| Account | Use |
|---|---|
| Food & beverage sales (existing) | From `calculateRestaurantBill` |
| Output taxes (existing) | From `calculateRestaurantBill` only. No tax is computed on the tip until the CA confirms treatment |
| **Customer Tips Payable / Held** (liability, proposed) | Credited when a payment carrying a tip is VERIFIED |
| Tip Payouts | Debit Tips Payable when the outlet pays out under its policy (recorded by the restaurant; TRONX holds no money) |
| Tip Refunds | Reverses Tips Payable when a payment is refunded |

Classifying tips as a liability rather than income is a **proposal for the CA**. Money settles to the restaurant's merchant account (Founder order), so TRONX records but never holds or distributes tips.

## 4. Reconciliation
- Settlement lines are gross (bill + tip). Split them via ledger allocation: tip = the confirmed tip on that bill version. Partial payments allocate bill components first and the tip last (D4, PAYMENT_WORKFLOWS.md §4).
- Daily check per outlet: Σ verified tips = Σ Tips Payable credits; Tips Payable closing balance = credits − payouts − refunds.
- Tip changed after the PR was issued: the PR is superseded and a new PR is issued. A tip on a superseded PR → MANUAL_REVIEW.
- A refund of a bill that included a tip: reverse the tip proportionally, or the whole tip? **Open (CA/Founder).**
- Provider fees on the tip portion: fee data is **TBD** (PROVIDER_CAPABILITY_RESEARCH.md). Whether fees reduce tips paid out is an **open question**.
- Payout reports show allocation only if the outlet has configured a policy. Otherwise they show totals only.


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

## 4a. Receipt presentation and customer wording (ROS-E15-T008)
Consistent with UX_SPEC.md §1 (label "Tip (optional)"), §5 (tip step) and §11 (receipt).

**Receipt (customer page + WhatsApp, only after verified payment):**
```
Items … · Taxes … · Bill total        ₹500.00
Tip (voluntary)                       ₹50.00   ← only if a tip > 0 was confirmed
Total paid                            ₹550.00
```
- The tip is a **separate line after the bill total**, labelled as voluntary. **No tax is shown on the tip line**, and the tip is not part of any tax row or the taxable amount.
- No tip line appears when tips are OFF or the customer chose "No tip" (UX_SPEC AC-1b.2). Historical records keep their tip lines.
- For partials, list each payment. The tip is allocated last (D4).
- Whether the tip belongs on the tax invoice or on a separate payment receipt is **open (CA Q2)**. Until answered, the layout above is used and the tip line is never presented as a taxed supply.
- Label: Finance proposes "Tip (voluntary)" on the receipt, against UX_SPEC's "Tip" (§11) and "Tip (optional)" (§1). Both are acceptable. **Founder signs off the final wording (UX_SPEC Q7).**

**Customer tip-step wording (matches the UX_SPEC §5 CEO default):** "Add a tip (optional)", "No tip", and "{n}% ₹{amount}" chips. No option is preselected, and Pay is disabled until a choice is confirmed. Allowed text: "Tips are optional." **Not allowed:** guilt or pressure copy ("Your server worked hard"), "for your server", or any claim that a tip goes to a specific person or directly to staff. Any allocation wording only appears if the outlet has configured a legitimate policy, and it describes that policy factually.

**Tax treatment:** none is assumed. See §5. The board AC "written professional guidance recorded" stays **open** until the CA answers.

## 5. Open questions for the Chartered Accountant (still open)
1. Is a voluntary customer tip, collected on the same UPI payment as the bill, part of the "value of supply" for GST? Does it matter if the tip is optional, shown separately and confirmed separately?
2. Should tips show on the tax invoice, on a separate receipt line, or on a separate document?
3. Is the tip restaurant income that is then paid out as staff remuneration, or a liability held on the staff's behalf? What are the implications for income tax, TDS and payroll (PF/ESI, wage laws)?
4. How should tips be treated if a mandatory **service charge** also exists (the calculator supports service charge)? Can both appear on one bill? Does excluding the service charge from the tip base (D9) raise any issue?
5. Are there consumer-protection rules on tip/service-charge presentation that affect the UI wording?
6. Who bears provider fees/MDR on the tip portion, and how is that recorded?
7. Treatment on refunds, partial refunds and chargebacks.
8. Records retention for tips and payouts, and the documentation needed for a "legitimate allocation policy".
9. Does any of this change by state (CGST/SGST vs IGST) or by outlet type?
