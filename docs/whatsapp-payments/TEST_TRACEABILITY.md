# WhatsApp/payment test traceability — document review

- Repository: `Videsh999/tronxvideomenu`.
- Branch head confirmed through cursor-github `get_branch`: `pro-max/audit` = `bf376e7fa98563f023a52e9ca790c3aa10145b29`.
- All source reads pinned to that full SHA: `docs/adr/0006-payment-provider-abstraction.md`, `0007-payment-request-lifecycle.md`, `0008-payment-verification-ledger.md`, `0009-billing-and-kitchen-policies.md`, `0010-optional-tip-ledger.md`, `0011-whatsapp-tenant-messaging.md`; `docs/pro-max/PATH_OWNERS.md`; `docs/whatsapp-payments/FOUNDER_BRIEF.md`.
- Review date: 2026-11-07 (IST). No GitHub writes, source changes, payments or messages. This file is the only follow-up deliverable.
- Follow-up on this branch: ADR 0006, ADR 0008, ADR 0009, ADR 0011, and TEST_PLAN.md now contain the CTO additions. Rows below change only where that text closes the gap named in the original review. Status labels remain design coverage, not test results.
- Verdict: the forward rows that were Partial are Covered where the CTO additions supply the missing assertion. Reverse rows still name the cases that were not closed. No implementation or test execution is claimed.

## Method and counts

`Covered` means the listed requirement has an explicit ADR acceptance criterion at the same scope. `Partial` means only a decision, broad umbrella or incomplete acceptance assertion exists. `Gap` means no relevant ADR requirement/criterion. These are design coverage labels, NOT test pass results. The same scenario appearing in separate Founder lists is deliberately counted once in each list; these are 57 source rows, not 57 unique executable tests.

Acceptance references `AC-0008.2` mean the second bullet under ADR 0008's `Test/acceptance criteria`, numbered locally here (the ADRs do not themselves have these IDs). References always point to the pinned repository content, not the earlier local drafts.

| Source set | Rows | Covered | Partial | Gap |
| --- | ---: | ---: | ---: | ---: |
| Part H numbered 1–20 | 20 | 20 | 0 | 0 |
| Order 1 section 11 demo tests | 14 | 14 | 0 | 0 |
| Order 1 section 9 failures | 15 | 15 | 0 | 0 |
| Restaurant configurations A/B/C | 3 | 3 | 0 | 0 |
| Explicit regression families | 5 | 5 | 0 | 0 |
| **Total** | **57** | **57** | **0** | **0** |

Reverse audit: all 28 acceptance bullets are catalogued below. **24 behavioral acceptance bullets have additional subcases not explicitly enumerated in the Founder test lists; four are release/evidence gates, not ordinary runnable tests.** Generic “correct ledger”, “refund”, “consent”, “isolation” and “regression” are not evidence that every negative/race case has a named executable test. Ten grouped fixes G1–G10 cover the partial/reverse gaps. Nothing is asserted about actual repository test implementation.

## Wording verification

1. **ADR 0009 — landed.** A `CEO defaults (configurable, pending Founder confirmation)` section now defines dine-in/pay-after, takeaway+delivery/pay-before, independent release, kitchen base excluding tips, instalment roles and Manager/Admin refund/review. Body repeats exclusion of tips. Residual: AC-0009.3's blanket “Partial ... cannot satisfy verified-payment release” needs to distinguish base paid/tip unpaid; AC-0009.5 still says the 20 tests are not enumerated although the pinned brief now contains them. Proposed fixes G8/G9.
2. **ADR 0010 — landed.** Defaults are explicitly configurable/pending Founder: post-discount/pre-tax base, half-up **rupee** rounding, configurable 25% cap, OFF affecting **new bills only**, no preselection and neutral copy. Residual: AC-0010.1 still refers to an unspecified “approved migration rule”; AC-0010.2 says only “rounding/caps” without pinning the new expectations. Fix G8; do not retain the old local draft's paise-rounding expectation.
3. **ADR 0011 — landed.** One WABA per organization default, optional outlet-scoped numbers, per-brand/outlet WABA override, every send/consent/webhook keyed by organization+outlet. Summary+secure itemized-link template default also added. Residual: AC-0011.1 tests “two restaurants/WABAs” and does not explicitly assert the new same-WABA/multiple-outlet and brand-override topologies. Fix G4/G7.
4. **ADR 0006 — landed.** Cashfree is capability proof only, no credential-isolation exception, no shared-secret broker; merchant-scoped credentials required. Header “Fallback hard conditions” remains a conditional capability checklist, not approval to use it. Add an explicit negative capability/credential test (G10).
5. **PATH_OWNERS O — present.** Backend owns new payment/messaging/API/unit-integration namespaces; Frontend owns dedicated UI only. Wave 1/B, Wave 0, H/A, D/H prerequisites and C/E/G/I5/K queued integrations remain explicit; M owns actual-app E2E, L gates/root manifests. No conflicting broad ancestor allocation introduced by O. Financial calculations/writer remain B; shared schemas H. QA and unit/integration work must follow these boundaries.

## Forward matrix

### Part H — exact numbered tests

| ID | Founder test | ADR acceptance coverage | Status | Remaining assertion / fix |
| --- | --- | --- | --- | --- |
| H1 | Bill generated at order placement | AC-0009 order-submission criterion: one server-finalized version and the server total. | Covered | Closed by that criterion. Not an execution result. |
| H2 | Bill generated after meal | AC-0009 pay-after-meal criterion: no payment request or paid confirmation before finalisation. | Covered | Closed by that criterion. Not an execution result. |
| H3 | Running bill updated after additional items | AC-0009 append criterion: running total updates, prior prices and tax stay frozen, no payable QR for the running state. | Covered | Closed by that criterion. Not an execution result. |
| H4 | Customer requests final bill | AC-0009 customer-request criterion: authorized finalisation, server amount, running snapshots retained. | Covered | Closed by that criterion. Not an execution result. |
| H5 | Tip disabled means no tip interface | AC-0010.1 OFF removes new surfaces/lines and preserves historical receipts. | Covered | See reverse toggle-rule specificity G8. |
| H6 | Tip enabled means optional tip interface | AC-0010.2 ON variants, no preselection, explicit confirmation. | Covered | — |
| H7 | No-tip selection | AC-0010.2 no-tip choice. | Covered | — |
| H8 | Fixed tip | AC-0010.2 fixed choice. | Covered | — |
| H9 | Percentage tip | AC-0010.2 5/10/15 percent, rounding/caps. | Covered | New rupee/cap assertions are reverse detail G8. |
| H10 | Custom tip | AC-0010.2 custom choice, caps. | Covered | — |
| H11 | Exact dynamic QR amount | AC-0006.3 amount matrix; AC-0006.4 account-specific evidence/scan gate; AC-0010.3 500+50=550. | Covered | Coverage is conditional; no Razorpay sandbox scan proof is claimed. |
| H12 | Bill changes after QR generation | AC-0007.3 item/discount/tip/reprice invalidation; AC-0010.3 QR invalidation. | Covered | Late actual money/race variants need named tests G5. |
| H13 | Partial payment | AC-0007.4 exact 200+300; AC-0008.4 exact instalments. | Covered | Must be separate fixed instalment requests, not 200 against a 500 QR. |
| H14 | Full payment | AC-0008 verified-full-payment assertion: balance zero, paid once, one paid receipt; partial, pending, and failed do not. | Covered | Closed by that assertion. Not an execution result. |
| H15 | Duplicate webhook | AC-0008.2 same event twice/different events one payment; AC-0008.3 crash recovery. | Covered | Broader replay/concurrency are reverse gaps G5/G6. |
| H16 | Cross-outlet configuration isolation | AC-0006.1 cross-org/outlet/merchant isolation; AC-0009.4 cross-outlet overrides; AC-0011.1 isolation. | Covered | Same-WABA/brand and credential negatives need expansion G4. |
| H17 | Correct receipt | AC-0008 receipt-content assertion: restaurant, outlet, bill version, items, tax, confirmed tip only when confirmed, amount paid, provider reference. | Covered | Closed by that assertion. Not an execution result. |
| H18 | Correct payment ledger | AC-0008.2/3 one effect/crash safety; AC-0010.4 allocations/refund/report reconciliation. | Covered | Broad statement does not name all reverse money-integrity cases G6. |
| H19 | Tip separately identifiable in reports | AC-0010.4 report/ledger reconciliation; Decision defines tip fields/net/refunded separation. | Covered | Add named report component cases G8. |
| H20 | Captain cannot bypass payment permissions | AC-0009 permission matrix: captain displays or shares only; Cashier, Manager, and Admin create instalments; only Manager and Admin refund or resolve review. | Covered | Closed by that matrix. Not an execution result. |

### Section 11 — sandbox demo tests

Run under the exact demo label, sandbox/synthetic identities only, with amounts ₹1, ₹20, ₹149, ₹520, ₹1,250. A stub is not a provider QR scan. AC-0006.3/4 define evidence labelling and unresolved scan gate.

| ID | Demo test | ADR acceptance coverage | Status | Remaining assertion / fix |
| --- | --- | --- | --- | --- |
| D1 | Bill generation | AC-0009 submission, pay-after, append, and customer-request criteria, same as H1–H4. | Covered | Closed by those criteria. Not an execution result. |
| D2 | Dynamic QR generation | AC-0006.2 adapter contract; AC-0006.3 amount/expiry/reuse fixture matrix. | Covered | Account entitlement and no-money scan evidence remain G10 gates. |
| D3 | Exact expected amount | AC-0006.3/4 exact-amount matrix/evidence; AC-0008.4 wrong amounts. | Covered | — |
| D4 | WhatsApp message generation | AC-0011 message-content assertion: summary plus secure itemized link, restaurant, amount, and bill version. | Covered | Closed by that assertion. Not an execution result. |
| D5 | Payment success | AC-0008 verified-full-payment assertion, same as H14. | Covered | Closed by that assertion. Not an execution result. |
| D6 | Payment failure | AC-0008 failed and pending assertions: unpaid, no paid receipt, no prepay kitchen release. | Covered | Closed by those assertions. Not an execution result. |
| D7 | Partial payment | AC-0007.4 exact instalments and wrong-amount quarantine. | Covered | — |
| D8 | Duplicate webhook | AC-0008.2 one financial effect. | Covered | — |
| D9 | Wrong amount | AC-0007.4 wrong 200 against 500 quarantines; AC-0008.4 wrong/edited amount. | Covered | — |
| D10 | Expired QR | AC-0007.3 expiry; AC-0008.4 expired request. | Covered | — |
| D11 | Refund | AC-0008.2/4 duplicate/refund races; AC-0010.4 refund allocations. | Covered | Tip-specific and partial refund bounds need named tests G8. |
| D12 | Multi-outlet isolation | AC-0006.1/AC-0011.1 isolation. | Covered | — |
| D13 | Customer consent | AC-0011.2 missing/revoked consent blocks send. | Covered | Source/evidence/revocation-race details are reverse gap G7. |
| D14 | Receipt generation | AC-0008 receipt-content assertion, same as H17. | Covered | Closed by that assertion. Not an execution result. |

### Section 9 — explicit failures and edge outcomes

| ID | Failure/edge case | ADR acceptance coverage | Status | Remaining assertion / fix |
| --- | --- | --- | --- | --- |
| F1 | WhatsApp unavailable | AC-0011.4 outage safe, receipt visible in POS. | Covered | Add named bill-before-payment fallback variant G7. |
| F2 | Invalid customer number | AC-0011.2 suppress send. | Covered | — |
| F3 | Template rejected | AC-0011.2 suppress send. | Covered | — |
| F4 | QR generation fails | AC-0011 QR-failure assertion: POS keeps the bill, failed QR is shown, alternate collection is allowed, bill is not paid, no second request. | Covered | Closed by that assertion. Not an execution result. |
| F5 | Provider unavailable | AC-0006.2 outage/timeout; AC-0008.5 safe reconciliation. | Covered | — |
| F6 | Payment expires | AC-0007.3 expiry/closure; AC-0008.4 expired request. | Covered | — |
| F7 | Webhook delayed | AC-0007.3 late old payments; AC-0008.5 missed callback/late money safe. | Covered | Signed freshness/legitimate late retry cases need G5/G6. |
| F8 | Webhook duplicated | AC-0008.2 event/payment dedupe. | Covered | — |
| F9 | Incorrect amount | AC-0007.4 wrong-amount quarantine; AC-0008.4 wrong/edited amount. | Covered | — |
| F10 | Partial payment | AC-0007.4 exact instalments. | Covered | — |
| F11 | Full payment | AC-0008 verified-full-payment assertion, same as H14. | Covered | Closed by that assertion. Not an execution result. |
| F12 | Refund | AC-0008.2/4, AC-0010.4 refund idempotency/allocation. | Covered | — |
| F13 | Customer pays twice | AC-0006.3 duplicate pay; AC-0007.3 double pay; AC-0008.4 parallel pay. | Covered | Unallocated vs second order credit needs detailed G6. |
| F14 | Bill changes after QR generation | AC-0007.2/3 version fence/invalidation; AC-0010.3 old QR invalidation. | Covered | Explicit late superseded-payment test G5. |
| F15 | Merchant account disconnected | AC-0006.2 disconnect; AC-0008.4/5 disconnected reconciliation. | Covered | Revoke access/escalate details G4/G10. |

### Configurations and regression families

| ID | Required configuration/regression | ADR acceptance coverage | Status |
| --- | --- | --- | --- |
| A | Pay-before, tips disabled | AC-0009.2 A; AC-0010.1 OFF surfaces. | Covered |
| B | Pay-after, tips enabled, 5/10/15%, custom | AC-0009.2 B; AC-0010.2 variants. | Covered |
| C | FLEXIBLE by order type | AC-0009.1 resolver matrix; AC-0009.2 C. | Covered |
| R-POS | Existing POS regression | AC-0009.5 explicit POS actual-app regression family. | Covered |
| R-CAPTAIN | Existing Captain regression | AC-0009.5 explicit Captain actual-app regression family. | Covered |
| R-QR | Existing QR regression | AC-0009.5 explicit QR actual-app regression family. | Covered |
| R-KDS | Existing KDS regression | AC-0009.5 explicit KDS actual-app regression family. | Covered |
| R-PAYMENT | Existing payment regression | AC-0009.5 explicit payment actual-app regression family. | Covered |

“Covered” for the five regression rows is only at the same family-level scope as the brief. Baseline scenarios, execution and measured results remain QA work; a family label is not a pass result.

## Reverse matrix — every acceptance bullet, and missing named tests

The quoted fragments below identify each acceptance bullet. “Named test absent” means absent from the enumerated Founder lists, not proven absent from repository test code. Add explicit cases to the QA plan/suites rather than assuming broad test titles cover them.

| Criterion | Existing source-test links | Reverse gap / needed test or evidence | Fix |
| --- | --- | --- | --- |
| AC-0006.1 “Cross-org/outlet/merchant and test/live isolation ...” | H16, H20, D12 | Credential protection is now a named QA case. Test/live separation, OAuth state, and CSRF remain unnamed as separate cases. | G4 |
| AC-0006.2 “Adapter contract ... no blind second request ...” | D2, F4/5/15 | No named timeout-after-create/retry-same-key, unsupported capability, disconnect+close race or safe fallback/account-binding tests. | G5/G10 |
| AC-0006.3 “Sandbox/fixture matrix ... refunds and concurrency” | H11–15, D2/3/7–11, F6/8–14 | Amounts are enumerated, but QR reuse, concurrent attempts, exact separate instalment identities and evidence-kind labelling need explicit cases. | G5/G6/G10 |
| AC-0006.4 “provider/counsel/Finance approvals ... scan-test gate” | ADR 0006 RELEASE_GATES | Closed as a gate list: provider terms, counsel RBI review, Finance and CA GST confirmation, migration safety, Razorpay test QR codes cannot be scanned, Cashfree capability proof only, Founder approval for the first real-money test, go-live, and any merge to main. Not executed evidence. | G10 |
| AC-0007.1 “Concurrent POS/captain create ... null provider refs” | H15/H18; QA plan one-active case | One active request at a time is now a named QA case. Changed-payload and null-reference cases remain unnamed. | G5 |
| AC-0007.2 “Bill mutation vs create/callback ... crash retry” | H12/13/18; QA plan create-versus-balance case | Request creation racing a balance update is now a named QA case. Replica-set crash points remain on the crash-recovery case, not as separate injection points. | G5/G6 |
| AC-0007.3 “Items/discount/tip/reprice ... late old payments” | H12; QA plan SUPERSEDED and same-total cases | A late payment on SUPERSEDED, including a new version with the same total, is now a named QA case. Failed close, unknown-create, and wrong merchant or currency remain unnamed. | G5 |
| AC-0007.4 “500 -> exact 200 + exact 300 ...” | H13, D7/9, F9/10 | No named zero/negative outstanding prevention, wrong-underpayment against fixed QR, no old-request revival and atomic remaining balance assertion. | G5 |
| AC-0008.1 “Wrong/missing signature ... replay ...” | QA plan signature, replay, and rotation cases; ADR 0008 mandatory signature, 90-day dedupe, 48-hour rule | Signature, replay, and secret rotation are now named for payment and delivery webhooks. A missing signature cannot settle. Events older than 48 hours go to the status API first. Stale-timestamp and oversized-body cases are still not separate QA cases. | G4/G6 |
| AC-0008.2 “Same event twice, different events ...” | QA plan duplicate payment and refund IDs, and the polling-versus-webhook race | Those two cases are now named. A separate one-receipt-outbox identity case is still not named. | G6 |
| AC-0008.3 “Crash before/after inbox insert ...” | QA plan crash-recovery case | Crash recovery after the webhook is stored and before the ledger commit is now a named QA case. Separate injection points for ack, outbox, and dispatch remain unnamed. | G6 |
| AC-0008.4 “wrong/edited amount ... reversed event order ...” | H11–15/18, D3/7–12, F6–15 | No explicit wrong currency/version/merchant, out-of-order failure-after-success, parallel refunds/collections or exact-instalment actor checks. | G3/G5/G6/G8 |
| AC-0008.5 “Missed webhook and timeout-after-create ...” | QA plan missed-webhook reconciliation | Reconciliation of a missed webhook is now a named QA case. Revoked-token escalation remains unnamed. Evidence reports stay release artifacts. | G5/G6/G10 |
| AC-0009.1 “Precedence matrix ... historical snapshots ... parity” | AC-0009 precedence cases | Closed as an acceptance criterion: order override, table or session, channel, outlet, organization, then default, including table over channel. Not an execution result. FLEXIBLE recursion and parity runs remain demonstrations, not new named cases. | G9 |
| AC-0009.2 “Synthetic restaurant A ... cross ... each ... release mode” | A/B/C configurations | A/B/C explicitly listed; no named Cartesian coverage of three policies x three independent kitchen modes and allowed overrides. | G9 |
| AC-0009.3 “Partial/pending/failed/review ... release ...” | AC-0009 KOT cases | Closed for the tip gate: a paid base with an unpaid tip releases; the awaiting-payment lane, ledger verification, audited Manager or Admin release, and the 10-minute alert are acceptance cases. Not an execution result. | G8/G9 |
| AC-0009.4 “Unauthorized ... overrides ... config edits” | AC-0009 permission matrix | Closed by the matrix: captain display or share only; Cashier, Manager, and Admin create instalments; only Manager and Admin refund or resolve review. Not an execution result. | G3/G9 |
| AC-0009.5 “M records demonstrations ... regressions” | A/B/C and R-* | The missing-20-tests sentence is removed. Part H is enumerated in the Founder brief and this matrix. Actual-app results per source ID remain QA evidence, not a pass. | G9/G10 |
| AC-0010.1 “OFF removes ... Toggle ... migration rule” | QA plan tips-off case | Turning tips off affecting new bills only is now a named QA case. The ADR 0010 bullet that still says “approved migration rule” was not rewritten in this pass. | G8 |
| AC-0010.2 “ON ... none preselected ... rounding/caps” | QA plan rounding and cap cases | Half-up to the rupee and the configurable cap are now named QA cases. Neutral-copy and tax-base cases remain unnamed there. | G8 |
| AC-0010.3 “500 + 50 = 550 ... late payment ...” | H11/12, D3, F9/14 | No explicit tip removal/change vs callback, stale confirmation, overpayment-not-tip and late old 550 into review test. | G5/G8 |
| AC-0010.4 “tip-only/base-only/combined/partial refunds ...” | QA plan tip refund and allocation | Tip-only, base-only, and combined refunds are now a named QA case, checked back to the report. Concurrent component refunds remain unnamed. | G8 |
| AC-0010.5 “Finance/CA approved GST/invoice ...” | ADR 0006 RELEASE_GATES | Closed as a gate: Finance and the CA confirm GST on tips before live tips. Not a test pass and not a GST-law claim. | G10 |
| AC-0011.1 “Two restaurants/WABAs cannot share ...” | AC-0011 shared-WABA assertion; QA plan tenant-isolation case | Closed for one organisation WABA, outlet-scoped numbers, and a per-brand or per-outlet override, keyed by organisation and outlet. Not an execution result. | G4/G7 |
| AC-0011.2 “Missing/revoked consent ... dispatch wins” | AC-0011 STOP/UNSUBSCRIBE/OPT OUT/START; QA plan consent-at-send-time | Closed for revocation checked at send time, including a message already queued, and for START re-subscribe of billing consent only. Not an execution result. | G7 |
| AC-0011.3 “Duplicate jobs ... UNKNOWN ... callbacks” | QA plan send dedupe, UNKNOWN, and stale message | Those three are now named QA cases. Out-of-order delivery status remains unnamed as its own case. | G7 |
| AC-0011.4 “Signature failure/replay ... receipt ... POS” | QA plan delivery-webhook signatures; AC-0011 QR-failure assertion | Delivery signature, replay, and rotation are named with the payment webhook cases. QR failure keeps the bill in POS and does not mark it paid. Noisy-tenant fairness remains unnamed. | G2/G4/G7 |
| AC-0011.5 “Produce ... guide ... sandbox evidence ...” | Demo constraints/D4/D13 | Release/evidence gate: official-policy/permissions/templates, required guide/E2E report and native-payment test limitations; no implied real-customer send or live EPL test. | G10 |

## Ten grouped fixes — exact proposed work, not repository edits

1. **G1 — Bill workflow acceptance (ADR 0009).** Add a numbered criterion for ON_SUBMISSION, AT_CHECKOUT/after-meal, ON_CUSTOMER_REQUEST and BY_AUTHORIZED_STAFF. Assert server-finalized snapshot/version and no payable QR for running state. Add named A/B/C running-append tests preserving old prices/GST (coordinate B/ADR 0003) and updated totals/history. Covers H1–4/D1.
2. **G2 — End-to-end outputs/failure acceptance (ADRs 0008/0011/0006).** Add explicit full-balance paid vs terminal failure vs timeout pending assertions; suppress paid receipts for partial/unverified/review, distinguish partial/refund acknowledgements, verify receipt content/version/components and WhatsApp summary+secure itemized link. Add QR-create failure/POS retained bill/authorized alternate collection test through B. Covers H14/17, D4–6/14, F4/11.
3. **G3 — Actor capability tests (ADR 0009).** Add acceptance/table-driven tests: Cashier/Manager/Admin may create instalments; captain only displays/shares existing requests; only Manager/Admin refund or resolve review. Deny captain merchant changes, overrides, settlement and cash close, including direct API calls/cross-outlet. Test positive allowed actions too, not just hidden buttons. A specifies, B/O/C owners implement, M E2E.
4. **G4 — Authentication, tenant and secret tests (ADRs 0006/0008/0011).** Add named raw-signature/tampering/replay/key-rotation/freshness cases for EACH payment and WhatsApp callback product. Add encrypted-credential/no-browser-no-log-secret, OAuth state/revoke and cross-org/outlet/merchant/test-live negatives. Update AC-0011.1 explicitly for org-default WABA, outlet numbers and brand/outlet overrides, all keyed by org+outlet.
5. **G5 — Request/version/late-money tests (ADR 0007 + 0008.5).** Add concurrent POS/captain one-active, payload-conflict/null-index, unknown-create/no-blind-retry, bill-mutation-vs-create and balance-reservation races. Explicitly pay a superseded request after a newer equal-total bill; assert received unallocated review, no new-bill settlement, auditable manager resolution/refund. Add failed-close/expiry race and separate exact 200+300 cases with zero/negative guards.
6. **G6 — Ledger/crash/reconciliation tests (ADR 0008).** Add multiple event ids for one transaction, replay vs duplicate distinction, polling/webhook race, reversed success/failure, double pay, duplicate refund and all inbox/writer/outbox crash points. Assert one money effect/receipt intent, received excess in suspense, missed-webhook recovery, replica-set requirement and CI failure when tests skip.
7. **G7 — Messaging lifecycle tests (ADR 0011).** Add consent evidence/purpose and revocation-enqueue-dispatch race, stale version/request suppression, approved-template variables, deduped balance/refresh revisions, UNKNOWN send reconciliation, failed-provider delivery, delivery-order regression and noisy-tenant fairness. Never use WhatsApp delivery/read as payment evidence. Add explicit org-shared-WABA sender/consent/cache isolation scenarios.
8. **G8 — Tips/accounting/default-specific tests (ADR 0010; clarify ADR 0009.3).** Replace migration-rule ambiguity with new-bills-only OFF behavior; add half-up-to-rupee boundaries, post-discount/pre-tax base, configurable 25% cap, no preselection/neutral copy, custom validation, bill-version confirmation. Add tip-only/base-only/combined/partial/duplicate/concurrent refunds and report reconciliation. Explicitly release a base-fully-paid kitchen order while tip remains unpaid; no paid-in-full receipt until full obligation covered. Keep Finance-approved GST expectations configurable.
9. **G9 — Resolver/kitchen/regression specificity (ADR 0009).** Replace obsolete “20 not enumerated” sentence with pinned brief/matrix. Add explicit precedence/conflict/fallback/snapshot/concurrency/parity tests and every independent release mode, zero due, append-only new batch and failed-print retry without duplication. Clarify compatibility fallback vs configured channel-specific default. M names actual-app baseline cases/results within each regression family.
10. **G10 — Provider/release/migration evidence gates (ADRs 0006/0007/0010/0011).** Add a release checklist, not fabricated behavioral tests: Razorpay entitlement/direct-settlement/OAuth/expiry evidence and unresolved scan limitation; Cashfree remains disabled beyond capability proof without merchant-scoped encrypted credentials and verified amount enforcement/S2S eligibility. No shared-key exception. Record counsel/RBI, Finance/CA, official WhatsApp policy/permissions/pricing, index/backfill/rollback/restore review and required demo/report artifacts. Label fixture/provider-sandbox/live evidence distinctly; no live payment/customer message authorized by this matrix.

## Implementation ownership / exit

O: `tests/payments/**`, `tests/whatsapp/**`; B: money/order/policy tests and writer-owned paths; H: existing schemas/common types/index rollout; C/E/G/K/I5: queued owned integrations; A: auth matrix; M: `tests/e2e/**`, fixtures/actual-app reports; L: manifests/CI/skip-failure gates. Do not move these tests into another stream's file to avoid the queue.

Close G1–G10 via docs and named test-plan additions first, then record executed evidence separately. No APPROVE-to-merge or production sign-off is implied. Source ADRs remain Proposed and configurable defaults remain pending Founder confirmation.
