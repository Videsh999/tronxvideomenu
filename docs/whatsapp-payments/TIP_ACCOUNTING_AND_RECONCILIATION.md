**Draft.**

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
- D6: Percentage tip = rate × **post-discount, pre-tax subtotal** (the base is configurable per restaurant). Rounded **half-up to the whole rupee** (e.g. ₹12.50 → ₹13, ₹12.49 → ₹12). The amount is shown before the customer confirms. Fixed and custom tips are whole rupees as entered.
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


## Decision log: CEO product defaults (2026-11-07)
Each is a CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed.
| # | Decision |
|---|---|
| D1 | FLEXIBLE precedence: outlet+order-type rule > outlet default > org+order-type rule > org default. Effective policy is always shown to managers. |
| D2 | Partial payments are OFF by default and enabled per outlet. |
| D3 | Overpayment is never auto-accepted. It goes to MANUAL_REVIEW, and the only outcome is a provider refund of the excess. It is never converted to a tip. |
| D4 | In partial payments, bill components are paid first and the tip last. |
| D5 | The tip is outside `calculateRestaurantBill`. It is added after the bill total as its own ledger component, with no in-system tax, pending CA. |
| D6 | Percentage tip base = post-discount, pre-tax subtotal (the base is configurable). Rounded half-up to the whole rupee and shown before the customer confirms. |
| D7 | A discount is clamped to the subtotal (total ≥ 0). A discount above the subtotal is a validation error unless a manager overrides it, and every override is audited. |

## 5. Open questions for the Chartered Accountant (still open)
1. Is a voluntary customer tip, collected on the same UPI payment as the bill, part of the "value of supply" for GST? Does it matter if the tip is optional, shown separately and confirmed separately?
2. Should tips show on the tax invoice, on a separate receipt line, or on a separate document?
3. Is the tip restaurant income that is then paid out as staff remuneration, or a liability held on the staff's behalf? What are the implications for income tax, TDS and payroll (PF/ESI, wage laws)?
4. How should tips be treated if a mandatory **service charge** also exists (the calculator supports service charge)? Can both appear on one bill?
5. Are there consumer-protection rules on tip/service-charge presentation that affect the UI wording?
6. Who bears provider fees/MDR on the tip portion, and how is that recorded?
7. Treatment on refunds, partial refunds and chargebacks.
8. Records retention for tips and payouts, and the documentation needed for a "legitimate allocation policy".
9. Does any of this change by state (CGST/SGST vs IGST) or by outlet type?
