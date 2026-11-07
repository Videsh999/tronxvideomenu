# ADR 0006 — Payment provider abstraction and direct settlement

- Status: Proposed
- Date: 2026-11-07

## Context

The Founder flow is ORDER -> BILL -> WHATSAPP -> EXACT AMOUNT QR -> VERIFIED PAYMENT -> RECEIPT. Restaurant OS remains a Next.js modular monolith. ADR 0001 uses `restaurantId` for outlet and `organizationId` for organization. ADRs 0003–0004 reserve pricing, money writes, versions, and transactions to B. An integration must not introduce a second ledger or a TRONX wallet.

## Decision

- Each outlet connects its own verified merchant account, settling directly from provider to that restaurant's verified bank. No TRONX pooled merchant, custody, wallet, collect-and-redistribute, platform commission deduction from restaurant takings, or cross-outlet funds transfer. TRONX calls provider APIs; it never holds or routes settlement funds. Refunds use the originating merchant account. SaaS subscriptions are billed separately.
- Server-only adapter contract under `lib/payments/**`: `capabilities(merchantContext)`, `createPaymentRequest(immutableBillContext, idempotencyKey)`, `getPaymentStatus(providerReference)`, `closePaymentRequest(reference, reason)`, `verifyAndNormalizeWebhook(rawBody, headers, connectionContext)`, `requestRefund(paymentReference, amountPaise, idempotencyKey)`, `getRefundStatus(refundReference)`. Unsupported capabilities fail explicitly. Normalize references, integer-paise amounts, currency, finality, occurrence time, and verification evidence. Adapters never mutate orders or ledger.
- Trusted context contains org/outlet, connection id, provider/environment, immutable merchant id, and credential-version reference. Clients cannot choose credentials, merchant, payable amount, or test/live mode. Only B's finalized bill contract supplies amount. Fallback requires a separately onboarded outlet account and a new request after invalidating the old one, never silent rerouting of an in-flight payment.
- Store outlet credentials encrypted with authenticated encryption/key versions and org/outlet/provider/environment/connection bound as authenticated context. Rotate with limited overlap. No bank passwords/UPI PINs, secrets in browsers, or tokens/signatures/account data/full protected QR URLs in logs. Redact phones and payment data per ADR 0005. Retain immutable merchant bindings for old requests; revoked authorization may make reconciliation unavailable and must trigger operator escalation, not continued use of revoked tokens.
- Persist capability evidence per product/account/environment: dynamic QR, fixed-amount enforcement, single-use behavior, expiry/close, lookup, signature scheme, refunds and explicit instalments. UPI intent `am` is merely a prefill unless the product explicitly enforces more; do not transfer a QR guarantee to a link/intent product. Always check received amount and bill version server-side (ADR 0008).

### Provider verdict — conditional architecture approval, not production approval

Read `PROVIDER_CAPABILITY_RESEARCH.md`; independently spot-checked the official sources below with WebFetch on 2026-11-07 (IST). Documentation is not a completed integration test or contractual entitlement.

**Primary: Razorpay Technology Partner OAuth + merchant-owned QR Codes, the conditional primary, pending the Founder. Conditionally approved for design and proof-of-capability only.** The [Create QR API](https://razorpay.com/docs/api/qr-codes/create/) explicitly states `fixed_amount=true` accepts only the specified amount, `payment_amount` disallows less or more, and `usage=single_use` closes after one payment. This is documented provider-product enforcement, stronger than amount prefill; it does NOT prove every UPI rail/app or every Razorpay link product has the same universal guarantee. QR is an on-demand account feature. The [OAuth integration](https://razorpay.com/docs/partners/technology-partners/onboard-businesses/integrate-oauth/integration-steps) explicitly gives each sub-merchant a unique server-only access token and merchant account id, refresh/revocation behavior, and separate development/production clients. OAuth delegation alone is not proof of settlement configuration.

Primary conditions:

1. TRONX Technology Partner approval, merchant consent, per-outlet QR entitlement under the approved OAuth scopes, verified restaurant merchant/bank ownership, refresh/revoke handling, and written no-split direct-settlement terms. Do not request RazorpayX payout scopes. [Control of Funds](https://razorpay.com/docs/partners/technology-partners/control-of-funds/) describes platform/third-party fee distribution, NOT proof that the required zero-platform-fee configuration is already approved. Do not enable Route/Control of Funds; obtain written provider confirmation of the proposed flow.
2. Pin current API behavior and clarify expiry: Create API says minimum 2 minutes, maximum/default 2 hours, returned `close_by` authoritative; [Close API](https://razorpay.com/docs/api/qr-codes/close) still says minimum 15 minutes / maximum 45 days. Honor returned provider expiry and local expiry, close old requests, reconcile races, and promise no unsupported timing guarantee.
3. Honest sandbox plan: the [QR guide](https://razorpay.com/docs/payments/qr-codes/create) says test-mode PG QR disappears after two seconds and only live QR can be scanned. Test adapter contracts, signed callback fixtures/provider test webhooks, authenticated status lookup where supported, concurrency/version races, and actual app flows with clearly labelled simulated QR outcomes. Ask provider for a supported no-money QR harness. These tests cannot establish live-bank scan behavior or actual wrong-amount rejection. Keep that acceptance explicitly NOT TESTED until a supported no-money facility exists or the Founder separately approves a narrowly scoped live validation later. Never substitute a real payment now or claim full QR-scan E2E passed.
4. Server verification of merchant/reference/amount/currency/current bill version always, even with fixed amount. Explicit partials are separate exact instalment requests, not edited QR underpayments. Provider account tariffs and product availability require written confirmation.

**Cashfree Embedded PG is a capability proof only. It is not an interchangeable exact-amount fallback, and there is no exception to credential isolation.** The [Order Pay API](https://www.cashfree.com/docs/api-reference/payments/latest/payments/pay) documents order-session `upi.channel=qrcode`, transaction expiry, and S2S enablement. It does not explicitly promise non-editability or wrong-amount rejection: enforcement remains UNVERIFIED. Its prose requires GST return evidence of annual turnover >₹1 crore for seamless non-card S2S; obtain written applicability/eligibility for each small restaurant/Embedded merchant, not an assumed exemption. [Embedded onboarding](https://www.cashfree.com/docs/partners/embedded/embedded-merchant-onboarding) documents KYC/merchant lifecycle. [Terminate Order](https://www.cashfree.com/docs/api-reference/payments/latest/orders/terminate-order) can return `TERMINATION_REQUESTED`; a successful active transaction can prevent termination, so closing is not proof money cannot arrive.

Fallback hard conditions:

1. Embedded Partner (not reseller/affiliate) approval, per-merchant entitlement, S2S eligibility, written merchant-direct/no-split settlement terms, account/bank verification, and provider-supported QR testing. No Easy Split.
2. Written exact-amount rejection/expiry semantics plus supported tests before any exact-amount flow, including pay-before-preparation, can use Cashfree. Server checks alone prevent false settlement but do not turn an editable QR into an exact-amount-enforced QR. Until then do not advertise it as such or auto-switch to it.
3. Important research refinement: [Embedded PG](https://www.cashfree.com/docs/partners/embedded/integration/gateway-integration) uses a **common partner API key plus `x-partner-merchantid`**, not separate OAuth tokens for every merchant, and verifies partner PG webhooks using **partnerApiKey**, not merchantSecretKey. This differs from the research's generic PG client-secret formula. There is no exception to credential isolation. Cashfree stays a capability proof until it supplies merchant-scoped credentials that meet the per-outlet encrypted-credential rule. Do not approve a shared partner-secret broker, and do not copy a shared key into outlet credential rows. Merchant onboarding webhook security is yet another product contract; pin it separately.
4. Native WhatsApp Enhanced Payment Links/deep-integration claims are not approved by this spot check. Research reports Cashfree EPL allowlisting and production-only native links; verify current Meta entitlements before selecting that mode. Ordinary approved billing templates carrying supported provider links are a separate integration. Do not claim a sandbox-native EPL demonstration.

For BOTH providers, qualified counsel and provider must review the actual no-funds-handling contract/operations and TRONX's RBI classification. The [RBI 2025 Directions](https://www.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=12896), independently read, distinguish PA (paragraph 4(i), aggregates then settles) from PG (4(j), technology without funds handling); paragraph 10(g) excludes PG from that direction's scope. This is not a legal opinion that TRONX qualifies or is exempt. No public “RBI compliant” claim without counsel. Finance/CA must confirm tip/GST treatment. CTO must review current India payment and WhatsApp policy before production. Neither provider is production-approved by this ADR.

## Consequences

Outages leave pending/review, not paid. POS retains bills and authorized alternative collection methods through B's writer. Receipt proves verified collection, not final bank settlement. Test/live credentials, callbacks, requests and keys remain separated. Demo is “TRONX WHATSAPP PAYMENT DEMO”, sandbox/synthetic only, no real money or real-customer messages. PRs target `pro-max/release`; Founder approval is required before payments, go-live, or merges/deploys to main. All conditions above are gates, not completed tests.

## Alternatives

A pooled TRONX merchant violates the order. SDK calls throughout billing duplicate authority. A static QR or hand-built UPI intent is not an exact-amount substitute. Other researched providers remain unselected pending product/merchant entitlement and amount-enforcement proof; no universal absence-of-capability claim is made.

## Security

Role-gated connection management, server-bound OAuth state/redirect validation, CSRF/origin protection, scoped callbacks, least privilege, encrypted refresh tokens, redacted structured logs, quotas and SSRF-resistant endpoint allowlists are mandatory. A callback merchant hint is untrusted until authenticated. Captains have no refund, settlement, cash-close or connection rights by default.

## RELEASE_GATES

None of these are completed by this ADR. Each is a gate, and none is a claim that a test passed.

- Provider terms: written no-split, merchant-direct settlement, and the product entitlement for the outlet's own merchant account.
- Counsel's review of TRONX's RBI classification. No public "RBI compliant" claim comes from this document.
- Finance and the CA confirm whether GST applies to tips before tips are enabled for a live outlet.
- Migration safety: index, backfill, rollback, and restore steps are recorded before any payment collection is written.
- Sandbox evidence is not a live scan. Razorpay test QR codes cannot be scanned. A simulated or fixture result is labelled as such and is not a live-bank scan.
- Cashfree is a capability proof only. There is no exception to credential isolation, and it is not an interchangeable exact-amount fallback.
- Founder approval is required for the first real-money test, for go-live, and for any merge or deploy to `main`.

## Test/acceptance criteria

- Cross-org/outlet/merchant and test/live isolation, encrypted credentials, refresh/rotation/revocation, redaction and authorization tests pass.
- Adapter contract covers unsupported capabilities, outages, timeout-after-create, repeat keys, disconnect and closure races; no blind second request after timeout.
- Sandbox/fixture matrix includes ₹1/20/149/520/1250, wrong amounts, reuse, expiry, old bill, duplicate pay, partial instalments, refunds and concurrency. Label simulated vs provider-sandbox vs live evidence separately.
- Obtain provider/counsel/Finance approvals and account-specific exact-amount evidence; satisfy unresolved scan-test gate before production acceptance. No live validation or customer send is authorized here.
