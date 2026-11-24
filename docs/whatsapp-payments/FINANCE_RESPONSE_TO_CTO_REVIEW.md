# Finance response to CTO review (F1–F10)
> **DRAFT — Finance Manager, 2026-11-07, pending Founder/CEO review.** Responds to `CTO_REVIEW_SIX_DOCS.md` §"Concrete Finance / CA questions". Grounded in decisions D1–D20 (decision logs in PAYMENT_WORKFLOWS.md and the companion drafts) and ADRs 0007/0009/0010 (this folder). Provider facts come only from `PROVIDER_CAPABILITY_RESEARCH.md` (PCR), cited by section; anything else is **TBD**.
> Tags: **FINANCE DEFAULT** = operational proposal Finance can own (still pending Founder/CTO where noted). **NEEDS CA** = legal/tax/payroll/statutory point, phrased as a question; this document states none of them as fact.
> Tip tax wording (D20): the tip is kept outside the tax calculation, and its GST treatment is pending CA confirmation. Live tips are gated on CA answers and Finance sign-off. This document never says tips are untaxed.

## Proposed chart of accounts (per outlet; names are placeholders)
| Code | Account | Type |
|---|---|---|
| A1 | Provider Receivable / Clearing (per merchant account) | Asset |
| A2 | Bank (restaurant's settlement account) | Asset |
| A3 | Payments Suspense: Unapplied / Under Review | Liability (holding) |
| R1 | Food & Beverage Sales | Income |
| R2 | Packaging / Service Charge income (per calculator) | Income |
| L1 | Output tax payable (CGST/SGST/IGST from `calculateRestaurantBill`) | Liability |
| L2 | **Variant L:** Customer Tips Payable | Liability |
| R3 | **Variant I:** Tip Income | Income |
| E1 | Payment provider fees | Expense |
| E2 | Input tax on provider fees (if claimable: NEEDS CA) | Asset/expense |
| E3 | Staff tip distribution expense (Variant I only) | Expense |
| L3 | Customer Refunds Payable | Liability |

No TRONX accounts: money settles directly to the restaurant (Founder order; PCR §9). TRONX records but never holds or distributes funds.

---

## F1. Is a tip a liability, a pass-through, or income? — **NEEDS CA** (with FINANCE DEFAULT entries for both variants)
**Questions for the CA:** Under the restaurant's contracts and staff policy, is a voluntary customer tip a liability held for staff, a pass-through, or restaurant income later paid as remuneration? Who is the beneficial owner? What are the TDS, PF, ESI and wage-law implications of each treatment?
**FINANCE DEFAULT:** support both variants in the ledger as configuration, with no default enabled for live use until the CA chooses. Entries show accounts and directions only:
| Event | Variant L (liability) | Variant I (income) |
|---|---|---|
| Verified collection (bill + tip) | Dr A1; Cr R1/R2; Cr L1 (as calculated by B); Cr **L2** (tip) | Dr A1; Cr R1/R2; Cr L1; Cr **R3** (tip) |
| Allocation (D4: bill first, tip last) | Credits to L2 only for verified, allocated tip | Same, to R3 |
| Restaurant-recorded payout to staff | Dr L2; Cr A2 | Dr E3; Cr A2 (payroll treatment NEEDS CA) |
| Settlement | Dr A2; Dr E1 (fees); Cr A1 | same |
| Refund of tip | Dr L2; Cr L3 → Dr L3; Cr A1/A2 | Dr R3; Cr L3 → Dr L3; Cr A1/A2 |
| Chargeback on tip | Dr L2 (or receivable from staff if already paid out: NEEDS CA); Cr A1 | Dr R3; Cr A1 |
| Unapplied / review money | Dr A1; Cr A3 until resolved | same |
Tax entries on the tip: **none are proposed until the CA answers F2.** If required, B snapshots them (D20).

## F2. GST on tips — **NEEDS CA**
Questions: Is a voluntary tip, collected in the same UPI payment as the bill, part of the value of supply under the outlet's state facts? If yes: on what base, at what rate, inclusive or on top, and with what rounding? Does a mandatory service charge on the same bill change the answer? What must B snapshot per bill version, and what reports are needed?
**FINANCE DEFAULT (operational only):** the tip is kept outside the tax calculation (D5/D20). Live tips are blocked until signed CA treatment exists as a versioned tax policy (ADR 0010).

## F3. Tips on invoices, receipts and credit notes — **NEEDS CA** (layout is FINANCE DEFAULT)
Questions: Should the tip be a tax-invoice line, a separate receipt line, or a separate document? Which numbering series applies? What credit-note or refund documents are needed when a tip is refunded? How should refund documents link to the original bill version?
**FINANCE DEFAULT layout:** a separate "Tip (voluntary)" line after the bill total, then "Total paid" (TIP_ACCOUNTING §4a; label is a default pending Founder). No wording that the tip is untaxed. Refund documents reference the original bill version and the refunded components. A partial acknowledgement is distinct from a final paid receipt (CTO review).

## F4. Rounding, 25% cap boundary, instalment remainders — **FINANCE DEFAULT**
- All ledger amounts are **safe integer paise** (ADR 0010).
- Tip rounding: D6 says half-up to the whole rupee. The box copy of ADR 0010 says nearest-paise half-up computed by B. **Conflict flagged for the CTO.** ADR wording wins once confirmed (D14).
- Cap (D14): default 25% of the post-discount pre-tax item subtotal, enforced for fixed, % and custom tips. **Rounding never exceeds the cap.** If the rounded % tip is above the cap, use the largest rounding unit ≤ cap. A custom or fixed tip above the cap is rejected, never silently reduced (V53–V55).
- Base ₹0 → tip prompt hidden (D12). If the base is tiny and no whole-unit tip fits within the cap, no tip is offered (V55).
- Instalments: exact amounts entered by staff in paise. When staff choose "split into N equal", each part is floor(balance/N) and **the last instalment carries the remainder**, so no paise are lost. Each instalment is computed from the ledger balance at creation (D15/D17).
- Component/invoice residuals: B allocates whole paise per component in D4 order. Any residual sits in the last component allocated. **NEEDS CA** only if invoice tax rounding rules apply.

## F5. Allocation order and waiving an unpaid tip — **FINANCE DEFAULT** (tax-component ordering NEEDS CA)
- Order (D4): bill components first (items/charges and their taxes as snapshotted by B, proportional within the bill obligation per B's versioned rule), then the tip. The rule is versioned.
- Question for the CA: does the order across tax vs base within the bill obligation matter for tax remittance?
- **Waiving an unpaid confirmed tip:** when the bill obligation is fully paid but the tip is unpaid, a Cashier/Manager/Admin (or the customer via "Change tip") removes the tip with a reason. This creates a new billVersion (ADR 0010), SUPERSEDES the active request (D16/D17), and is audited. The kitchen is never blocked by an unpaid tip (D14).

## F6. Refunds — **FINANCE DEFAULT** (documents/tax NEEDS CA)
- Authority: **Manager/Admin only**, with reason and audit. No automatic refunds. D3's "refund excess" is an outcome a Manager/Admin must still approve, not auto-authorization (CTO review).
- Components: tip-only, base-only, combined or partial refunds reverse **actual verified allocations**, not proportional assumptions. Each refund is capped by the remaining refundable amount of each component. Stable refund refs and concurrency fencing prevent duplicates (ADR 0010).
- Method: to the original merchant and method via the provider refund API. Refund APIs are documented for Razorpay, Cashfree, PayU and Paytm (PCR §§3, 4, 6, 7). Timing and fees are **TBD** (PCR §8 says refund-fee retention is unverified).
- Tip already paid out to staff: no silent negative balance. Raise a recoverable or adjustment entry flagged for review. **NEEDS CA**: recoverability from staff.
- Questions for the CA: credit-note and tax reversal on refunds, and exceptions to refunding to the original method.

## F7. Settlement matching, windows, suspense — **FINANCE DEFAULT** (windows TBD)
- Match/dedupe identity: provider + environment + merchant + payment ref + entry kind. Fallback: request ID + merchant (PAYMENT_WORKFLOWS §5). Amount must match exactly; no tolerance is sourced.
- Bank equation per merchant/period: gross verified collections − provider fees − tax on fees − refunds − chargebacks ± adjustments = bank credit (by UTR). Cashfree settlement reports include UTRs, fees, taxes, refunds and transaction refs (PCR §4). Other providers' schemas are **TBD**.
- **Windows: TBD.** Settlement timing is as agreed in the PA–merchant agreement, not a universal T+1 (PCR §9). A written merchant settlement contract is required (PCR §4, §11). Until then, aged unsettled items are flagged UNSETTLED_AGED with a manual follow-up threshold set per merchant contract.
- Suspense (A3): holds missing-callback money, unmatched bank credits, old-version/superseded money (D8), post-close money (D19), duplicates and revoked-access cases. Each item gets an owner, an age and an escalation step. It is released only by a Manager/Admin action with reason, through a B ledger command. Report duplicates dedupe without money effect.

## F8. Fees on the tip portion and payout controls — **NEEDS CA** (controls are FINANCE DEFAULT)
- Published list prices only, not quotations (PCR §8): Razorpay 2% PG / 0.99% UPI QR row + 18% GST on fee; Cashfree 1.95% + taxes with a new-merchant offer; PayU UPI pricing varies; Paytm 1.99% + 18% GST. The applicable TRONX/restaurant tariff is **UNVERIFIED/TBD**.
- Questions for the CA: May the restaurant lawfully deduct a proportional provider fee from tips allocated to staff? Who bears it by default?
- **FINANCE DEFAULT:** record the fee on the whole collection in E1. Allocate no fee to tips unless the outlet's approved policy says so and the CA confirms. Payouts are recorded by the restaurant only (TRONX never pays). Each payout needs an approved allocation policy, an approver (Manager/Admin), a period, recipients, evidence (signed sheet or bank ref), and partial-payout support. Negative tip liability is blocked and flagged. With no policy, totals only and no allocation (ADR 0010).

## F9. Reporting — **FINANCE DEFAULT**
- Business day: IST (Asia/Calcutta) calendar day. Cutoff default 00:00 IST, configurable per outlet for late-night trade. Proposal pending Founder.
- Three dates per entry: collection (verification) date, settlement date (provider), bank credit date. Reports pick one explicitly.
- Balances: opening/closing for Tips Payable, Suspense and Provider Receivable per outlet/merchant/currency.
- Tip reporting: selected, pending/review, verified collected, refunded and net, by outlet, bill, period and method (ADR 0010).
- Late events (late payments, post-close money, refunds after close): **no rewriting of closed periods.** Post adjustments in the period they are resolved, linked to the original bill/version. Write-offs are typed and audited. Exports: outlet, merchant, bill, method.

## F10. Evidence, retention, access, sign-offs — **NEEDS CA** (retention) / FINANCE DEFAULT (controls)
- Evidence kept: tip consent (bill version, choice, time, source), webhook/status payload digests and verification result, receipts, refund approvals, review resolutions, payout evidence, reconciliation runs.
- Questions for the CA/counsel: What statutory retention periods apply to invoices, payment and tip records, and consent evidence? Are there data-protection limits on storing phone and consent data?
- Access (FINANCE DEFAULT): captains have no refund/settle/allocation rights. Cashier: create instalments, collect. Manager/Admin: review resolution, refunds, payouts, tip waivers. Finance: read all plus reconciliation sign-off. All of it is audited, and phones/tokens are never logged (ADR 0010).
- **Gates before live rollout:** (1) CA written answers to F1–F3, F6, F8, F10; (2) Finance sign-off of the chart/entries variant and the reconciliation procedure; (3) a written merchant-direct settlement contract and fee tariff per provider (PCR §11); (4) Founder approval of D1–D9 and D12–D13 and tip wording; (5) CTO confirmation of ADR 0007–0010. No live tips before (1)–(2).
