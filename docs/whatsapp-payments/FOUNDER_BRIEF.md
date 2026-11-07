# Founder execution orders, 2026-11-07 (verbatim intent, condensed by CEO)

## Order 1: WhatsApp billing + dynamic UPI payment
Flow: ORDER -> BILL -> WHATSAPP -> EXACT AMOUNT QR -> VERIFIED PAYMENT -> RECEIPT.
- Money settles directly from the provider to the restaurant's own verified merchant account. No TRONX wallet. No collect-and-redistribute.
- Admin: Settings -> Payments & WhatsApp
  - A. Payment provider: selection, merchant onboarding and connection, status, UPI methods, dynamic QR and payment link capability, webhook config, test/live mode.
  - B. WhatsApp Business: account and phone number, templates, message status, consent, delivery logs.
  - C. Billing rules: notification timing, auto or manual sharing, receipts, partial payments, expiry, per-outlet config.
- Provider abstraction. Never invent merchant credentials. Verify provider capabilities before implementing.
- Dynamic QR per bill (e.g. Rs 1/20/149/520/1250). Each request is tied to org, outlet, order, bill, payment request ID, merchant account, expected amount, currency, expiry and provider reference. The amount comes from the server-side bill only, never the frontend. A request can't be reused for another order. Never claim exact-amount enforcement unless the provider guarantees it (a static UPI QR doesn't).
- WhatsApp itemized bill: restaurant, outlet, order number, table, date/time, items, quantities, line totals, discounts, coupon, packaging, tax breakdown, payable, payment link, QR where supported, bill reference. Send only finalized bills. Version the bill when items are added. No duplicate sends per version.
- Verification: only via a signature-verified webhook or an authenticated provider status check. Check merchant, payment reference, order reference, amount, currency and status. Idempotent. A wrong amount never silently settles. Statuses: PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED, PARTIALLY_PAID, REFUND_PENDING, REFUNDED, MANUAL_REVIEW. The existing payment ledger stays the source of truth.
- Partial payment (500 = 200 + 300): record the 200, mark PARTIALLY_PAID, generate a new request for 300, resend on WhatsApp, mark paid only when the 300 is verified. No overpayment and no duplicates.
- Captain and POS share one payment logic and are role-gated. Captains get no refund, settlement or cash-close rights by default.
- Each outlet has its own merchant config, fully isolated. Store no bank passwords, UPI PINs or secrets in the browser or logs. Use encrypted secret storage, rate limits, consent records and phone protection.
- Failure cases: WA down, invalid number, template rejected, QR fail, provider down, expiry, delayed or duplicate webhook, wrong amount, partial, full, refund, double pay, bill changed after QR, merchant disconnected. If WA fails, the bill stays available in POS. If the QR fails, other authorized methods can be used. If in doubt, show Pending or Manual Review.
- The CTO reviews India payment requirements and WhatsApp policy before production.
- Demo: "TRONX WHATSAPP PAYMENT DEMO", provider sandbox only, no real money, no messages to real customers.
- Docs: WHATSAPP_BILLING_ARCHITECTURE.md, DYNAMIC_UPI_QR_IMPLEMENTATION.md, PAYMENT_WEBHOOK_SECURITY.md, WHATSAPP_TEMPLATE_GUIDE.md, PAYMENT_RECONCILIATION_REPORT.md, WHATSAPP_PAYMENT_E2E_REPORT.md.
- No live payments until merchant onboarding and production credentials are properly configured.

## Order 2: Billing policy + optional tips
Flow: ORDER -> RUNNING BILL -> FINAL BILL -> OPTIONAL TIP -> DYNAMIC QR -> VERIFIED PAYMENT -> RECEIPT.
- Settings -> Billing & Payments -> Billing Preferences. Policies:
  - PAY_BEFORE_PREPARATION. Kitchen release is a separate policy and is not forced.
  - PAY_AFTER_MEAL. Table session with multiple orders and a running bill.
  - FLEXIBLE. Set by outlet or order type (dine-in, takeaway, delivery, reservation), with clear precedence and the effective policy shown to managers.
- Bill timing options: at order submission, on customer request, by captain, at checkout. Order, bill, payment request, collection, verification and receipt are kept as separate concepts. Running-bill snapshots and audit history are preserved. The final amount comes from the server-side billing service.
- Tips: ENABLE_CUSTOMER_TIPS, default OFF. When off, there's no tip UI or QR component anywhere, and no tip receipt line except on historical records. When on: no tip, fixed, percentage or custom tip. Configurable suggestions, custom permission, order types and per-outlet toggle. Never preselect or force a tip, and require explicit confirmation.
- Tip records: amount, currency, selection source, confirmation, order, bill, payment reference, outlet and timestamp. Kept separate from food revenue. No assumed tax treatment (Finance verifies with professional guidance). Allocation reporting only under a configured legitimate policy. Never promise a tip goes directly to an employee.
- The QR carries the final confirmed amount (500 + 50 tip = 550). When the bill changes, the old request is superseded or expired and a new one is issued. A late payment on an old request goes to reconciliation and never silently settles.
- WhatsApp follows the policy. Confirmation and receipt are sent only after verified payment.
- Test restaurants: A = pay-before, tips off. B = pay-after, tips on (5/10/15%, custom). C = flexible by order type. Run the 20 listed tests plus POS/Captain/QR/KDS/payment regression.
- Docs: RESTAURANT_BILLING_POLICIES.md, BILL_GENERATION_WORKFLOW.md, CUSTOMER_TIP_CONFIGURATION.md, TIP_ACCOUNTING_AND_RECONCILIATION.md, DYNAMIC_PAYMENT_AMOUNT_RULES.md, BILLING_POLICY_E2E_REPORT.md.
- Not complete until every policy has been demonstrated in the actual app.

## Standing constraints
Founder approval is required before going live, before merges or deploys to main, and before any payments. Never fabricate test results or provider capabilities. All work builds on Wave 1's single billing writer and payment ledger, with PRs targeting pro-max/release.

## Appendix: Part H test configurations and the 20 listed tests (Founder text, verbatim list)
Restaurant A: Pay before preparation. Tips disabled.
Restaurant B: Pay after meal. Tips enabled. Suggested tips 5%, 10%, 15%. Custom tip enabled.
Restaurant C: Flexible billing by order type.
1. Bill generated at order placement.
2. Bill generated after meal.
3. Running bill updated after additional items.
4. Customer requests final bill.
5. Tip disabled means no tip interface.
6. Tip enabled means optional tip interface.
7. No-tip selection.
8. Fixed tip.
9. Percentage tip.
10. Custom tip.
11. Exact dynamic QR amount.
12. Bill changes after QR generation.
13. Partial payment.
14. Full payment.
15. Duplicate webhook.
16. Cross-outlet configuration isolation.
17. Correct receipt.
18. Correct payment ledger.
19. Tip separately identifiable in reports.
20. Captain cannot bypass payment permissions.
Plus regression tests for existing POS, Captain, QR, KDS and payment functionality.

## Appendix: Order 1 section 11 tests ("TRONX WHATSAPP PAYMENT DEMO", sandbox, amounts Rs 1, 20, 149, 520, 1,250)
Bill generation; dynamic QR generation; exact expected amount; WhatsApp message generation; payment success; payment failure; partial payment; duplicate webhook; wrong amount; expired QR; refund; multi-outlet isolation; customer consent; receipt generation.
Section 9 failure cases: WhatsApp unavailable; invalid customer number; template rejected; QR generation fails; provider unavailable; payment expires; webhook delayed; webhook duplicated; incorrect amount; partial payment; full payment; refund; customer pays twice; bill changes after QR generation; merchant account disconnected.
