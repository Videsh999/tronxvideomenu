# TEST PLAN — ROS Epic E15: WhatsApp Billing, Dynamic UPI QR, Billing Policies & Optional Tips

**Task:** ROS-E15-T009 · **Owner:** TRONX QA ENGINEER · **Reviewer:** TRONX CTO · **Version:** 1.1 · **Status: DRAFT** (2026-11-07 IST, before build; execution happens after build)
**Inputs:** FOUNDER_ORDER_2026-11-07.md (Orders 1–2, Appendix Part H, §11 demo tests, §9 failure cases), UX_SPEC.md v1.1, ../TRONX_PRO_MAX_TASK_BOARD.md v2, BILLING_VALIDATION_CASES.md (V01–V32, CEO defaults D1–D7), ADRs 0006–0011, TEST_TRACEABILITY.md (CTO Part H→ADR review, 43 covered / 14 partial), board **v2.3**.
Copy note: no committed copy of this plan exists under any `docs/whatsapp-payments/` folder on the box (no git working tree under /workspace); this projects copy is the edited one.

## Changelog
| Ver | Date | Change |
|---|---|---|
| 0.1 | 2026-11-07 | Initial draft, 78 cases (TC-001–078). |
| 1.1 | 2026-11-07 | Re-mapped to board **v2.4** (via v2.3) (T049 tip report, T050 request-bill screen, T051 regression run owns TC-074–078; updated ACs T026/T027/T028/T033/T034/T035). Added working assumptions AS-1…AS-4 and CTO state rules CR-1…CR-4 (TC-079–087). TC-013 rewritten as separate instalment requests (per TEST_TRACEABILITY H13). Folded TEST_TRACEABILITY partial fixes G1–G3 into TC-001–004, 014, 017, 020, 030, 032, 038, 042. Added §8b 'CTO-requested additions (QA to own)' TC-088–113. Pending-decision list (F-1…F-4, C-1…C-5) with Blocked-on-decision marks. Superseded contradiction resolved via CR-1. v2.4: configs A/B/C confirmed (assumptions AS-2…AS-4 retired); Razorpay C6 test-mode rules, mocked-webhook cases re-pointed to T053; ₹1 minimum no longer asserted (TC-027 blocked on T048); C1–C5 applied; printing = browser-print receipt only (TC-069); tip cap boundaries (TC-010); new TC-114–116. 116 cases total. |
No requirement here is new. Anything the brief does not state is marked **ASSUMPTION** or listed in §8 Open questions. Results will **never** be fabricated: T015/T021 report only executed runs.

## 1. Scope
In scope: E15 build tasks T022–T044 (backend + frontend), behaviour of Orders 1 and 2, Part H tests 1–20 on restaurants A/B/C, §9 failure list, §11 demo, UX_SPEC AC-1…AC-5, security basics, offline/printing where relevant, regression of POS, Captain, QR ordering, KDS and existing payments.
Out of scope: live payments, production credentials, real WhatsApp customers, legal/tax correctness of tips (Finance/CA, T008/T019), provider selection (T001), performance/load beyond rate-limit checks, accessibility audit (T005, Design).

## 2. Environment
- **Staging/sandbox only.** Build from `pro-max/release` after Wave 1 merges; staging per CTO proposal (board OQ27: `pro-max/release` Vercel preview + own staging Mongo, Razorpay test keys) — **not yet agreed with DevOps**; T051 says localhost demo (see X-4).
- Payment provider **Razorpay test mode only** (C6 rules apply); TEST band must be visible. No real money, ever. Live mode must be disabled (TC-060).
- WhatsApp: provider **test number** + synthetic recipient numbers registered as test recipients only. No messages to real customers.
- Data: synthetic orgs/outlets/menus/customers only (seed via ROS-E13-T001). No production data, no real phone numbers, no real merchant credentials.
- Mock provider (T022) for failure injection (provider down, QR fail, template rejected, delayed webhooks) where sandbox cannot simulate.
- Tools: API client (signed/unsigned webhook replay), browser devtools (DOM/network/storage), log access (redaction checks), 2 devices for captain + POS, mobile 360–414 and desktop 1280 viewports.

### Test restaurants (Part H)
| ID | Billing policy | Tips | Partials | Notes |
|---|---|---|---|---|
| A | PAY_BEFORE_PREPARATION | OFF | OFF — default path (CONF-A) | Brief: tips disabled |
| B | PAY_AFTER_MEAL (table session, running bill) | ON: 5%, 10%, 15%, plus custom capped at 25% of the tip base. No ₹20/₹50/₹100 chips | **ON** (CONF-B) | runs 200+300 |
| C | FLEXIBLE by order type | per TC | OFF | CONF-C: Dine-in = after, Takeaway = before (PD-4 confirmed). Delivery: not set by PD-4 (ADR 0009 default says pay-before; AC-4b.5 uses org rule) — X-3. |
Plus: a 2nd outlet in A's org and a 2nd org (isolation tests), and an outlet with E15 disabled (regression baseline).

### Confirmed test configurations and rules (board v2.4)
| ID | Rule | Source | Dependent cases |
|---|---|---|---|
| CONF-A | Restaurant A partials OFF (default path). | Board v2.4 / CEO D2 | TC-033, TC-054 |
| CONF-B | Restaurant B partials ON; runs Order 1's 200 + 300 case (no longer conditional). Tips are 5%, 10% and 15% plus a custom amount capped at 25% of the tip base. The ₹20/₹50/₹100 fallback does not apply to B. | Board v2.4; CEO defaults (board OQ25) | TC-008, TC-010, TC-013, TC-053, TC-055, TC-095, TC-108 |
| CONF-C | Restaurant C dine-in = pay-after, takeaway = pay-before. | PD-4 (confirmed by CEO) | TC-021, TC-022, TC-023 |
| AS-1 | Expired link regenerates only as a new request. The old request stays EXPIRED (ADR 0007). It is not marked SUPERSEDED unless the bill version changed. | ADR 0007 | TC-034, TC-087 |
| C6 | Razorpay test mode: QR not scannable; use success@razorpay / failure@razorpay; **a cancelled UPI payment counts as success in test mode — never use it as a failure test**; wrong amount, expiry, refunds via signed mocked webhooks (ROS-E15-T053). | CTO C6 | TC-027–035, TC-044–049, TC-083, TC-097, TC-098, TC-115, TC-116 |
| MIN | No minimum amount is asserted; ₹1 is unverified; minimum set from T048. | CTO C5; T048 | TC-027 |

### CTO state rules
| ID | Rule | Source | Cases |
|---|---|---|---|
| CR-1 | SUPERSEDED and EXPIRED are distinct statuses. | CTO rule via CEO, confirm in architecture doc | TC-079, TC-087 |
| CR-2 | Late payment on a SUPERSEDED request always → MANUAL_REVIEW. | same | TC-080, TC-086, TC-093 |
| CR-3 | Bill cannot close while any request is MANUAL_REVIEW or ACTIVE-and-unexpired. | Board C1 | TC-081–083, TC-085 |
| CR-4 | Payment after close → post-close exception; no reopen. | Board C1 | TC-084, TC-085 |
| C2 | KDS 'Awaiting payment' lane, auto-release only on verified ledger payment, audited manual release, 10-min aging alert, tips never gate. | Board C2 | TC-001, TC-077, TC-110–113 |
| C3/C5 | Mandatory signature; (provider, eventId) dedupe retained 90 days; payment and refund IDs keep a permanent unique index that the 90-day window does not drop; events ≤48h processed, older → fetch+reconcile else MANUAL_REVIEW; no timestamp check; dual secrets in rotation; webhook-disabled alert + reconciliation poll; FAILED→PAID allowed. | Board C3, C5 | TC-047, TC-049, TC-088, TC-089, TC-097, TC-098, TC-099, TC-114 |
| C4 | Opt-out keywords, consent revocation record, outbox-time suppression (SKIPPED_SUPPRESSED), START re-subscribes. | Board C4 | TC-037, TC-092, TC-102 |

## 3. Roles under test
Owner/Admin, Manager, Cashier (POS), Captain (default role), Kitchen/KDS, Customer (public payment page, WhatsApp recipient), Unauthenticated/anonymous caller, Provider (webhook sender: genuine, forged, replayed), Other-outlet / other-tenant admin. Role rights per ROS-E04-T005; Manual-review resolution = Manager/Admin (CEO default, Q10 pending).

## 4. Entry / exit criteria
**Entry:** Wave 1 merged to `pro-max/release`; E15 build tasks under test in Done-awaiting-QA with ACs listed; staging URL + build SHA; sandbox merchant keys (EXT); WhatsApp test number (EXT); restaurants A/B/C seeded (T045); provider chosen and capabilities verified (T001); Design QA done (T006) for UI cases.
**Exit:** All P1 cases executed with evidence; 0 open S1/S2; S3 have owner + plan accepted by CTO; every Part H test, §9 item, §11 test and UX AC traced to a passed case or an accepted waiver; regression suite green; T015 and T021 reports written from actual runs. Production go-live is NOT an exit of QA — it is gated by T047 + Founder approval.
**Suspend:** sandbox unavailable, any real money movement or real-customer message detected (stop immediately, S1), build SHA changes mid-run.

## 5. Severity scale
| Sev | Definition | Examples |
|---|---|---|
| S1 Critical | Money/security/privacy integrity broken, no workaround | wrong amount settles as SUCCESS; forged webhook accepted; cross-tenant data; secret leaked; captain refunds; real message/payment sent |
| S2 Major | Core flow broken or wrong state, workaround exists | duplicate WhatsApp per version; partial flow wrong; tip shown when OFF; policy not applied |
| S3 Minor | Non-core defect or wrong copy/state display | wrong label, missing 'Why', TEST band missing on one surface |
| S4 Trivial | Cosmetic | spacing, icon |
Priority on cases: P1 must pass for exit; P2 should pass; P3 nice to have.

## 6. Evidence requirements
Per executed case: build SHA, env, date/time (IST), tester, restaurant config, request/payment IDs, provider sandbox refs, screenshots (or screen recording for multi-step), API request/response (secrets redacted), relevant ledger rows, webhook payload + verification result, log excerpt proving redaction where relevant. Storage **undecided** (CTO proposal: private bucket, one folder per run, 90-day retention, no secrets or raw phone numbers — pending DevOps, D-1). Result = Pass / Fail (bug ID) / Blocked (reason) / Not run. No result without evidence.

## 7. Bug report format
```
Bug ID: E15-BUG-### | Severity: S1–S4 | Test case: E15-TC-### | Build SHA / env
Title:
Steps to reproduce: 1. … 2. …
Expected:
Actual:
Evidence: links
Assignee: building engineer of the covering task (e.g. ROS-E15-T026 → TRONX BACKEND ENGINEER; T036–T044 → TRONX FRONTEND ENGINEER)
Reviewer: TRONX CTO (S1/S2 also notify Project Director)
```

## 8. Test cases
### E15-TC-001 — Bill generated at order placement (pay-before)
- **Source:** Part H #1; Order 2 bill timing; UX §9
- **Config:** A
- **Preconditions:** Restaurant A outlet, PAY_BEFORE_PREPARATION, tips OFF; menu with priced items
- **Steps:** 1. Customer places QR order (2 items). 2. Observe bill creation. 3. Open POS + KDS.
- **Expected:** Bill created server-side at submission with amount from calculateRestaurantBill; payment request issued for that amount; order shown with effective policy 'Before prep'; unpaid order sits in KDS 'Awaiting payment' lane (C2) until verified ledger payment. [G1] Exactly one server-finalized bill version per trigger; no payable QR/request exists for a running (unfinalized) state; prior running snapshots retained with original prices/GST.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T024, ROS-E15-T052
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-002 — Bill generated after meal (pay-after, running session)
- **Source:** Part H #2; Order 2
- **Config:** B
- **Preconditions:** Restaurant B, PAY_AFTER_MEAL, table session open
- **Steps:** 1. Captain places order 1 on T5. 2. Kitchen prepares. 3. Captain requests bill at checkout.
- **Expected:** No payment request before checkout; kitchen receives order without payment; final bill generated at checkout from server billing; effective policy 'After meal'. [G1] Exactly one server-finalized bill version per trigger; no payable QR/request exists for a running (unfinalized) state; prior running snapshots retained with original prices/GST.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-003 — Running bill updated after additional items
- **Source:** Part H #3; Order 1 bill versioning; AC-1.3
- **Config:** B
- **Preconditions:** B; table session with running bill v1 (sent/finalized)
- **Steps:** 1. Add 2 items to same table session. 2. Re-finalize. 3. Open old link.
- **Expected:** Running-bill snapshot v1 preserved in audit; v2 totals = v1 + new items (server calc); v2 sent with 'bill was updated' copy; v1 link shows Superseded and is not payable. [G1] Exactly one server-finalized bill version per trigger; no payable QR/request exists for a running (unfinalized) state; prior running snapshots retained with original prices/GST. Old line prices/GST frozen; only appended lines use current rates.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T031, ROS-E15-T024
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-004 — Customer requests final bill
- **Source:** Part H #4; Order 2 bill timing 'on customer request'
- **Config:** B
- **Preconditions:** B; running session, bill timing 'on customer request' enabled
- **Steps:** 1. Customer taps 'Request bill' on the T050 screen. 2. Tap again 3x. 3. Staff finalizes. 4. Repeat on an outlet whose policy disallows customer requests.
- **Expected:** One request recorded (repeat taps no duplicates); captain/POS notified; bill finalized per effective policy; WhatsApp/QR only after finalization (AC-1.1); button hidden where policy disallows. [G1] Exactly one server-finalized bill version per trigger; no payable QR/request exists for a running (unfinalized) state; prior running snapshots retained with original prices/GST.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T050, ROS-E15-T030, ROS-E15-T031
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-005 — Tips disabled → no tip interface anywhere
- **Source:** Part H #5; AC-1b.2; Order 2 tips
- **Config:** A
- **Preconditions:** A tips OFF
- **Steps:** 1. Open customer payment page, captain screen, POS panel, WhatsApp message, receipt. 2. Inspect DOM.
- **Expected:** No tip element in DOM on any surface, no tip component in QR, no receipt tip line. API rejects/ignores a client-sent tip (V22).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-006 — Tips enabled → optional tip interface, nothing preselected
- **Source:** Part H #6; AC-1b.3
- **Config:** B
- **Preconditions:** B tips ON 5/10/15%, custom
- **Steps:** 1. Open payment page for bill.
- **Expected:** Tip step shown with 5/10/15/custom/no-tip; nothing preselected; Pay/QR unavailable until explicit confirmation.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T036
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-007 — No-tip selection
- **Source:** Part H #7; V21
- **Config:** B
- **Preconditions:** B; bill ₹520
- **Steps:** 1. Choose No tip. 2. Confirm.
- **Expected:** Payment request = bill total (₹520); no tip record/line.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-008 — Restaurant B tips: 5%, 10%, 15% and custom (incl. 500 + 50 = 550)
- **Source:** Part H #8; Order 2 example; V13; AC-1b.4
- **Config:** B
- **Preconditions:** B offers 5%, 10% and 15% plus custom, capped at 25% of the tip base. The ₹20/₹50/₹100 chips are not configured.
- **Steps:** 1. Bill whose post-discount pre-tax base is ₹500, request R1. 2. Select 10% (₹50), confirm. 3. On fresh bills select 5% and 15%. 4. Confirm the screen has no ₹20, ₹50 or ₹100 fixed chips.
- **Expected:** 5% → ₹525, 10% → ₹550, 15% → ₹575, each a new request. The old request is SUPERSEDED and not payable. The tip source is percentage. No ₹20, ₹50 or ₹100 fixed chips are shown.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T024, ROS-E15-T032
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-009 — Percentage tip 5/10/15% with rounding (D6)
- **Source:** Part H #9; V14–V18
- **Config:** B
- **Preconditions:** B; subtotals per V14–V18
- **Steps:** 1. For each case select %, read displayed tip, confirm.
- **Expected:** Tip = % of post-discount pre-tax subtotal, half-up whole rupee (V14 ₹13, V15 ₹12, V16 ₹26, V17 ₹152, V18 ₹90); displayed tip == stored tip == QR delta. (D6 pending Founder.)
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032, ROS-E15-T020
- **Assumptions/config refs:** —
- **Decision status:** Base per D6/D9 (Finance, pending Founder) — runs on current default

### E15-TC-010 — Custom tip validation and 25% cap boundaries
- **Source:** Part H #10; V23
- **Config:** B
- **Preconditions:** B custom ON, cap 25% of tip base (post-discount pre-tax item subtotal, D9)
- **Steps:** Tip base ₹400 (cap ₹100): 1. ₹37. 2. Exactly 25% = ₹100. 3. ₹101 (cap + ₹1). 4. ₹100.01 (cap + 1 paisa). 5. ₹0. 6. -5. 7. 'abc', '1e3', script text. 8. Repeat 3–7 via API directly.
- **Expected:** ₹37 and ₹100 accepted (request = total + tip); ₹101 and ₹100.01 rejected (also non-integer, whole rupees); ₹0 = no tip, no tip line; negative/non-numeric rejected server-side; UI and API agree.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-011 — Exact dynamic QR amount = server bill
- **Source:** Part H #11; §11 'exact expected amount'; AC-1b.1
- **Config:** A,B,C
- **Preconditions:** Sandbox provider
- **Steps:** 1. Generate request. 2. Decode QR / link payload. 3. Compare with server bill.
- **Expected:** QR/link amount equals server request amount; request bound to org, outlet, order, bill version, request ID, merchant, currency, expiry, provider ref. Exact-amount *enforcement* claimed only if provider guarantees it (T001).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T024
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-012 — Bill changes after QR generation
- **Source:** Part H #12; §9 'bill changes after QR'; V30
- **Config:** B,C
- **Preconditions:** Request R1 PENDING
- **Steps:** 1. Add item / cancel line. 2. Re-finalize. 3. Pay R1 in sandbox.
- **Expected:** R1 superseded (CANCELLED/superseded, Q6); R2 issued; payment on R1 → MANUAL_REVIEW, never SUCCESS (AC-5.1) and routed to reconciliation.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024, ROS-E15-T027, ROS-E15-T007
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-013 — Partial payment 500 = 200 + 300 (Restaurant B)
- **Source:** Part H #13; Order 1; AC-2.4; V24
- **Config:** B (partials ON explicitly)
- **Preconditions:** Restaurant B test config partials ON (per CEO)
- **Steps:** 1. Staff creates instalment request I1 = ₹200 (separate fixed request, not ₹200 against a ₹500 QR). 2. Pay I1. 3. System issues I2 = ₹300; resend on WhatsApp. 4. Pay I2.
- **Expected:** After I1 verified: ₹200 recorded, PARTIALLY_PAID, I2 ₹300 sent; Paid only when I2 verified; no duplicates/overpay. Paying ₹200 against a ₹500 request is the wrong-amount path (TC-033/054).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T028, ROS-E15-T027, ROS-E15-T033, ROS-E15-T028
- **Assumptions/config refs:** CONF-B (partials ON)
- **Decision status:** —

### E15-TC-014 — Full payment
- **Source:** Part H #14; §9; §11 'payment success'
- **Config:** A,B,C
- **Preconditions:** Request PENDING
- **Steps:** 1. Pay exact amount in sandbox. 2. Wait for verified webhook.
- **Expected:** SUCCESS only after signature-verified webhook or authenticated status check; ledger entry; table/bill closable; receipt sent. [G2] Paid only when balance reaches zero from verified events; no paid receipt for partial/pending/unverified/review states.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T027
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-015 — Duplicate webhook
- **Source:** Part H #15; §9; §11
- **Config:** A
- **Preconditions:** SUCCESS already recorded
- **Steps:** 1. Re-deliver identical signed webhook event 2–5 times (incl. concurrently).
- **Expected:** Idempotent: one ledger entry, one receipt, no state change.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-016 — Cross-outlet configuration isolation
- **Source:** Part H #16; §11 multi-outlet; AC-4.3
- **Config:** A vs B (same org) + other org
- **Preconditions:** Two outlets with distinct merchant/WA configs
- **Steps:** 1. As outlet-A admin open settings. 2. Fetch outlet-B config via API with A's session. 3. Create request at A; check merchant used.
- **Expected:** No other outlet's merchant/WA data in UI or API (403/404); request uses A's merchant only; settlement to A's own merchant account.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T042
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-017 — Correct receipt
- **Source:** Part H #17; §11 receipt generation; UX §11
- **Config:** A,B
- **Preconditions:** Verified payment
- **Steps:** 1. Complete payment. 2. Check page + WhatsApp receipt.
- **Expected:** Receipt only after verified payment; fields per UX §11 (restaurant, outlet, GSTIN, invoice no, bill version, ref, items, taxes, totals, provider ref); tip line only if tipped; partials list each payment. [G2] Receipt originates from committed ledger; content/version/components exact; partial and refund acknowledgements labelled distinctly; no receipt while pending/review.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T036, ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** Partly blocked F-4 (WhatsApp receipt format)

### E15-TC-018 — Correct payment ledger
- **Source:** Part H #18; Order 1 'ledger source of truth'
- **Config:** A,B,C
- **Preconditions:** Run of TC-011..015
- **Steps:** 1. Export ledger rows for run.
- **Expected:** Existing ledger is source of truth; each verified payment one row with merchant, refs, amount, currency, status; amounts reconcile to provider sandbox report.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-019 — Tip separately identifiable in reports
- **Source:** Part H #19; Order 2 tip records
- **Config:** B
- **Preconditions:** Payments with/without tips
- **Steps:** 1. Open Reports for outlet + date range. 2. Export. 3. Reconcile with tip records and ledger.
- **Expected:** Tip totals separate from food revenue per outlet/date; export has tip amount, order, bill, payment ref, outlet, timestamp; totals reconcile; no tax on tip; no claim tips go to an employee.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T049, ROS-E15-T032
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-020 — Captain cannot bypass payment permissions
- **Source:** Part H #20; Order 1 role gating; AC-2.2
- **Config:** A,B,C
- **Preconditions:** Default captain account
- **Steps:** 1. Check UI for Refund/Settle/Cash close/Resolve. 2. With captain token call API directly: create/regenerate request, send/resend, record, refund, settle, cash close, resolve review. 3. Table-driven: captain vs cashier vs manager vs admin for each action incl. instalment create, merchant config change, overrides, cross-outlet calls.
- **Expected:** UI hides restricted actions; each restricted API returns 403 and nothing is written; allowed captain actions still work. [G3] Captain may only display/share existing requests; Cashier/Manager/Admin may create instalments; only Manager/Admin refund/resolve; positive cases pass for permitted roles.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T034, ROS-E15-T039, ROS-E15-T029, ROS-E04-T005
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-021 — Restaurant C: dine-in follows pay-after
- **Source:** Part H config C; AC-4b.2
- **Config:** C
- **Preconditions:** C Flexible: Dine-in = pay-after, Takeaway = pay-before (PD-4, confirmed)
- **Steps:** 1. Dine-in order.
- **Expected:** Behaves as pay-after; preview shows 'Why'.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043
- **Assumptions/config refs:** CONF-C (PD-4 confirmed)
- **Decision status:** —

### E15-TC-022 — Restaurant C: takeaway follows pay-before
- **Source:** Part H config C; AC-4b.2
- **Config:** C
- **Preconditions:** C Flexible: Dine-in = pay-after, Takeaway = pay-before (PD-4, confirmed)
- **Steps:** 1. Takeaway order.
- **Expected:** Bill + request at submission; preview 'Before prep · Why: Outlet + order type rule'.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043
- **Assumptions/config refs:** CONF-C (PD-4 confirmed)
- **Decision status:** —

### E15-TC-023 — Restaurant C: precedence falls back to org+order-type
- **Source:** AC-4b.5; D1
- **Config:** C
- **Preconditions:** No outlet rule for Delivery; org+delivery rule exists
- **Steps:** 1. Delivery order; open preview.
- **Expected:** ADR 0009: with no outlet channel rule, FLEXIBLE expands through the organisation channel map, then the organisation default. The winning source is not a separate "org + order type" level above the outlet default.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043
- **Assumptions/config refs:** CONF-C (PD-4 confirmed)
- **Decision status:** —

### E15-TC-024 — Policy change keeps open orders' policy
- **Source:** AC-4b.4; T030
- **Config:** C
- **Preconditions:** Open orders exist
- **Steps:** 1. Change policy.
- **Expected:** Open orders keep original policy; note shown.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-025 — New outlet tips default OFF
- **Source:** AC-4b.1
- **Config:** new
- **Preconditions:** Create outlet
- **Steps:** 1. Inspect billing prefs.
- **Expected:** ENABLE_CUSTOMER_TIPS = OFF.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T032, ROS-E15-T043
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-026 — Tips ON only for dine-in → takeaway has no tip UI
- **Source:** AC-4b.3
- **Config:** C/B
- **Preconditions:** Tips scoped to dine-in
- **Steps:** 1. Takeaway payment page.
- **Expected:** No tip element in DOM.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T037
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-027 — Demo minimum amount (brief ₹1)
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹1 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay via success@razorpay (test QR not scannable). 4. Check receipt + ledger.
- **Expected:** Expected result per provider minimum recorded by T048 (₹1 is UNVERIFIED; no minimum asserted). If below minimum: request creation rejected with a clear error, no request.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045
- **Assumptions/config refs:** —
- **Decision status:** Blocked on ROS-E15-T048

### E15-TC-028 — Demo amount ₹20: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹20 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay via success@razorpay (test QR not scannable). 4. Check receipt + ledger.
- **Expected:** Request = ₹20 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-029 — Demo amount ₹149: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹149 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay via success@razorpay (test QR not scannable). 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹149 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-030 — Demo amount ₹520: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹520 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay via success@razorpay (test QR not scannable). 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹520 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. [G2] Paid only when balance reaches zero from verified events; no paid receipt for partial/pending/unverified/review states.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-031 — Demo amount ₹1250: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹1250 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay via success@razorpay (test QR not scannable). 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹1250 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-032 — Payment failure: terminal decline vs timeout
- **Source:** §11 payment failure
- **Config:** A
- **Preconditions:** Sandbox failure simulation
- **Steps:** 1. Pay using failure@razorpay. 2. Provider timeout via mock.
- **Expected:** Decline → FAILED, bill unpaid, 'Try again' = new request ID; timeout → stays PENDING/Checking (not FAILED, not Paid); no receipt, no kitchen release. [G2] NOTE: never use a cancelled UPI payment as a failure test — Razorpay test mode treats it as success.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T044, ROS-E15-T053
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-033 — Wrong amount paid (under/over)
- **Source:** §9 incorrect amount; §11; AC-3.6; V25, V28, V29
- **Config:** A,B
- **Preconditions:** Sandbox able to send different amount (only if provider allows)
- **Steps:** Signed mocked webhooks (T053): 1. qr_code.credited ₹520 on ₹500 (A, partials OFF). 2. ₹200 on ₹500 at A. 3. ₹600 on ₹550 (tip) at B.
- **Expected:** MANUAL_REVIEW, no ledger change; overpay only resolution 'Refund excess'; excess never becomes tip; partials OFF → no auto remainder.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T026, ROS-E15-T027, ROS-E15-T041, ROS-E15-T007
- **Assumptions/config refs:** CONF-A (partials OFF)
- **Decision status:** —

### E15-TC-034 — Expired QR
- **Source:** §9 payment expires; §11; AC-1b.6
- **Config:** A
- **Preconditions:** Short expiry in sandbox
- **Steps:** 1. Signed mocked qr_code.closed (T053) for R1. 2. Regenerate (customer and staff). 3. Mocked late qr_code.credited on R1.
- **Expected:** R1 stays EXPIRED (ADR 0007). It is not marked SUPERSEDED. Regenerate creates a new request. A late payment on R1 auto-matches only if the bill version is unchanged and the amount matches exactly; otherwise MANUAL_REVIEW. Close-reason field per Razorpay docs (unverified, board OQ28).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T027, ROS-E15-T036, ROS-E15-T044
- **Assumptions/config refs:** AS-1
- **Decision status:** Partly blocked: qr_code.closed reason value (board OQ28)

### E15-TC-035 — Refund (provider, role-gated)
- **Source:** §9 refund; §11
- **Config:** A
- **Preconditions:** SUCCESS payment; manager account
- **Steps:** 1. Manager refunds full; signed mocked refund.processed (T053). 2. Partial refund mocked. 3. Captain attempts refund (UI+API).
- **Expected:** Ledger refund entry per refund with tip refunded as its own component; REFUND_PENDING → REFUNDED; captain 403.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T029
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-036 — Customer consent before WhatsApp send
- **Source:** §11 customer consent; AC-1.4
- **Config:** A
- **Preconditions:** Number without consent record
- **Steps:** 1. Try send.
- **Expected:** Blocked 'No WhatsApp consent for this number'; consent record (who/when/source) required.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T034
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-037 — Opt-out: STOP blocks queued send, START restores
- **Source:** C4 (board); T033 AC
- **Config:** A
- **Preconditions:** Number with consent, then opt-out (STOP/withdraw)
- **Steps:** 1. Queue a bill send. 2. Inbound STOP / 'unsubscribe' / 'Opt Out' / local-language keyword before dispatch. 3. Observe outbox. 4. Inbound START. 5. Send next bill. 6. Staff opt-out from UI.
- **Expected:** Consent revoked with org, outlet, hashed+encrypted phone, source, timestamp, inbound message ID; queued send SKIPPED_SUPPRESSED; one confirmation only, then only customer-requested replies within 24h; START creates a new consent record and sends resume; staff opt-out audited; bill always in POS.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-038 — WhatsApp message content and finalized-only
- **Source:** §11 WhatsApp generation; Order 1 itemized fields; AC-1.1, AC-1.2
- **Config:** A,B
- **Preconditions:** Test number
- **Steps:** 1. Try send unfinalized. 2. Finalize and send. 3. Trigger auto-send again for same version.
- **Expected:** Disabled until finalized; content per template default (summary + secure link, Q3) with listed fields where template allows; no duplicate per version ('Already sent'). [G2] Payload uses approved template variables only; summary + secure itemized link carries correct version/totals.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T031, ROS-E15-T033, ROS-E15-T038
- **Assumptions/config refs:** —
- **Decision status:** Blocked-on-decision F-4 (itemized vs summary+link)

### E15-TC-039 — WhatsApp unavailable
- **Source:** §9; AC-2.5, AC-5.4
- **Config:** A
- **Preconditions:** Mock WA API down
- **Steps:** 1. Send bill.
- **Expected:** 'Not delivered' note; QR usable; bill available in POS and captain.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T038
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-040 — Invalid customer number
- **Source:** §9; UX §10
- **Config:** A
- **Preconditions:** Malformed / non-WA synthetic number
- **Steps:** 1. Send.
- **Expected:** Number validated before send; no send; logged (redacted); staff see 'Not delivered: invalid number'; bill stays in POS/captain; link/QR shareable by another authorized method; payment state unchanged.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-041 — Template rejected
- **Source:** §9
- **Config:** A
- **Preconditions:** Mock template rejection
- **Steps:** 1. Send.
- **Expected:** Send blocked; logged with provider reason; bill stays in POS/captain; alternative share method; payment state unchanged; no unapproved free-form message.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-042 — QR generation fails
- **Source:** §9; UX §10
- **Config:** A
- **Preconditions:** Mock provider QR error
- **Steps:** 1. Generate.
- **Expected:** 'QR unavailable' → other authorized methods; no PENDING orphan request. [G2] QR-create failure shown explicitly; no blind auto-retry; authorized alternate method; no false Paid.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-043 — Provider unavailable
- **Source:** §9
- **Config:** A
- **Preconditions:** Mock provider timeout
- **Steps:** 1. Generate / status check.
- **Expected:** Banner 'use other methods'; uncertain → Pending/Manual review, never Paid.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-044 — Webhook delayed
- **Source:** §9; AC-1b.5
- **Config:** A
- **Preconditions:** Hold webhook 5+ min
- **Steps:** 1. Pay via success@razorpay. 2. Hold webhook (mock delay). 3. Return to page.
- **Expected:** 'Checking payment…' not Paid; status check resolves; later webhook idempotent.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T036
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-045 — Customer pays twice
- **Source:** §9; AC-5.2
- **Config:** A
- **Preconditions:** Two sandbox payments on same bill
- **Steps:** 1. success@razorpay twice on two requests for the same bill (or mocked second qr_code.credited).
- **Expected:** Bill Paid once; second → MANUAL_REVIEW → refund path.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T044, ROS-E15-T007, ROS-E15-T053
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-046 — Merchant account disconnected
- **Source:** §9
- **Config:** A
- **Preconditions:** Disconnect merchant in sandbox/config
- **Steps:** 1. Generate request.
- **Expected:** 'Online payment unavailable'; no request created; admin reconnect link admin-only.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T042
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-047 — Forged / unsigned webhook rejected
- **Source:** Order 1 verification
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. POST webhook with no signature, bad signature, wrong secret, other outlet's secret.
- **Expected:** 401; no side effects; logged without secrets.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T026, ROS-E15-T012
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-048 — Webhook field mismatch (merchant/ref/currency)
- **Source:** Order 1 verification checks
- **Config:** A
- **Preconditions:** Valid signature, tampered fields (sandbox-signed)
- **Steps:** 1. Send event with other merchant / other order ref / USD / amount ≠ expected.
- **Expected:** Not SUCCESS; MANUAL_REVIEW or rejected.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-049 — Replay: reused event ID and old events (no timestamp check)
- **Source:** C3/C5 (board CTO decisions); T026 AC
- **Config:** A
- **Preconditions:** Captured valid event from earlier request
- **Steps:** 1. Re-send a processed event with same x-razorpay-event-id. 2. New event ID but same provider payment ID. 3. Event >48h old. 4. Dedupe miss on known payment.
- **Expected:** 1 processed once; 2 no second ledger row (unique payment-ID index); 3 fetched from provider and reconciled else MANUAL_REVIEW; 4 same. No timestamp check (Razorpay signs none).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-050 — Concurrent payments / webhooks on same bill
- **Source:** Order 1 'no duplicates'; ROS-E02 CAS
- **Config:** B
- **Preconditions:** Partials ON
- **Steps:** 1. Fire SUCCESS webhooks for R1 and R2 simultaneously. 2. Two staff record cash+UPI concurrently.
- **Expected:** Single settlement under version/transaction control; the other → MANUAL_REVIEW or partial handling; total paid never above bill; excess flagged for refund (T029).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T028, ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-051 — Client-sent amount ignored
- **Source:** Order 1 'never frontend'; V31
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Tamper amount in request-creation API.
- **Expected:** Server amount wins / 400.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-052 — Request reuse for another order rejected
- **Source:** Order 1
- **Config:** A
- **Preconditions:** Two orders
- **Steps:** 1. Pay order 2 using order 1 request ID/link.
- **Expected:** Rejected.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-053 — Amount above remaining rejected
- **Source:** AC-3.2; T028
- **Config:** B (partials ON)
- **Preconditions:** Remaining ₹300
- **Steps:** 1. Enter ₹350 in POS. 2. Call API directly with 350.
- **Expected:** 'Max ₹300', no request, server rejects.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T041, ROS-E15-T028
- **Assumptions/config refs:** CONF-B (partials ON)
- **Decision status:** —

### E15-TC-054 — Restaurant A partials OFF (default path): no split control; underpay → MANUAL_REVIEW
- **Source:** AC-3.7; D2
- **Config:** A
- **Preconditions:** Partials OFF
- **Steps:** 1. Open POS panel. 2. Call partial request API. 3. Pay ₹200 on ₹500 (V25).
- **Expected:** No split control; API rejects partial request; underpayment → MANUAL_REVIEW, no auto remainder request.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041, ROS-E15-T028
- **Assumptions/config refs:** CONF-A (partials OFF)
- **Decision status:** —

### E15-TC-055 — Partial with tip allocation (tip last)
- **Source:** V26, V27; D4
- **Config:** B (partials ON)
- **Preconditions:** ₹500 + ₹50
- **Steps:** 1. Pay 200 then 350. 2. Separate run: pay 520.
- **Expected:** Allocations per V26/V27.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T028, ROS-E15-T032
- **Assumptions/config refs:** CONF-B (partials ON)
- **Decision status:** —

### E15-TC-056 — Manual review resolution role-gated
- **Source:** AC-3.3; Q10
- **Config:** B
- **Preconditions:** MANUAL_REVIEW item
- **Steps:** 1. Captain/Cashier view + API. 2. Manager resolve without reason; with reason.
- **Expected:** Actions absent & 403 for captain/cashier; manager must enter reason; audited.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T041, ROS-E15-T034, ROS-E04-T005
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-057 — Close bill disabled while PENDING
- **Source:** AC-3.4
- **Config:** A
- **Preconditions:** Request PENDING
- **Steps:** 1. Try Close bill (UI + API).
- **Expected:** Disabled with tooltip; API rejects.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-058 — Server write failure never shown as recorded
- **Source:** AC-3.5
- **Config:** A
- **Preconditions:** Inject DB write failure
- **Steps:** 1. Record payment.
- **Expected:** Error + retry; not shown as recorded.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041, ROS-E08-T003
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-059 — Secrets masked, write-only
- **Source:** AC-4.2; Order 1 secret storage
- **Config:** A
- **Preconditions:** Saved provider/WA secrets
- **Steps:** 1. View settings. 2. GET config API. 3. grep logs, browser storage, network.
- **Expected:** Only masked last-4; never in browser storage/logs; no bank passwords/UPI PINs fields.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T042, ROS-E15-T034
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-060 — Live mode disabled without live credentials
- **Source:** AC-4.1; Order 1 'no live payments'
- **Config:** A
- **Preconditions:** Test credentials only
- **Steps:** 1. Try toggle Live.
- **Expected:** Disabled with checklist.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T042, ROS-E15-T047
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-061 — TEST band on all surfaces in test mode
- **Source:** AC-4.4
- **Config:** A
- **Preconditions:** Test mode
- **Steps:** 1. Open customer, captain, POS.
- **Expected:** TEST band everywhere.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T042, ROS-E15-T044
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-062 — Unconfirmed capability shows '?'
- **Source:** AC-4.5
- **Config:** A
- **Preconditions:** Capability unknown
- **Steps:** 1. Open settings.
- **Expected:** '?' and dependent copy disabled.
- **Priority:** P3
- **Covering build task(s):** ROS-E15-T042
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-063 — Payment page token & data hygiene
- **Source:** UX §5 gating; Order 1 phone protection
- **Config:** A
- **Preconditions:** Valid link
- **Steps:** 1. Tamper/guess token. 2. Inspect response for org IDs, settings, phone.
- **Expected:** Invalid token 404; response contains no org IDs/billing settings/full phone.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T036, ROS-E15-T034
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-064 — Rate limiting on payment/send endpoints
- **Source:** Order 1 rate limits; T034
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Burst request-creation, send, webhook, payment-page.
- **Expected:** 429 beyond threshold (thresholds OPEN, board OQ6).
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T034, ROS-E12-T013
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-065 — Logs redact phones and payment fields
- **Source:** T034
- **Config:** A
- **Preconditions:** Run any flow
- **Steps:** 1. Inspect logs.
- **Expected:** Phones, payment account fields, secrets redacted.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T034, ROS-E12-T010
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-066 — Auth and injection on E15 APIs
- **Source:** Basic security (QA scope)
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Call each E15 route unauthenticated, with other tenant's token (IDOR), with NoSQL/script injection in tip, number, notes, webhook body.
- **Expected:** 401/403/400; no cross-tenant data; no injection effect; stored XSS escaped in WA/receipt.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T034, ROS-E01-T003, ROS-E01-T005
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-067 — Cross-tenant webhook routing
- **Source:** Order 1 isolation
- **Config:** Org X vs Org Y
- **Preconditions:** Two orgs, sandbox merchants
- **Steps:** 1. Send org Y-signed event referencing org X request.
- **Expected:** Rejected; no change in X.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-068 — Device offline: no transition to Paid
- **Source:** AC-5.3; UX §10
- **Config:** A
- **Preconditions:** POS/captain offline
- **Steps:** 1. Go offline mid-payment. 2. Try mark paid / create UPI request. 3. Record cash. 4. Reconnect.
- **Expected:** UPI actions disabled; no Paid; cash 'queued'; on reconnect status reconciles from server.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T044
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-069 — Browser-print of receipt only
- **Source:** CEO default: browser-print receipt only, no hardware printing (board OQ26)
- **Config:** A,B
- **Preconditions:** Printer/connector in staging
- **Steps:** 1. After verified payment, Print receipt from customer page / POS (browser print dialog). 2. With and without tip. 3. Check no thermal/hardware print job is created.
- **Expected:** Printed receipt matches on-screen receipt (version, totals, tip line only if tipped, 'Tip' label per OQ23); no hardware print job; no print option before verified payment.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T036, ROS-E15-T041
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-070 — Captain + POS share one payment logic
- **Source:** Order 1; T039
- **Config:** B
- **Preconditions:** —
- **Steps:** 1. Same scenario on captain & POS.
- **Expected:** Identical amounts/states; single component.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T039, ROS-E15-T040, ROS-E15-T041
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-071 — Captain status follows verified webhook via polling
- **Source:** AC-2.3
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Pay; watch captain.
- **Expected:** 'Paid · verified' after poll; table status follows.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T040
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-072 — Order/bill/request/collection/verification/receipt kept separate
- **Source:** Order 2
- **Config:** B
- **Preconditions:** —
- **Steps:** 1. Inspect data for one order through lifecycle.
- **Expected:** Separate records with audit history.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-073 — Mobile vs desktop primary action
- **Source:** AC-1b.7
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Open page at 375 and 1280 px.
- **Expected:** Mobile: 'Pay with UPI app' primary, QR behind 'Show QR'; desktop QR primary.
- **Priority:** P3
- **Covering build task(s):** ROS-E15-T036
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-074 — Regression: POS order/bill/existing cash & card payments
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** Build from pro-max/release on localhost demo (per T051) / staging
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T051 (run); fixes via ROS-E03-T001, ROS-E13-T005
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-075 — Regression: Captain ordering, table management, bill view
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** Build from pro-max/release on localhost demo (per T051) / staging
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T051 (run); fixes via ROS-E05, ROS-E13-T005
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-076 — Regression: QR (public) ordering incl. variants & idempotency
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** Build from pro-max/release on localhost demo (per T051) / staging
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T051 (run); fixes via ROS-E02-T002, ROS-E02-T003
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-077 — Regression: KDS/KOT flow for pay-before and pay-after orders
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** Build from pro-max/release on localhost demo (per T051) / staging
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T051 (run); fixes via ROS-E02-T006, ROS-E05
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-078 — Regression: Existing payment adapter & ledger (non-UPI), cancellations, line cancel
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** Build from pro-max/release on localhost demo (per T051) / staging
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T051 (run); fixes via ROS-E02-T001, ROS-E04-T007
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-079 — SUPERSEDED and EXPIRED are distinct statuses
- **Source:** CR-1 (CTO rule via CEO, confirm in architecture doc); AC-5.1
- **Config:** A,B
- **Preconditions:** R1 superseded by bill change; R2 left to expire
- **Steps:** 1. Supersede R1. 2. Let R2 expire. 3. Read status via API, ledger and each surface.
- **Expected:** R1 = SUPERSEDED, R2 = EXPIRED (never one shown as the other, never CANCELLED+reason); UI labels per UX §10.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T024, ROS-E15-T044
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-080 — Late payment on SUPERSEDED → always MANUAL_REVIEW
- **Source:** CR-2 (CTO rule via CEO, confirm in architecture doc); AC-5.1
- **Config:** B
- **Preconditions:** R1 SUPERSEDED, R2 PENDING
- **Steps:** 1. Pay R1 exact old amount. 2. Pay R1 an amount equal to R2's amount. 3. Pay R1 after R2 is SUCCESS.
- **Expected:** Every case → MANUAL_REVIEW; never SUCCESS; R2/bill unaffected; reconciliation item created.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T026, ROS-E15-T007
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-081 — Bill cannot close while any request is MANUAL_REVIEW
- **Source:** CR-3 (CTO rule via CEO, confirm in architecture doc; now board C1); PD-1
- **Config:** A
- **Preconditions:** One request MANUAL_REVIEW
- **Steps:** 1. Manager tries Close (UI + API). 2. Resolve review with reason. 3. Close.
- **Expected:** Close rejected until resolved (UI disabled, API 4xx); succeeds after resolution.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T030, ROS-E15-T041
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-082 — Bill cannot close while a request is active and unexpired
- **Source:** CR-3 (CTO rule via CEO, confirm in architecture doc; now board C1); AC-3.4
- **Config:** A
- **Preconditions:** Request PENDING, expiry in future
- **Steps:** 1. Close via UI and API. 2. Cancel request; close.
- **Expected:** Close rejected while active; allowed once request is terminal (expired/superseded/cancelled) and bill settled per policy.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T041
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-083 — Expiry boundary vs close
- **Source:** CR-3 (CTO rule via CEO, confirm in architecture doc; now board C1)
- **Config:** A
- **Preconditions:** Request expiring at T
- **Steps:** 1. Close at T-1s. 2. Close at T+1s. 3. Pay at T±1s.
- **Expected:** T-1s close rejected; at/after T request EXPIRED and close allowed; payment landing after T → MANUAL_REVIEW not SUCCESS; boundary rule (inclusive/exclusive) documented.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T053
- **Assumptions/config refs:** —
- **Decision status:** Partly blocked: qr_code.closed reason (OQ28); expiry via mocked webhook T053

### E15-TC-084 — Payment after close → post-close exception, no reopen
- **Source:** CR-4 (CTO rule via CEO, confirm in architecture doc; now board C1)
- **Config:** A
- **Preconditions:** Bill closed
- **Steps:** 1. Deliver a verified payment for any of the bill's requests.
- **Expected:** Recorded as post-close exception (MANUAL_REVIEW/reconciliation); bill NOT reopened; closed totals unchanged; staff alerted.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T007
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-085 — Race: payment webhook lands exactly as close is attempted
- **Source:** CR-3/CR-4 (CTO rule via CEO, confirm in architecture doc; now board C1); T027 concurrency
- **Config:** A
- **Preconditions:** Request PENDING
- **Steps:** 1. Fire verified SUCCESS webhook and close API concurrently (repeat 50x).
- **Expected:** Each run yields exactly one consistent outcome: either payment SUCCESS then close, or close rejected; never closed-with-unrecorded payment, never reopen, never double ledger row.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-086 — Race: supersede and payment on old request at same time
- **Source:** CR-2 (CTO rule via CEO, confirm in architecture doc)
- **Config:** B
- **Preconditions:** R1 PENDING
- **Steps:** 1. Re-finalize bill (supersede R1) while R1 webhook arrives.
- **Expected:** If payment committed first: R1 SUCCESS and re-finalize handled per bill-change rules; else R1 SUPERSEDED and payment → MANUAL_REVIEW. No silent settle.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T024, ROS-E15-T031
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-087 — Negative: no illegal transitions out of SUPERSEDED/EXPIRED
- **Source:** CR-1 (CTO rule via CEO, confirm in architecture doc); UX §3
- **Config:** A
- **Preconditions:** Requests in SUPERSEDED and EXPIRED
- **Steps:** 1. Attempt API/state transitions to PENDING/SUCCESS directly (staff and webhook).
- **Expected:** A staff or webhook jump from SUPERSEDED to PAID is rejected; the late payment goes to MANUAL_REVIEW (ADR 0007). An EXPIRED request may become PAID only when the bill version is unchanged and the amount matches exactly; otherwise the late payment goes to MANUAL_REVIEW. A late webhook may move either status to MANUAL_REVIEW. Regenerate creates a new request and leaves an unchanged bill's old request EXPIRED (AS-1).
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T027
- **Assumptions/config refs:** AS-1
- **Decision status:** —

## 8b. CTO-requested additions (QA to own)
Source: Project Director relay of CEO/CTO request, 2026-11-07. The audit-branch version of this section had not landed; no git working tree under /workspace, so these are QA-numbered (no source SHA). Merge with the audit section when it lands. Calculator-dependent values are TBD-from-build.

### E15-TC-088 — Webhook signature: raw-body verification and tampering
- **Source:** CTO add.; TRACEABILITY G4; extends TC-047
- **Config:** A
- **Preconditions:** Sandbox signing secret
- **Steps:** 1. Valid signature over raw body. 2. Re-serialized JSON (whitespace/key order changed). 3. One byte changed. 4. Signature header for WhatsApp callback product as well.
- **Expected:** Only exact raw-body signature accepted for each payment AND WhatsApp callback; all tampered variants rejected, logged without secrets.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T033, ROS-E15-T012
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-089 — Dual webhook secrets during rotation
- **Source:** CTO add.; G4
- **Config:** A
- **Preconditions:** Old + new secret during rotation
- **Steps:** 1. Rotate secret. 2. Send events signed with current and previous secret. 3. Retire previous; resend with it.
- **Expected:** Current and previous both verify during rotation (C5); after previous is retired → 401, no side effects.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T053, ROS-E15-T023
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-090 — Credential protection: encrypted at rest, OAuth state/revoke
- **Source:** CTO add.; G4; extends TC-059
- **Config:** A
- **Preconditions:** Stored provider + WABA credentials
- **Steps:** 1. Inspect DB record. 2. Browser bundle/storage/network. 3. Logs/error traces. 4. OAuth connect with tampered state; revoke at provider.
- **Expected:** Encrypted at rest; never in browser/logs/errors; tampered OAuth state rejected; revoke → merchant disconnected path (TC-046).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T034, ROS-E15-T042
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-091 — Test vs live credential separation
- **Source:** CTO add.; G4
- **Config:** A
- **Preconditions:** Test mode
- **Steps:** 1. Send sandbox-signed event to live endpoint config and vice versa.
- **Expected:** Rejected; test events never affect live ledger and reverse.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T026, ROS-E15-T047
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-092 — Tenant isolation: shared WABA with outlet overrides (consent isolated per tenant)
- **Source:** CTO add.; G4; ADR 0011
- **Config:** Org X, outlets X1 (shared WABA) and X2 (override)
- **Preconditions:** Org-level WABA, X2 has own number/template overrides
- **Steps:** 1. Send from X1 and X2. 2. Inbound status/opt-out callback for X2 number. 3. X1 admin reads X2 delivery logs via API.
- **Expected:** X1 uses org WABA, X2 uses override; callbacks routed to correct outlet; no cross-outlet logs/config; opt-out scoped correctly (per C-2). Consent/opt-out for the same phone isolated per tenant: STOP to org X does not suppress org Y.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T023
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-093 — Late payment on SUPERSEDED request after new version with SAME total
- **Source:** CTO add.; G5; CR-2
- **Config:** B
- **Preconditions:** v1 ₹520 R1; item swap → v2 also ₹520, R2
- **Steps:** 1. Pay R1. 2. Check R2 and bill.
- **Expected:** R1 payment → MANUAL_REVIEW as received-unallocated; does NOT settle v2 or R2 despite equal amount; reconciliation item.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T024, ROS-E15-T007
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-094 — Only one active request per bill at a time
- **Source:** CTO add.; G5
- **Config:** B
- **Preconditions:** Bill finalized
- **Steps:** 1. POS and captain create request concurrently (repeat 50x). 2. Create second while one PENDING.
- **Expected:** Exactly one ACTIVE request; concurrent create returns the existing one or conflicts cleanly; no orphan PENDING.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024, ROS-E15-T027
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-095 — Concurrency: request creation vs balance update
- **Source:** CTO add.; G5
- **Config:** B partials ON
- **Preconditions:** PARTIALLY_PAID, remaining ₹300
- **Steps:** 1. Verified partial payment lands while staff creates remainder request.
- **Expected:** Remainder request amount equals balance after commit (no stale ₹300 when ₹100 remains); balance reservation consistent; never over-request.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T028, ROS-E15-T027
- **Assumptions/config refs:** CONF-B (partials ON)
- **Decision status:** —

### E15-TC-096 — Unknown request-create outcome: no blind retry
- **Source:** CTO add.; G5
- **Config:** A
- **Preconditions:** Mock provider times out on create
- **Steps:** 1. Create request; provider returns timeout after possibly creating.
- **Expected:** Request marked unknown/pending-check; reconciled by status lookup before any retry; no two live provider requests for one bill.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T024
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-097 — Duplicate payment IDs and multiple event IDs per transaction
- **Source:** CTO add.; G6; extends TC-015
- **Config:** A
- **Preconditions:** SUCCESS recorded
- **Steps:** 1. Same payment ID with new event ID. 2. Same event ID twice. 3. Success then reversed-failure for same payment. 4. Mocked payment.failed then payment.captured for same payment (T053).
- **Expected:** One money effect; one receipt intent; replay vs duplicate logged distinctly. failed→captured moves that payment from FAILED to PAID with one ledger entry (ADR 0008). A later failure does not move PAID back to FAILED; it is a new review event, not a silent reversal.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T026, ROS-E15-T053
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-098 — Duplicate refund IDs / refund idempotency
- **Source:** CTO add.; G6
- **Config:** A
- **Preconditions:** SUCCESS ₹520
- **Steps:** 1. Manager submits refund twice. 2. Provider sends refund webhook twice.
- **Expected:** One provider refund; one ledger reversal; REFUNDED once.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T029, ROS-E15-T027
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-099 — Polling vs webhook race
- **Source:** CTO add.; G6
- **Config:** A
- **Preconditions:** PENDING
- **Steps:** 1. Status poll and webhook report SUCCESS at the same moment (repeat).
- **Expected:** Single transition; single ledger row; single receipt.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T027
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-100 — Crash recovery at inbox/writer/outbox points
- **Source:** CTO add.; G6
- **Config:** A
- **Preconditions:** Fault injection in staging
- **Steps:** 1. Kill process after webhook inbox write, before ledger write. 2. After ledger write, before outbox (receipt). 3. After outbox, before send ack.
- **Expected:** On restart each event processed exactly once; ledger consistent; receipt sent once.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T027, ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-101 — Reconciliation of a missed webhook
- **Source:** CTO add.; G6
- **Config:** A
- **Preconditions:** Webhook endpoint blocked during payment
- **Steps:** 1. Pay. 2. Webhook never arrives. 3. Run reconciliation/status check.
- **Expected:** Status check finds payment; SUCCESS via authenticated lookup; appears in reconciliation report.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T007, ROS-E15-T014
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-102 — WhatsApp consent revoked at send time (race)
- **Source:** CTO add.; G7; extends TC-036/037
- **Config:** A
- **Preconditions:** Consented number, send enqueued
- **Steps:** 1. Revoke consent between enqueue and dispatch.
- **Expected:** Dispatch re-checks consent; not sent; logged.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T034
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-103 — Send dedupe across retries and balance refreshes
- **Source:** CTO add.; G7; extends TC-038
- **Config:** B partials ON
- **Preconditions:** Bill v2
- **Steps:** 1. Retry send of v2. 2. Two balance refresh revisions in quick succession.
- **Expected:** One message per version/revision; deduped; latest only.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T031, ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-104 — UNKNOWN send outcome reconciliation
- **Source:** CTO add.; G7
- **Config:** A
- **Preconditions:** Mock WA API times out after accept
- **Steps:** 1. Send.
- **Expected:** Status UNKNOWN; reconciled via status callback/lookup; no blind resend duplicate; payment state never derived from delivery status.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-105 — Stale message suppression
- **Source:** CTO add.; G7
- **Config:** B
- **Preconditions:** v1 queued, v2 finalized before dispatch
- **Steps:** 1. Let queue run.
- **Expected:** v1 message suppressed (stale version/request); only v2 sent; v1 link shows Superseded.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T031, ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-106 — Tip refund and allocation
- **Source:** CTO add.; G8
- **Config:** B
- **Preconditions:** ₹500 + ₹50 tip paid
- **Steps:** 1. Refund full. 2. Refund food only (if allowed). 3. Refund tip only.
- **Expected:** Refund components allocated correctly in tip records and ledger; reports (T049) reflect reversal. Values TBD-from-build.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T029, ROS-E15-T032, ROS-E15-T049
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-107 — Tip rounding boundaries
- **Source:** CTO add.; G8; V14–V17
- **Config:** B
- **Preconditions:** Subtotals giving x.49, x.50, x.51
- **Steps:** 1. Select % tips.
- **Expected:** The percentage is computed in integer paise on the post-discount, pre-tax subtotal, then rounded half-up to the whole rupee (ADR 0010): x.49 down, x.50 up, x.51 up. Calculator-dependent totals TBD-from-build.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T032, ROS-E15-T037, ROS-E15-T020
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-108 — Tip cap: percentage-of-base change re-evaluates cap
- **Source:** CTO add.; G8
- **Config:** B
- **Preconditions:** Cap configured
- **Steps:** 1. Custom ₹100 on base ₹400 confirmed. 2. Remove an item (base ₹300) and re-finalize.
- **Expected:** New version requires tip re-confirmation; ₹100 now exceeds cap ₹75 and is rejected; old request superseded.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T032, ROS-E15-T037
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-109 — Tips OFF affects new bills only
- **Source:** CTO add.; G8
- **Config:** B
- **Preconditions:** Open bill with tip step shown/confirmed
- **Steps:** 1. Turn tips OFF. 2. Pay existing confirmed request. 3. Create new bill.
- **Expected:** Existing bill/request keeps its tip; new bills have no tip UI; historical receipts keep tip line.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T032, ROS-E15-T043
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-110 — KDS: base paid, tip unpaid → released (tips never gate release)
- **Source:** CTO add.; G8/G9; ADR 0009 kitchen base excludes tips
- **Config:** A-variant with tips ON, or C takeaway
- **Preconditions:** Pay-before; base ₹500 paid, tip ₹50 remaining
- **Steps:** 1. Pay base only. 2. Check KDS.
- **Expected:** Order released to kitchen (kitchen base excludes tip); tip remainder tracked separately.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T052, ROS-E15-T030, ROS-E15-T028
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-111 — KDS: 'Awaiting payment' lane + 10-minute aging alert
- **Source:** CTO add.
- **Config:** A
- **Preconditions:** Pay-before order unpaid
- **Steps:** 1. Place unpaid pay-before order. 2. View as kitchen and cashier. 3. Attempt prep actions. 4. Wait 10 min (configurable). 5. Client-side 'success' without ledger payment.
- **Expected:** Read-only lane, no prep actions; alert at default 10 min; no release on client-side success. A SUPERSEDED request keeps the order held. An EXPIRED request stays held unless the late payment matches the unchanged bill exactly, or a Manager or Admin releases it (ADR 0007, ADR 0009).
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T052, ROS-E15-T030
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-112 — KDS: audited manual release
- **Source:** CTO add.; G9
- **Config:** A
- **Preconditions:** Unpaid pay-before order
- **Steps:** 1. Manager releases manually with reason. 2. Captain attempts manual release via UI+API.
- **Expected:** Manager/Admin release requires reason, audit-logged; captain/kitchen don't see button and API returns 403; payment state unchanged.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T034
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-113 — KDS: append after release creates new batch; print retry no duplicate
- **Source:** TRACEABILITY G9 (reverse AC-0009.3)
- **Config:** B
- **Preconditions:** Released order
- **Steps:** 1. Append items. 2. Force KOT print failure then retry.
- **Expected:** Only new items go as new batch; retry prints once.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E02-T006, ROS-E11-T002
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-114 — Webhook disabled alert and reconciliation poll
- **Source:** C5 (board): Razorpay disables webhook after 24h retries
- **Config:** A
- **Preconditions:** Webhook endpoint failing
- **Steps:** 1. Make endpoint return 5xx until provider disables it (simulate disabled state). 2. Pay via success@razorpay meanwhile.
- **Expected:** Webhook-disabled alert raised to admins/ops; reconciliation poll picks up the payment → SUCCESS via authenticated fetch; appears in reconciliation report.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T007, ROS-E15-T035
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-115 — Mocked qr_code.credited correct amount → SUCCESS (fixture baseline)
- **Source:** T053 AC
- **Config:** A
- **Preconditions:** T053 fixtures
- **Steps:** 1. Signed mocked exact-amount event.
- **Expected:** SUCCESS, one ledger entry; proves fixture signing path.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T026
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-116 — Mocked partial refund with tip component
- **Source:** T053 AC; G8
- **Config:** B
- **Preconditions:** ₹500 + ₹50 paid
- **Steps:** 1. Mocked refund.processed for ₹50 tip only. 2. Mocked ₹100 partial food refund.
- **Expected:** Separate ledger refund entries; tip refunded as own component; T049 report reflects; remaining totals TBD-from-build.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T053, ROS-E15-T029, ROS-E15-T032, ROS-E15-T049
- **Assumptions/config refs:** —
- **Decision status:** —

### E15-TC-117 — Webhook with no signature
- **Source:** Earlier CTO-requested case that §8b did not name: a missing signature, distinct from a bad signature (TC-088) and from replay (TC-097).
- **Config:** A
- **Preconditions:** A payment webhook and a WhatsApp delivery webhook endpoint
- **Steps:** 1. Send each webhook with the signature header omitted. 2. Send each with an empty signature.
- **Expected:** Both are rejected. No ledger row, no consent change, and the bill is not marked paid.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T033
- **Assumptions/config refs:** —
- **Decision status:** —

## 9. Traceability matrix (board v2.4; CTO column = TEST_TRACEABILITY.md status)

### 9a. Part H tests 1–20
| # | Test | Test case(s) | Build task(s) | CTO ADR status |
|---|---|---|---|---|
| 1 | Bill at order placement | TC-001, 022 | T030, T024, T052 | Partial (G1) → assertions added to TC-001 |
| 2 | Bill after meal | TC-002, 021 | T030 | Partial (G1) → TC-002 |
| 3 | Running bill updated | TC-003 | T030, T031, T024 | Partial (G1) → TC-003 |
| 4 | Customer requests bill | TC-004 | T050, T030, T031 | Partial (G1) → TC-004 |
| 5 | Tip disabled | TC-005, 026 | T037, T032 | Covered |
| 6 | Tip enabled | TC-006 | T037, T036 | Covered |
| 7 | No tip | TC-007 | T037, T032 | Covered |
| 8 | Fixed tip | TC-008 | T037, T024, T032 | Covered |
| 9 | Percentage tip | TC-009, 107 | T037, T032, T020 | Covered |
| 10 | Custom tip | TC-010, 108 | T037, T032 | Covered |
| 11 | Exact QR amount | TC-011, 027–031, 051 | T025, T024 | Covered |
| 12 | Bill changes after QR | TC-012, 003, 080, 093 | T024, T027, T007 | Covered |
| 13 | Partial payment (B) | TC-013, 053, 055, 095 | T028, T027, T033 | Covered (separate instalments) |
| 14 | Full payment | TC-014 | T026, T027 | Partial (G2) → TC-014 |
| 15 | Duplicate webhook | TC-015, 049, 097 | T026, T053 | Covered |
| 16 | Cross-outlet isolation | TC-016, 067, 092 | T023, T042, T033 | Covered |
| 17 | Correct receipt | TC-017, 069 | T036, T033, T041 | Partial (G2) → TC-017 |
| 18 | Correct ledger | TC-018 | T027 | Covered |
| 19 | Tip in reports | TC-019, 106, 116 | T049, T032 | Covered |
| 20 | Captain bypass | TC-020, 056, 112 | T034, T039, T029, T052, ROS-E04-T005 | Partial (G3) → TC-020 table-driven |
| Reg. | POS/Captain/QR/KDS/payment | TC-074–078 | **T051** (run) | Covered (family level) |

### 9b. §9 failure cases
| Item | Test case(s) | Build task(s) | CTO status |
|---|---|---|---|
| WhatsApp unavailable | TC-039 | T035, T038 | Covered |
| Invalid number | TC-040 | T033, T035 | Covered |
| Template rejected | TC-041 | T033, T035 | Covered |
| QR generation fails | TC-042 | T035 | Partial (G2) → TC-042 |
| Provider unavailable | TC-043 | T035 | Covered |
| Payment expires | TC-034, 083 | T053, T027, T036, T044, T052 | Covered |
| Webhook delayed | TC-044, 114 | T026 | Covered |
| Webhook duplicated | TC-015, 097 | T026, T027, T053 | Covered |
| Incorrect amount | TC-033 | T053, T026, T027, T041 | Covered |
| Partial payment | TC-013 | T028 | Covered |
| Full payment | TC-014 | T026, T027 | Partial (G2) → TC-014 |
| Refund | TC-035, 098, 106, 116 | T053, T029 | Covered |
| Customer pays twice | TC-045 | T026, T027, T053 | Covered |
| Bill changes after QR | TC-012, 093 | T024, T027 | Covered |
| Merchant disconnected | TC-046, 090 | T035, T042 | Covered |

### 9c. §11 demo tests
| Test | Case(s) | Task(s) | CTO status |
|---|---|---|---|
| D1 Bill generation | TC-001–004, 027–031 | T030 | Partial (G1) → TC-001–004 |
| D2 Dynamic QR | TC-011, 027–031 | T025 | Covered |
| D3 Exact amount | TC-011, 051 | T024, T025 | Covered |
| D4 WhatsApp message | TC-038, 103, 105 | T033, T031 | Partial (G2) → TC-038 |
| D5 Payment success | TC-014, 028–031 | T026, T027 | Partial (G2) → TC-014 |
| D6 Payment failure | TC-032 | T027, T053 | Partial (G2) → TC-032 (decline vs timeout; failure@razorpay) |
| D7 Partial | TC-013 | T028 | Covered |
| D8 Duplicate webhook | TC-015 | T026 | Covered |
| D9 Wrong amount | TC-033 | T053 | Covered |
| D10 Expired QR | TC-034 | T053, T027 | Covered |
| D11 Refund | TC-035 | T053, T029 | Covered |
| D12 Multi-outlet | TC-016, 067 | T023 | Covered |
| D13 Consent | TC-036, 037, 102 | T033, T034 | Covered |
| D14 Receipt | TC-017, 069 | T036, T033 | Partial (G2) → TC-017 |
All 14 CTO "Partial" rows (H1–4, H14, H17, H20, D1, D4–D6, D14, F4, F11) now have strengthened assertions in the named cases. G4–G9 reverse gaps are covered in §8b (TC-088–113). G10 (provider/release evidence gates) is a release checklist, not QA test cases → T047/T048.

### 9d. UX_SPEC acceptance criteria
AC-1.1/1.2 → TC-038 · AC-1.3 → TC-003 · AC-1.4 → TC-036 · AC-1b.1 → TC-011 · AC-1b.2 → TC-005 · AC-1b.3 → TC-006 · AC-1b.4 → TC-008 · AC-1b.5 → TC-044 · AC-1b.6 → TC-034 · AC-1b.7 → TC-073 · AC-2.1 → TC-070 · AC-2.2 → TC-020 · AC-2.3 → TC-071 · AC-2.4 → TC-013 · AC-2.5 → TC-039 · AC-3.1 → TC-070 · AC-3.2 → TC-053 · AC-3.3 → TC-056 · AC-3.4 → TC-057, 082 · AC-3.5 → TC-058 · AC-3.6 → TC-033 · AC-3.7 → TC-054 · AC-4.1 → TC-060 · AC-4.2 → TC-059 · AC-4.3 → TC-016 · AC-4.4 → TC-061 · AC-4.5 → TC-062 · AC-4b.1 → TC-025 · AC-4b.2 → TC-021/022 · AC-4b.3 → TC-026 · AC-4b.4 → TC-024 · AC-4b.5 → TC-023 · AC-5.1 → TC-012, 034, 080 · AC-5.2 → TC-045 · AC-5.3 → TC-068 · AC-5.4 → TC-039.

### 9e. Still uncovered / partially covered (board v2.4)
1. **Unknown request-create outcome / no blind retry (TC-096)** — T035/T024 have no explicit AC.
2. **Crash recovery at inbox/writer/outbox points (TC-100)** — no explicit AC in T026/T027/T033.
3. **Test-vs-live credential separation (TC-091)** and **OAuth state/revoke (TC-090)** — no explicit AC (T023/T042 cover masking only).
4. **Stale-message suppression and UNKNOWN send outcome (TC-104, TC-105)** — implied by T031/T033 but not explicit.
5. **Tips-OFF affects new bills only (TC-109)** — no explicit AC in T032/T043.
6. **Append-after-release new KOT batch / print retry (TC-113)** — only E02-T006/E11-T002 (outside E15).
All Part H, §9 and §11 items now have a covering build task (v1 gaps on tip report, request-bill screen, opt-out, captain server-side 403, replay, concurrency, invalid number/template and regression ownership are closed by T049–T053 and updated ACs).

### 9f. Ambiguities / contradictions
- **Resolved:** "Superseded not one of the 9 statuses" → CR-1 makes SUPERSEDED a distinct status (TC-079). Board T009 note about missing 20 tests — fixed in v2.3+. Partials conflict → CONF-A/CONF-B. Printing → browser-print only.
- **X-1 (new):** CR-1 (SUPERSEDED distinct status) vs board OQ14 interim "a flag on the old request, not a ledger status" and T027's 9-status AC (no SUPERSEDED). CTO to reconcile in architecture doc.
- **X-2 (new):** CR-3 uses "ACTIVE-and-unexpired"; no ACTIVE status exists (PENDING? PARTIALLY_PAID's open remainder?). TC-082 treats ACTIVE = PENDING and an open remainder request.
- **X-3:** Delivery policy for Restaurant C not set by PD-4; ADR 0009 CEO default says takeaway+delivery pay-before, AC-4b.5 tests org-rule fallback.
- **X-4 (new):** Environment: T051 says "localhost demo", CTO proposal (OQ27) says Vercel preview staging; plan supports both pending D-1.
- **X-5 (new):** T053 "payment.failed then payment.captured → PAID" — PAID isn't one of the 9 statuses (= SUCCESS assumed).
- **X-6:** Restaurant B's test tips are 5%, 10% and 15% plus custom capped at 25% of the tip base. The ₹20/₹50/₹100 fallback does not apply to B. Browser-print of the receipt is the printing scope until the Founder decides otherwise.
- **X-7 (new):** Board T009/T046 rows still reference "78 cases E15-TC-001…078"; plan v1.1 has 116 (TC-001…116). T046 needs updating by PD.
- **X-8:** D6/D9 tip base pending Founder; calculator-dependent ₹ values TBD-from-build.

## 10. Pending decisions (cases marked Blocked-on-decision)
| ID | Decision | Owner | Status | Blocked cases |
|---|---|---|---|---|
| F-1 | Printing scope | Founder | **Resolved for testing**: browser-print receipt only (CEO default; Founder may override) | — (TC-069 runnable) |
| F-2 | B tip amounts | Founder | **Resolved for testing**: 5%, 10% and 15% plus custom, capped at 25% of the tip base. No ₹20/₹50/₹100 chips. | — |
| F-3 | Max custom tip | Founder | **Resolved for testing**: 25% of tip base | — |
| F-4 | Itemized vs summary+link WhatsApp | Founder (+CTO template check) | Open (CEO default summary+link) | TC-017 (partly), TC-038 |
| C-1 | Replay window | CTO | **Resolved** C3/C5 | — |
| C-2 | Opt-out mechanism | CTO | **Resolved** C4 | — |
| C-3 | KDS unpaid handling | CTO | **Resolved** C2 (T052) | — |
| C-4 | Sandbox capabilities | CTO | **Resolved** C6 (mocks via T053); open: qr_code.closed reason (OQ28), minimum amount (T048) | TC-027 (T048), TC-034/083 (partly, OQ28) |
| D-1 | Staging URL + evidence storage | CTO + DevOps | **Open** (proposal OQ27) | All executions (entry criterion) |
| X-1/X-2 | SUPERSEDED status / ACTIVE meaning | CTO | Open | TC-079, TC-082 (expected-state wording) |
Other open items carried from board: rate-limit thresholds (TC-064), polling interval (TC-071), manual-review roles (TC-056), tip label 'Tip' vs 'Tip (voluntary)' (TC-017, 069), tip tax (CA).

## 11. Execution mapping and blockers
| QA task | Status | Test cases | Blockers |
|---|---|---|---|
| ROS-E15-T009 (this plan) | In Review | — | CTO review; §10 open items |
| ROS-E15-T015 WHATSAPP_PAYMENT_E2E_REPORT | Blocked | TC-011–018, 027–052, 059–068, 088–105, 114–116 | Razorpay test keys, WhatsApp test number, T053 fixtures, D-1 |
| ROS-E15-T021 BILLING_POLICY_E2E_REPORT | Backlog | TC-001–010, 019, 021–026, 053–058, 069, 070, 072, 079–087, 106–113 | T046; T030–T032, T037, T043, T049, T050, T052 built |
| ROS-E15-T045 Demo A/B/C | Blocked | TC-027–031 + §11 set (001, 011, 013–017, 032–036, 038) | ROS-E13-T001 seed; test keys; WhatsApp test number; TC-027 on T048 |
| ROS-E15-T046 Execute all | Blocked | TC-001–116 (board row still says 001…078 — X-7) | T045, T006, keys, test number, D-1 |
| ROS-E15-T051 Regression run | Backlog | TC-074–078 | ROS-E13-T005 |
| ROS-E15-T048 First real-money test | Backlog | sets minimum for TC-027 | Founder approval; after T045/T046 |
Global: no E15 build until Wave 1 merges into `pro-max/release`. No live payments before T047 + Founder approval.
