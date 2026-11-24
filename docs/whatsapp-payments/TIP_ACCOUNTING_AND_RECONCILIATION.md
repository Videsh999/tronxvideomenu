# Tip Accounting & Reconciliation
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.**
> Sources: `FOUNDER_ORDER_2026-11-07.md` (this folder); `../TRONX_PRO_MAX_TASK_BOARD.md`; `/workspace/tronx-hq/projects/tasks.csv`. `PROVIDER_CAPABILITY_RESEARCH.md` (this folder) is now cited where used; anything it does not state stays **TBD**. ADRs 0007/0009/0010 (this folder) and `CTO_REVIEW_SIX_DOCS.md` win over earlier text here. **Revision R2 (2026-11-07, 13:26 IST):** CTO verdict + ADR alignment applied (D13–D20); where an older section conflicts with D13–D20, D13–D20 win. The amounts are INR. Bill arithmetic belongs to `calculateRestaurantBill` (`lib/billing/calculate-bill.ts`). It exists in the ROS repo but not on the box, and Backend will supply its outputs. This doc defines no tax rules of its own. Provider facts remain TBD until PROVIDER_CAPABILITY_RESEARCH.md arrives from the CEO.

## 1. Principles (from Founder order 2)
- ENABLE_CUSTOMER_TIPS is default OFF. When off, no tip lines appear except on historical records.
- A tip is only recorded with explicit customer confirmation. It is never preselected.
- Tips are kept **separate from food revenue** in every report and ledger.
- **No tax treatment is assumed.** This doc does not say whether GST applies, whether tips are part of the taxable value, or how they are treated for TDS or income. See §5.
- We never promise that a tip goes directly to an employee. Allocation reporting only runs under a configured, legitimate outlet policy.

## 1a. Tip calculation rules **[CEO product default (2026-11-07), configurable per restaurant, Founder may override; not yet Founder-confirmed]**
- D5/D20: The tip is **outside `calculateRestaurantBill`** as its own ledger component (B composes/finalizes). It is kept outside the tax calculation (`calculateRestaurantBill`); its GST treatment is pending CA confirmation, and live tips are gated on Finance/CA sign-off (D20). Never describe tips as untaxed.
- D14 (ADR 0010): amounts in integer paise; tip cap default 25% of the post-discount pre-tax subtotal, enforced for fixed, % and custom tips; tip add/change/remove increments billVersion and supersedes the request; disabling tips affects new bills only (open confirmed bills keep their tip). QR amount = bill total + confirmed tip.
- D6/D9: Percentage tip = rate × **post-discount, pre-tax item subtotal**, **excluding packaging and service charge** (D9, Finance proposal pending Founder). The base is configurable per restaurant. Rounded **half-up to the whole rupee** (e.g. ₹12.50 → ₹13, ₹12.49 → ₹12). The amount is shown before the customer confirms. Fixed and custom tips are whole rupees as entered.
- D12: if the tip base is ₹0, the tip prompt is hidden entirely (no %, fixed or custom).
- D4: In partial payments the tip is allocated last.
- D3: An overpayment is never converted into a tip. The excess is refunded through the provider.

## 2. Tip record (per Founder order)
amount, currency=INR, selectionSource (none/fixed/percentage/custom), confirmation (who, when), orderId, billId+version, paymentRef, outletId, timestamp, plus a proposed field: policyIdAtTime.

## 3. Ledger accounts (proposed chart, per outlet; account names are placeholders pending CA)
| Account | Use |
|---|---|
| Food & beverage sales (existing) | From `calculateRestaurantBill` |
| Output taxes (existing) | From `calculateRestaurantBill` only. The tip is kept outside this calculation; its GST treatment is pending CA confirmation (D20) |
| **Customer Tips Payable / Held** (liability, proposed) | Credited when a payment carrying a tip is VERIFIED |
| Tip Payouts | Debit Tips Payable when the outlet pays out under its policy (recorded by the restaurant; TRONX holds no money) |
| Tip Refunds | Reverses Tips Payable when a payment is refunded |

Classifying tips as a liability rather than income is a **proposal for the CA**. Money settles to the restaurant's merchant account (Founder order), so TRONX records but never holds or distributes tips.

## 4. Reconciliation
- Settlement lines are gross. Split them using **committed verified ledger component allocations only** (not the confirmed tip; an unpaid or under-review tip is not collected). Partial payments allocate bill components first and the tip last (D4, PAYMENT_WORKFLOWS.md §4).
- Daily check per outlet/merchant/currency: Σ verified allocated tips = Σ Tips Payable credits. Closing = opening + verified allocated credits − verified reversals − authorized recorded payouts ± typed, audited adjustments. Selected, pending/review, verified collected, refunded and net are reported separately (ADR 0010).
- Tip changed after the PR was issued: billVersion increments, the PR is SUPERSEDED (D16/D17), and a new PR is issued. Money on a superseded PR → MANUAL_REVIEW (D8).
- A refund of a bill that included a tip: reverse the tip proportionally, or the whole tip? **Open (CA/Founder).**
- Provider fees on the tip portion: fee data is **TBD** (PROVIDER_CAPABILITY_RESEARCH.md). Whether fees reduce tips paid out is an **open question**.
- Payout reports show allocation only if the outlet has configured a policy. Otherwise they show totals only.


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

## 4a. Receipt presentation and customer wording (ROS-E15-T008)
Consistent with UX_SPEC.md §1 (label "Tip (optional)"), §5 (tip step) and §11 (receipt).

**Receipt (customer page + WhatsApp, only after verified payment):**
```
Items … · Taxes … · Bill total        ₹500.00
Tip (voluntary)                       ₹50.00   ← only if a tip > 0 was confirmed
Total paid                            ₹550.00
```
- The tip is a **separate line after the bill total**, labelled as voluntary. It is kept outside the tax calculation, and its GST treatment is pending CA confirmation (D20). The receipt must not state or imply that the tip is untaxed. If the CA's approved treatment requires tax lines, B snapshots them, and this layout is revised before live tips.
- No tip line appears when tips are OFF or the customer chose "No tip" (UX_SPEC AC-1b.2). Historical records keep their tip lines.
- For partials, list each payment. The tip is allocated last (D4).
- Whether the tip belongs on the tax invoice or on a separate payment receipt is **open (CA Q2)**. Live tips are gated on the CA answer and Finance sign-off (D20).
- Label: Finance proposes "Tip (voluntary)" on the receipt, against UX_SPEC's "Tip" (§11) and "Tip (optional)" (§1). Both are acceptable. **Founder signs off the final wording (UX_SPEC Q7).**

**Customer tip-step wording (matches the UX_SPEC §5 CEO default):** "Add a tip (optional)", "No tip", and "{n}% ₹{amount}" chips. No option is preselected, and Pay is disabled until a choice is confirmed. Allowed text: "Tips are optional." **Not allowed:** guilt or pressure copy ("Your server worked hard"), "for your server", or any claim that a tip goes to a specific person or directly to staff. Any allocation wording only appears if the outlet has configured a legitimate policy, and it describes that policy factually.

**Tax treatment:** none is assumed. See §5. The board AC "written professional guidance recorded" stays **open** until the CA answers.

See also FINANCE_RESPONSE_TO_CTO_REVIEW.md (journal entries, refunds, reporting).

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
