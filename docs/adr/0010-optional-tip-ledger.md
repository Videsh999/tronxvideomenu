# ADR 0010 — Optional tips as a separate ledger component

- Status: Proposed
- Date: 2026-11-07

## Context

Tips must be voluntary and separately reportable, not hidden inside menu revenue/service charge. No legal tax treatment is assumed. ADRs 0003/0008 preserve billing snapshots and ledger authority; B remains the only calculator/writer.

## Decision

### CEO defaults (configurable, pending Founder confirmation)

- All tip money is stored in integer paise.
- The tip is computed in paise on the post-discount, pre-tax subtotal, then rounded half-up to the whole rupee.
- A configurable tip cap defaults to 25% of that tip base.
- The tip stays outside the tax calculation. GST treatment is pending CA confirmation. This ADR does not claim that tips are untaxed.
- Turning tips off affects new bills only. Historical tips stay intact.
- A tip is never preselected.
- Neutral copy is `Add a tip (optional)` and `No tip`.

- `ENABLE_CUSTOMER_TIPS` defaults OFF per outlet, with eligible order types, suggestions, custom permission, limits and config version. OFF means no new tip controls, prompts, QR component, or tip receipt line. Historical tip lines stay on the records that already have them. Turning tips off does not rewrite those historical bills and does not silently reduce an amount already confirmed on them.
- ON offers no tip, fixed, percentage, or allowed custom amount. No nonzero preselection, forced tip, inferred confirmation, or obstructed no-tip choice. Require affirmative customer confirmation of tip and displayed grand total. Staff-assisted capture records source and affirmative customer evidence; staff cannot invent consent. Zero remains valid.
- Percentage base under the CEO default: snapshotted item subtotal after item discounts, excluding tax, packaging, service charge, and tip. Show that base. B stores the amount in integer paise, computes the percentage in paise, then rounds half-up to the whole rupee. The cap defaults to 25% of that base and is configurable. The tip stays outside `calculateRestaurantBill`. GST treatment is pending CA confirmation. Do not claim the tip is untaxed. Custom client amounts are validated inputs, never authoritative totals. A different approved percentage base is explicit and versioned, never frontend-only math. A tip is never preselected. The neutral labels are `Add a tip (optional)` and `No tip`.
- Separate tip component records safe-integer `amountPaise`, currency, source (none/fixed/percentage/custom/staff-assisted), rate/base where applicable, confirmation evidence/time, org/outlet/order/billVersion, collection/payment reference, and timestamp. Keep selected, verified collected and refunded tips distinct. Exclude tips from service-charge base, food revenue and coupon/discount base.
- The tip is kept outside the tax calculation. GST treatment is pending CA confirmation. This is not a claim that tips are untaxed or exempt. Finance and the CA must confirm GST and invoice treatment before live enablement. If they require tip tax, B snapshots that calculation. Do not infer a statutory exemption from this ADR.
- A 500 base + explicitly confirmed 50 tip produces 550 only through B's finalized snapshot. Add/change/remove tip increments billVersion, supersedes/expires the old request and creates a new one (ADR 0007). No-tip flow stays 500. Late old money is review, never silent settlement or extra tip.
- B allocates verified payments to named ledger components under a deterministic versioned rule; proposed partial-payment default is base obligation first, then tip. Excess is unallocated review, not unsolicited tip. Tips can be refunded separately or with base, bounded by verified remaining refundable component amounts. Stable refund refs and concurrency fencing prevent duplicate refunds; partial refund does not erase the original collection or mark every component fully refunded.
- I5 reports tips independently by outlet, bill, period and payment method: selected, pending/review, verified collected, refunded and net. Sum components back to ledger totals. Staff allocation is reporting only under a configured legitimate approved policy; never promise direct employee delivery, or create TRONX payouts/funds handling.

## Consequences

Tip confirmation changes the payable contract but not historical line tax snapshots. New receipts/WhatsApp display separate tip only when applicable; historical tip data stays readable after OFF. Finance/CA and Founder decisions gate rollout. C/G/E own current UI files through queued patches, B owns money logic, I5 owns reports; O does not duplicate any.

## Alternatives

Tip-as-service-charge/revenue, auto-selected tips, treating overpayment as consent, and asserting tax exemption are rejected.

## Security

Outlet/capability checks, confirmation binding to bill version, server caps, CSRF protection and audited configuration/refund actions. Protect confirmation/contact evidence; do not log phones or payment tokens. Captains have no refund or allocation authority by default. Display edits cannot change financial truth.

## Test/acceptance criteria

- OFF removes all new tip surfaces and lines. Historical tips stay intact. Turning tips off does not rewrite a bill that already has a confirmed tip.
- ON: no tip, fixed, 5/10/15 percent, or custom, none preselected, explicit confirmation, eligible order types. The percentage is computed in integer paise and rounded half-up to the whole rupee. The cap defaults to 25% of the tip base and is configurable. The tip stays outside the tax calculation. No discount or service-charge contamination, and cross-outlet rejection.
- 500 + 50 = 550; change/removal versions and invalidates old QR; late payment and overpayment review without invented tip consent.
- Exact instalment allocations, tip-only/base-only/combined/partial refunds, concurrent retries and report/ledger reconciliation have one effect.
- Finance/CA approved GST/invoice configuration precedes live tips. Record actual evidence in CUSTOMER_TIP_CONFIGURATION.md and TIP_ACCOUNTING_AND_RECONCILIATION.md; no test pass is asserted by this proposal.
