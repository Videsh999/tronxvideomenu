**Draft.**

# TEST PLAN — ROS Epic E15: WhatsApp Billing, Dynamic UPI QR, Billing Policies & Optional Tips

**Task:** ROS-E15-T009 · **Owner:** TRONX QA ENGINEER · **Reviewer:** TRONX CTO · **Version:** 0.1 · **Status: DRAFT** (written 2026-11-07, before build; execution happens after build)
**Inputs:** FOUNDER_ORDER_2026-11-07.md (Orders 1–2, Appendix Part H, §11 demo tests, §9 failure cases), UX_SPEC.md v1.1, ../TRONX_PRO_MAX_TASK_BOARD.md v2, BILLING_VALIDATION_CASES.md (V01–V32, CEO defaults D1–D7), ADRs 0006–0011.
No requirement here is new. Anything the brief does not state is marked **ASSUMPTION** or listed in §8 Open questions. Results will **never** be fabricated: T015/T021 report only executed runs.

## 1. Scope
In scope: E15 build tasks T022–T044 (backend + frontend), behaviour of Orders 1 and 2, Part H tests 1–20 on restaurants A/B/C, §9 failure list, §11 demo, UX_SPEC AC-1…AC-5, security basics, offline/printing where relevant, regression of POS, Captain, QR ordering, KDS and existing payments.
Out of scope: live payments, production credentials, real WhatsApp customers, legal/tax correctness of tips (Finance/CA, T008/T019), provider selection (T001), performance/load beyond rate-limit checks, accessibility audit (T005, Design).

## 2. Environment
- **Staging/sandbox only.** Build from `pro-max/release` after Wave 1 merges; deployed to a staging env with loopback/synthetic DB (T045 AC).
- Payment provider **sandbox/test mode only**; TEST band must be visible. No real money, ever. Live mode must be disabled (TC-060).
- WhatsApp: provider **test number** + synthetic recipient numbers registered as test recipients only. No messages to real customers.
- Data: synthetic orgs/outlets/menus/customers only (seed via ROS-E13-T001). No production data, no real phone numbers, no real merchant credentials.
- Mock provider (T022) for failure injection (provider down, QR fail, template rejected, delayed webhooks) where sandbox cannot simulate.
- Tools: API client (signed/unsigned webhook replay), browser devtools (DOM/network/storage), log access (redaction checks), 2 devices for captain + POS, mobile 360–414 and desktop 1280 viewports.

### Test restaurants (Part H)
| ID | Billing policy | Tips | Partials | Notes |
|---|---|---|---|---|
| A | PAY_BEFORE_PREPARATION | OFF | OFF (D2 default) | Brief: tips disabled |
| B | PAY_AFTER_MEAL (table session, running bill) | ON: 5/10/15%, custom ON | ON for TC-013/053/055 only (**ASSUMPTION**, brief silent; D2 default OFF) | |
| C | FLEXIBLE by order type | per TC | OFF | **ASSUMPTION:** Dine-in = after, Takeaway = before (from AC-4b.2), Delivery via org rule (AC-4b.5). Brief does not set the mapping. |
Restaurant B's test config explicitly turns partial payments on, since D2 (default off) is only the default. Restaurant A keeps partials off, which covers the default path.
Plus: a 2nd outlet in A's org and a 2nd org (isolation tests), and an outlet with E15 disabled (regression baseline).

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
Per executed case: build SHA, env, date/time (IST), tester, restaurant config, request/payment IDs, provider sandbox refs, screenshots (or screen recording for multi-step), API request/response (secrets redacted), relevant ledger rows, webhook payload + verification result, log excerpt proving redaction where relevant. Stored under `docs/whatsapp-payments/evidence/<TC-ID>/` (**ASSUMPTION** path). Result = Pass / Fail (bug ID) / Blocked (reason) / Not run. No result without evidence.

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
- **Expected:** Bill created server-side at submission with amount from calculateRestaurantBill; payment request issued for that amount; order shown with effective policy 'Before prep'; KDS release behaviour follows the separate kitchen-release setting (not forced by billing policy).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T024

### E15-TC-002 — Bill generated after meal (pay-after, running session)
- **Source:** Part H #2; Order 2
- **Config:** B
- **Preconditions:** Restaurant B, PAY_AFTER_MEAL, table session open
- **Steps:** 1. Captain places order 1 on T5. 2. Kitchen prepares. 3. Captain requests bill at checkout.
- **Expected:** No payment request before checkout; kitchen receives order without payment; final bill generated at checkout from server billing; effective policy 'After meal'.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030

### E15-TC-003 — Running bill updated after additional items
- **Source:** Part H #3; Order 1 bill versioning; AC-1.3
- **Config:** B
- **Preconditions:** B; table session with running bill v1 (sent/finalized)
- **Steps:** 1. Add 2 items to same table session. 2. Re-finalize. 3. Open old link.
- **Expected:** Running-bill snapshot v1 preserved in audit; v2 totals = v1 + new items (server calc); v2 sent with 'bill was updated' copy; v1 link shows Superseded and is not payable.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T031, ROS-E15-T024

### E15-TC-004 — Customer requests final bill
- **Source:** Part H #4; Order 2 bill timing 'on customer request'
- **Config:** B
- **Preconditions:** B; running session, bill timing option 'on customer request' enabled
- **Steps:** 1. Customer taps Request bill (surface TBD, see OQ). 2. Staff finalizes.
- **Expected:** Request recorded; bill finalized server-side; WhatsApp/QR only after finalization (AC-1.1).
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T031

### E15-TC-005 — Tips disabled → no tip interface anywhere
- **Source:** Part H #5; AC-1b.2; Order 2 tips
- **Config:** A
- **Preconditions:** A tips OFF
- **Steps:** 1. Open customer payment page, captain screen, POS panel, WhatsApp message, receipt. 2. Inspect DOM.
- **Expected:** No tip element in DOM on any surface, no tip component in QR, no receipt tip line. API rejects/ignores a client-sent tip (V22).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032

### E15-TC-006 — Tips enabled → optional tip interface, nothing preselected
- **Source:** Part H #6; AC-1b.3
- **Config:** B
- **Preconditions:** B tips ON 5/10/15%, custom
- **Steps:** 1. Open payment page for bill.
- **Expected:** Tip step shown with 5/10/15/custom/no-tip; nothing preselected; Pay/QR unavailable until explicit confirmation.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T036

### E15-TC-007 — No-tip selection
- **Source:** Part H #7; V21
- **Config:** B
- **Preconditions:** B; bill ₹520
- **Steps:** 1. Choose No tip. 2. Confirm.
- **Expected:** Payment request = bill total (₹520); no tip record/line.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032

### E15-TC-008 — Fixed tip (500 + 50 = 550)
- **Source:** Part H #8; Order 2 example; V13; AC-1b.4
- **Config:** B
- **Preconditions:** B; fixed tip ₹50 configured (assumption: 'fixed' = configured fixed-amount suggestion)
- **Steps:** 1. Bill ₹500 request R1 shown. 2. Select ₹50, confirm.
- **Expected:** New request R2 ₹550; R1 superseded and not payable; tip record ₹50 with source=fixed, confirmation, order, bill, outlet, timestamp.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T024, ROS-E15-T032

### E15-TC-009 — Percentage tip 5/10/15% with rounding (D6)
- **Source:** Part H #9; V14–V18
- **Config:** B
- **Preconditions:** B; subtotals per V14–V18
- **Steps:** 1. For each case select %, read displayed tip, confirm.
- **Expected:** Tip = % of post-discount pre-tax subtotal, half-up whole rupee (V14 ₹13, V15 ₹12, V16 ₹26, V17 ₹152, V18 ₹90); displayed tip == stored tip == QR delta. (D6 pending Founder.)
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032, ROS-E15-T020

### E15-TC-010 — Custom tip incl. invalid values
- **Source:** Part H #10; V23
- **Config:** B
- **Preconditions:** B custom ON
- **Steps:** 1. Enter ₹37 confirm. 2. Enter -5, 12.5, 0, huge value, script text.
- **Expected:** ₹37 accepted (request = total+37); negative/non-integer/non-numeric rejected server-side; 0 = no tip. Max cap: OPEN (brief silent).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T037, ROS-E15-T032

### E15-TC-011 — Exact dynamic QR amount = server bill
- **Source:** Part H #11; §11 'exact expected amount'; AC-1b.1
- **Config:** A,B,C
- **Preconditions:** Sandbox provider
- **Steps:** 1. Generate request. 2. Decode QR / link payload. 3. Compare with server bill.
- **Expected:** QR/link amount equals server request amount; request bound to org, outlet, order, bill version, request ID, merchant, currency, expiry, provider ref. Exact-amount *enforcement* claimed only if provider guarantees it (T001).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T024

### E15-TC-012 — Bill changes after QR generation
- **Source:** Part H #12; §9 'bill changes after QR'; V30
- **Config:** B,C
- **Preconditions:** Request R1 PENDING
- **Steps:** 1. Add item / cancel line. 2. Re-finalize. 3. Pay R1 in sandbox.
- **Expected:** R1 superseded (CANCELLED/superseded, Q6); R2 issued; payment on R1 → MANUAL_REVIEW, never SUCCESS (AC-5.1) and routed to reconciliation.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024, ROS-E15-T027, ROS-E15-T007

### E15-TC-013 — Partial payment 500 = 200 + 300
- **Source:** Part H #13; Order 1; AC-2.4; V24
- **Config:** B (partials ON)
- **Preconditions:** Outlet partial payments ON (D2 default OFF)
- **Steps:** 1. Pay ₹200 on ₹500 request. 2. Observe. 3. Pay ₹300 on new request.
- **Expected:** ₹200 recorded; PARTIALLY_PAID; new ₹300 request sent on WhatsApp; Paid only after ₹300 verified; no duplicates, no overpay.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T028, ROS-E15-T027, ROS-E15-T033

### E15-TC-014 — Full payment
- **Source:** Part H #14; §9; §11 'payment success'
- **Config:** A,B,C
- **Preconditions:** Request PENDING
- **Steps:** 1. Pay exact amount in sandbox. 2. Wait for verified webhook.
- **Expected:** SUCCESS only after signature-verified webhook or authenticated status check; ledger entry; table/bill closable; receipt sent.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T027

### E15-TC-015 — Duplicate webhook
- **Source:** Part H #15; §9; §11
- **Config:** A
- **Preconditions:** SUCCESS already recorded
- **Steps:** 1. Re-deliver identical signed webhook event 2–5 times (incl. concurrently).
- **Expected:** Idempotent: one ledger entry, one receipt, no state change.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026

### E15-TC-016 — Cross-outlet configuration isolation
- **Source:** Part H #16; §11 multi-outlet; AC-4.3
- **Config:** A vs B (same org) + other org
- **Preconditions:** Two outlets with distinct merchant/WA configs
- **Steps:** 1. As outlet-A admin open settings. 2. Fetch outlet-B config via API with A's session. 3. Create request at A; check merchant used.
- **Expected:** No other outlet's merchant/WA data in UI or API (403/404); request uses A's merchant only; settlement to A's own merchant account.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T042

### E15-TC-017 — Correct receipt
- **Source:** Part H #17; §11 receipt generation; UX §11
- **Config:** A,B
- **Preconditions:** Verified payment
- **Steps:** 1. Complete payment. 2. Check page + WhatsApp receipt.
- **Expected:** Receipt only after verified payment; fields per UX §11 (restaurant, outlet, GSTIN, invoice no, bill version, ref, items, taxes, totals, provider ref); tip line only if tipped; partials list each payment.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T036, ROS-E15-T033

### E15-TC-018 — Correct payment ledger
- **Source:** Part H #18; Order 1 'ledger source of truth'
- **Config:** A,B,C
- **Preconditions:** Run of TC-011..015
- **Steps:** 1. Export ledger rows for run.
- **Expected:** Existing ledger is source of truth; each verified payment one row with merchant, refs, amount, currency, status; amounts reconcile to provider sandbox report.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027

### E15-TC-019 — Tip separately identifiable in reports
- **Source:** Part H #19; Order 2 tip records
- **Config:** B
- **Preconditions:** Payments with/without tips
- **Steps:** 1. Open reports/exports.
- **Expected:** Tip shown as separate component from food revenue; no tax applied to tip; no claim tips go to an employee.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T032 (data only — report UI: GAP)

### E15-TC-020 — Captain cannot bypass payment permissions
- **Source:** Part H #20; Order 1 role gating; AC-2.2
- **Config:** A,B,C
- **Preconditions:** Default captain account
- **Steps:** 1. Check UI for Refund/Settle/Cash close/Resolve. 2. Call those APIs directly with captain token.
- **Expected:** UI hides actions AND server returns 403 for each; audit logged.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T039, ROS-E15-T029, ROS-E04-T005

### E15-TC-021 — Restaurant C: dine-in follows pay-after
- **Source:** Part H config C; AC-4b.2
- **Config:** C
- **Preconditions:** C Flexible: Dine-in=after, Takeaway=before (assumption)
- **Steps:** 1. Dine-in order.
- **Expected:** Behaves as pay-after; preview shows 'Why'.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043

### E15-TC-022 — Restaurant C: takeaway follows pay-before
- **Source:** Part H config C; AC-4b.2
- **Config:** C
- **Preconditions:** as above
- **Steps:** 1. Takeaway order.
- **Expected:** Bill + request at submission; preview 'Before prep · Why: Outlet + order type rule'.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043

### E15-TC-023 — Restaurant C: precedence falls back to org+order-type
- **Source:** AC-4b.5; D1
- **Config:** C
- **Preconditions:** No outlet rule for Delivery; org+delivery rule exists
- **Steps:** 1. Delivery order; open preview.
- **Expected:** 'Why: Org + order type rule'.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043

### E15-TC-024 — Policy change keeps open orders' policy
- **Source:** AC-4b.4; T030
- **Config:** C
- **Preconditions:** Open orders exist
- **Steps:** 1. Change policy.
- **Expected:** Open orders keep original policy; note shown.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030, ROS-E15-T043

### E15-TC-025 — New outlet tips default OFF
- **Source:** AC-4b.1
- **Config:** new
- **Preconditions:** Create outlet
- **Steps:** 1. Inspect billing prefs.
- **Expected:** ENABLE_CUSTOMER_TIPS = OFF.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T032, ROS-E15-T043

### E15-TC-026 — Tips ON only for dine-in → takeaway has no tip UI
- **Source:** AC-4b.3
- **Config:** C/B
- **Preconditions:** Tips scoped to dine-in
- **Steps:** 1. Takeaway payment page.
- **Expected:** No tip element in DOM.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T037

### E15-TC-027 — Demo amount ₹1: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹1 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay in sandbox. 4. Check receipt + ledger.
- **Expected:** Request = ₹1 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. ₹1: confirm provider minimum (OQ).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045

### E15-TC-028 — Demo amount ₹20: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹20 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay in sandbox. 4. Check receipt + ledger.
- **Expected:** Request = ₹20 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. ₹1: confirm provider minimum (OQ).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045

### E15-TC-029 — Demo amount ₹149: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹149 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay in sandbox. 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹149 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. ₹1: confirm provider minimum (OQ).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045

### E15-TC-030 — Demo amount ₹520: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹520 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay in sandbox. 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹520 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. ₹1: confirm provider minimum (OQ).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045

### E15-TC-031 — Demo amount ₹1250: bill → QR → WhatsApp → pay → receipt
- **Source:** §11 demo; V32
- **Config:** A (and B with tip where noted)
- **Preconditions:** Sandbox; synthetic test number
- **Steps:** 1. Build order whose server total = ₹1250 (calc incl. GST per outlet config). 2. Send WhatsApp. 3. Pay in sandbox. 4. Check receipt + ledger. 5. Repeat on B with 10% tip and verify D6 rounding.
- **Expected:** Request = ₹1250 server amount (tax breakdown from calculator, values TBD by Backend); SUCCESS on verified webhook; receipt + ledger match. ₹1: confirm provider minimum (OQ).
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T025, ROS-E15-T026, ROS-E15-T033, ROS-E15-T045

### E15-TC-032 — Payment failure
- **Source:** §11 payment failure
- **Config:** A
- **Preconditions:** Sandbox failure simulation
- **Steps:** 1. Trigger failure.
- **Expected:** FAILED; 'Try again' creates new request ID; no ledger SUCCESS.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T044

### E15-TC-033 — Wrong amount paid (under/over)
- **Source:** §9 incorrect amount; §11; AC-3.6; V25, V28, V29
- **Config:** A,B
- **Preconditions:** Sandbox able to send different amount (only if provider allows)
- **Steps:** 1. Pay ₹520 on ₹500 (no partials). 2. Pay ₹200 on ₹500 with partials OFF. 3. Pay ₹600 on ₹550 (tip).
- **Expected:** Never silently settles: MANUAL_REVIEW; overpay only resolution 'Refund excess'; excess never becomes tip; partials OFF → no auto remainder request.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T027, ROS-E15-T041, ROS-E15-T007

### E15-TC-034 — Expired QR
- **Source:** §9 payment expires; §11; AC-1b.6
- **Config:** A
- **Preconditions:** Short expiry in sandbox
- **Steps:** 1. Let countdown reach 0. 2. Regenerate. 3. Pay old request late.
- **Expected:** EXPIRED state shown; regenerate = new request ID; late payment on expired → MANUAL_REVIEW.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T027, ROS-E15-T036, ROS-E15-T044

### E15-TC-035 — Refund (provider, role-gated)
- **Source:** §9 refund; §11
- **Config:** A
- **Preconditions:** SUCCESS payment; manager account
- **Steps:** 1. Manager refunds. 2. Captain attempts refund (UI+API).
- **Expected:** REFUND_PENDING → REFUNDED only from verified provider status; captain rejected 403.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T029

### E15-TC-036 — Customer consent before WhatsApp send
- **Source:** §11 customer consent; AC-1.4
- **Config:** A
- **Preconditions:** Number without consent record
- **Steps:** 1. Try send.
- **Expected:** Blocked 'No WhatsApp consent for this number'; consent record (who/when/source) required.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T034

### E15-TC-037 — WhatsApp opt-out honoured
- **Source:** Order 1 'consent records' (opt-out: assumption)
- **Config:** A
- **Preconditions:** Number with consent, then opt-out (STOP/withdraw)
- **Steps:** 1. Withdraw consent. 2. Try send / auto-send.
- **Expected:** No message sent; bill still available in POS. ASSUMPTION: brief does not define opt-out mechanism.
- **Priority:** P2
- **Covering build task(s):** GAP (T033 covers consent only)

### E15-TC-038 — WhatsApp message content and finalized-only
- **Source:** §11 WhatsApp generation; Order 1 itemized fields; AC-1.1, AC-1.2
- **Config:** A,B
- **Preconditions:** Test number
- **Steps:** 1. Try send unfinalized. 2. Finalize and send. 3. Trigger auto-send again for same version.
- **Expected:** Disabled until finalized; content per template default (summary + secure link, Q3) with listed fields where template allows; no duplicate per version ('Already sent').
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T031, ROS-E15-T033, ROS-E15-T038

### E15-TC-039 — WhatsApp unavailable
- **Source:** §9; AC-2.5, AC-5.4
- **Config:** A
- **Preconditions:** Mock WA API down
- **Steps:** 1. Send bill.
- **Expected:** 'Not delivered' note; QR usable; bill available in POS and captain.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T038

### E15-TC-040 — Invalid customer number
- **Source:** §9; UX §10
- **Config:** A
- **Preconditions:** Malformed / non-WA synthetic number
- **Steps:** 1. Send.
- **Expected:** 'Not delivered: invalid number' + Edit number/Show QR; no retry loop; number not logged unredacted.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T033, ROS-E15-T035 (no explicit AC)

### E15-TC-041 — Template rejected
- **Source:** §9
- **Config:** A
- **Preconditions:** Mock template rejection
- **Steps:** 1. Send.
- **Expected:** Failure logged in delivery logs; fallback QR/POS; no unapproved free-form message.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T033 (no explicit AC)

### E15-TC-042 — QR generation fails
- **Source:** §9; UX §10
- **Config:** A
- **Preconditions:** Mock provider QR error
- **Steps:** 1. Generate.
- **Expected:** 'QR unavailable' → other authorized methods; no PENDING orphan request.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035

### E15-TC-043 — Provider unavailable
- **Source:** §9
- **Config:** A
- **Preconditions:** Mock provider timeout
- **Steps:** 1. Generate / status check.
- **Expected:** Banner 'use other methods'; uncertain → Pending/Manual review, never Paid.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035

### E15-TC-044 — Webhook delayed
- **Source:** §9; AC-1b.5
- **Config:** A
- **Preconditions:** Hold webhook 5+ min
- **Steps:** 1. Pay. 2. Return to page.
- **Expected:** 'Checking payment…' not Paid; status check resolves; later webhook idempotent.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T036

### E15-TC-045 — Customer pays twice
- **Source:** §9; AC-5.2
- **Config:** A
- **Preconditions:** Two sandbox payments on same bill
- **Steps:** 1. Pay; pay again.
- **Expected:** Bill Paid once; second → MANUAL_REVIEW → refund path.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T044, ROS-E15-T007

### E15-TC-046 — Merchant account disconnected
- **Source:** §9
- **Config:** A
- **Preconditions:** Disconnect merchant in sandbox/config
- **Steps:** 1. Generate request.
- **Expected:** 'Online payment unavailable'; no request created; admin reconnect link admin-only.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T042

### E15-TC-047 — Forged / unsigned webhook rejected
- **Source:** Order 1 verification
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. POST webhook with no signature, bad signature, wrong secret, other outlet's secret.
- **Expected:** 401/400; no state change; logged without secrets.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T012

### E15-TC-048 — Webhook field mismatch (merchant/ref/currency)
- **Source:** Order 1 verification checks
- **Config:** A
- **Preconditions:** Valid signature, tampered fields (sandbox-signed)
- **Steps:** 1. Send event with other merchant / other order ref / USD / amount ≠ expected.
- **Expected:** Not SUCCESS; MANUAL_REVIEW or rejected.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026

### E15-TC-049 — Replayed old webhook
- **Source:** Order 1 idempotent; replay window: assumption
- **Config:** A
- **Preconditions:** Captured valid event from earlier request
- **Steps:** 1. Replay after request superseded/refunded.
- **Expected:** No regression of state; no new ledger row. Timestamp-window rule OPEN.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026 (replay not explicit)

### E15-TC-050 — Concurrent payments / webhooks on same bill
- **Source:** Order 1 'no duplicates'; ROS-E02 CAS
- **Config:** B
- **Preconditions:** Partials ON
- **Steps:** 1. Fire SUCCESS webhooks for R1 and R2 simultaneously. 2. Two staff record cash+UPI concurrently.
- **Expected:** No lost update; total paid ≤ payable; excess → MANUAL_REVIEW.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T026, ROS-E15-T028, ROS-E02-T007 (concurrency not explicit in E15)

### E15-TC-051 — Client-sent amount ignored
- **Source:** Order 1 'never frontend'; V31
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Tamper amount in request-creation API.
- **Expected:** Server amount wins / 400.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024

### E15-TC-052 — Request reuse for another order rejected
- **Source:** Order 1
- **Config:** A
- **Preconditions:** Two orders
- **Steps:** 1. Pay order 2 using order 1 request ID/link.
- **Expected:** Rejected.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T024

### E15-TC-053 — Amount above remaining rejected
- **Source:** AC-3.2; T028
- **Config:** B partials ON
- **Preconditions:** Remaining ₹300
- **Steps:** 1. Enter ₹350 in POS. 2. Call API directly with 350.
- **Expected:** 'Max ₹300', no request, server rejects.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T041, ROS-E15-T028

### E15-TC-054 — Partials OFF → no split control
- **Source:** AC-3.7; D2
- **Config:** A
- **Preconditions:** Partials OFF
- **Steps:** 1. Open POS panel.
- **Expected:** No split/partial control rendered; API rejects partial request.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041, ROS-E15-T028

### E15-TC-055 — Partial with tip allocation (tip last)
- **Source:** V26, V27; D4
- **Config:** B partials ON
- **Preconditions:** ₹500 + ₹50
- **Steps:** 1. Pay 200 then 350. 2. Separate run: pay 520.
- **Expected:** Allocations per V26/V27.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T028, ROS-E15-T032

### E15-TC-056 — Manual review resolution role-gated
- **Source:** AC-3.3; Q10
- **Config:** B
- **Preconditions:** MANUAL_REVIEW item
- **Steps:** 1. Captain/Cashier view + API. 2. Manager resolve without reason; with reason.
- **Expected:** Actions absent & 403 for captain/cashier; manager must enter reason; audited.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T041, ROS-E04-T005

### E15-TC-057 — Close bill disabled while PENDING
- **Source:** AC-3.4
- **Config:** A
- **Preconditions:** Request PENDING
- **Steps:** 1. Try Close bill (UI + API).
- **Expected:** Disabled with tooltip; API rejects.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041

### E15-TC-058 — Server write failure never shown as recorded
- **Source:** AC-3.5
- **Config:** A
- **Preconditions:** Inject DB write failure
- **Steps:** 1. Record payment.
- **Expected:** Error + retry; not shown as recorded.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T041, ROS-E08-T003

### E15-TC-059 — Secrets masked, write-only
- **Source:** AC-4.2; Order 1 secret storage
- **Config:** A
- **Preconditions:** Saved provider/WA secrets
- **Steps:** 1. View settings. 2. GET config API. 3. grep logs, browser storage, network.
- **Expected:** Only masked last-4; never in browser storage/logs; no bank passwords/UPI PINs fields.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T042, ROS-E15-T034

### E15-TC-060 — Live mode disabled without live credentials
- **Source:** AC-4.1; Order 1 'no live payments'
- **Config:** A
- **Preconditions:** Test credentials only
- **Steps:** 1. Try toggle Live.
- **Expected:** Disabled with checklist.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T042, ROS-E15-T047

### E15-TC-061 — TEST band on all surfaces in test mode
- **Source:** AC-4.4
- **Config:** A
- **Preconditions:** Test mode
- **Steps:** 1. Open customer, captain, POS.
- **Expected:** TEST band everywhere.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T042, ROS-E15-T044

### E15-TC-062 — Unconfirmed capability shows '?'
- **Source:** AC-4.5
- **Config:** A
- **Preconditions:** Capability unknown
- **Steps:** 1. Open settings.
- **Expected:** '?' and dependent copy disabled.
- **Priority:** P3
- **Covering build task(s):** ROS-E15-T042

### E15-TC-063 — Payment page token & data hygiene
- **Source:** UX §5 gating; Order 1 phone protection
- **Config:** A
- **Preconditions:** Valid link
- **Steps:** 1. Tamper/guess token. 2. Inspect response for org IDs, settings, phone.
- **Expected:** Invalid token 404; response contains no org IDs/billing settings/full phone.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T036, ROS-E15-T034

### E15-TC-064 — Rate limiting on payment/send endpoints
- **Source:** Order 1 rate limits; T034
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Burst request-creation, send, webhook, payment-page.
- **Expected:** 429 beyond threshold (thresholds OPEN, board OQ6).
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T034, ROS-E12-T013

### E15-TC-065 — Logs redact phones and payment fields
- **Source:** T034
- **Config:** A
- **Preconditions:** Run any flow
- **Steps:** 1. Inspect logs.
- **Expected:** Phones, payment account fields, secrets redacted.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T034, ROS-E12-T010

### E15-TC-066 — Auth and injection on E15 APIs
- **Source:** Basic security (QA scope)
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Call each E15 route unauthenticated, with other tenant's token (IDOR), with NoSQL/script injection in tip, number, notes, webhook body.
- **Expected:** 401/403/400; no cross-tenant data; no injection effect; stored XSS escaped in WA/receipt.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T034, ROS-E01-T003, ROS-E01-T005

### E15-TC-067 — Cross-tenant webhook routing
- **Source:** Order 1 isolation
- **Config:** Org X vs Org Y
- **Preconditions:** Two orgs, sandbox merchants
- **Steps:** 1. Send org Y-signed event referencing org X request.
- **Expected:** Rejected; no change in X.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T023, ROS-E15-T026

### E15-TC-068 — Device offline: no transition to Paid
- **Source:** AC-5.3; UX §10
- **Config:** A
- **Preconditions:** POS/captain offline
- **Steps:** 1. Go offline mid-payment. 2. Try mark paid / create UPI request. 3. Record cash. 4. Reconnect.
- **Expected:** UPI actions disabled; no Paid; cash 'queued'; on reconnect status reconciles from server.
- **Priority:** P1
- **Covering build task(s):** ROS-E15-T035, ROS-E15-T044

### E15-TC-069 — Printing: bill/receipt print with versions and tip line
- **Source:** Regression/printing (brief silent: assumption)
- **Config:** A,B
- **Preconditions:** Printer/connector in staging
- **Steps:** 1. Print running bill, final bill, receipt with and without tip.
- **Expected:** Printed values = server bill version; tip line only if tipped; superseded version marked. ASSUMPTION — no E15 requirement.
- **Priority:** P3
- **Covering build task(s):** GAP (no E15 print task; ROS-E11 hardware)

### E15-TC-070 — Captain + POS share one payment logic
- **Source:** Order 1; T039
- **Config:** B
- **Preconditions:** —
- **Steps:** 1. Same scenario on captain & POS.
- **Expected:** Identical amounts/states; single component.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T039, ROS-E15-T040, ROS-E15-T041

### E15-TC-071 — Captain status follows verified webhook via polling
- **Source:** AC-2.3
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Pay; watch captain.
- **Expected:** 'Paid · verified' after poll; table status follows.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T040

### E15-TC-072 — Order/bill/request/collection/verification/receipt kept separate
- **Source:** Order 2
- **Config:** B
- **Preconditions:** —
- **Steps:** 1. Inspect data for one order through lifecycle.
- **Expected:** Separate records with audit history.
- **Priority:** P2
- **Covering build task(s):** ROS-E15-T030

### E15-TC-073 — Mobile vs desktop primary action
- **Source:** AC-1b.7
- **Config:** A
- **Preconditions:** —
- **Steps:** 1. Open page at 375 and 1280 px.
- **Expected:** Mobile: 'Pay with UPI app' primary, QR behind 'Show QR'; desktop QR primary.
- **Priority:** P3
- **Covering build task(s):** ROS-E15-T036

### E15-TC-074 — Regression: POS order/bill/existing cash & card payments
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** pro-max/release build
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E03-T001, ROS-E13-T005

### E15-TC-075 — Regression: Captain ordering, table management, bill view
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** pro-max/release build
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E05, ROS-E13-T005

### E15-TC-076 — Regression: QR (public) ordering incl. variants & idempotency
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** pro-max/release build
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E02-T002, ROS-E02-T003

### E15-TC-077 — Regression: KDS/KOT flow for pay-before and pay-after orders
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** pro-max/release build
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E02-T006, ROS-E05

### E15-TC-078 — Regression: Existing payment adapter & ledger (non-UPI), cancellations, line cancel
- **Source:** Part H regression run
- **Config:** A,B,C + one outlet with E15 disabled
- **Preconditions:** pro-max/release build
- **Steps:** 1. Run existing E2E/regression suite. 2. Manual smoke of core flows with E15 OFF and ON.
- **Expected:** No behaviour change for outlets with E15 disabled; existing totals equal pre-change baseline.
- **Priority:** P1
- **Covering build task(s):** ROS-E02-T001, ROS-E04-T007

## 9. Traceability matrix

### 9a. Part H tests 1–20 (configs A/B/C)
| Part H # | Test | Test case(s) | Covering build task(s) | Gap? |
|---|---|---|---|---|
| 1 | Bill at order placement | TC-001, TC-022 | T030, T024 | — |
| 2 | Bill after meal | TC-002, TC-021 | T030 | — |
| 3 | Running bill updated | TC-003 | T030, T031, T024 | — |
| 4 | Customer requests final bill | TC-004 | T030, T031 | Partial: no task names the customer "request bill" surface |
| 5 | Tip disabled → no UI | TC-005, TC-026 | T037, T032 | — |
| 6 | Tip enabled → optional UI | TC-006 | T037, T036 | — |
| 7 | No-tip | TC-007 | T037, T032 | — |
| 8 | Fixed tip | TC-008 | T037, T024, T032 | — |
| 9 | Percentage tip | TC-009 | T037, T032, T020 | — |
| 10 | Custom tip | TC-010 | T037, T032 | — |
| 11 | Exact dynamic QR amount | TC-011, TC-027–031, TC-051 | T025, T024 | — |
| 12 | Bill changes after QR | TC-012, TC-003 | T024, T027, T007 | — |
| 13 | Partial payment | TC-013, TC-053, TC-055 | T028, T027, T033 | — |
| 14 | Full payment | TC-014 | T026, T027 | — |
| 15 | Duplicate webhook | TC-015, TC-049 | T026 | — |
| 16 | Cross-outlet isolation | TC-016, TC-067 | T023, T042 | — |
| 17 | Correct receipt | TC-017 | T036, T033 | Partial: printed receipt not covered (TC-069) |
| 18 | Correct ledger | TC-018 | T027 | — |
| 19 | Tip separate in reports | TC-019 | T032 (data) | **GAP: no build task for tip report/export UI** |
| 20 | Captain cannot bypass | TC-020, TC-056 | T039, T029, ROS-E04-T005 | Partial: server-side denial for settle/cash-close/resolve has no explicit E15 AC (only refund in T029) |
| Regression | POS, Captain, QR, KDS, payments | TC-074–078 | ROS-E03/E05/E02/E04-T007, ROS-E13-T005 | No E15 task owns regression |

### 9b. Order 1 §9 failure cases
| §9 item | Test case(s) | Covering task(s) | Gap? |
|---|---|---|---|
| WhatsApp unavailable | TC-039 | T035, T038 | — |
| Invalid customer number | TC-040 | T033, T035 | Partial: no explicit AC |
| Template rejected | TC-041 | T033 | Partial: no explicit AC |
| QR generation fails | TC-042 | T035 | — |
| Provider unavailable | TC-043 | T035 | — |
| Payment expires | TC-034 | T027, T036, T044 | — |
| Webhook delayed | TC-044 | T026, T036 | — |
| Webhook duplicated | TC-015 | T026 | — |
| Incorrect amount | TC-033 | T026, T027, T041, T007 | — |
| Partial payment | TC-013 | T028 | — |
| Full payment | TC-014 | T026, T027 | — |
| Refund | TC-035 | T029 | — |
| Customer pays twice | TC-045 | T026, T044, T007 | — |
| Bill changes after QR | TC-012 | T024, T027 | — |
| Merchant disconnected | TC-046 | T035, T042 | — |

### 9c. §11 demo tests (amounts ₹1/20/149/520/1250)
| §11 test | Test case(s) | Task(s) |
|---|---|---|
| Bill generation | TC-001, TC-002, TC-027–031 | T030 |
| Dynamic QR generation | TC-011, TC-027–031 | T025 |
| Exact expected amount | TC-011, TC-051 | T024, T025 |
| WhatsApp message generation | TC-038 | T033, T031 |
| Payment success | TC-014, TC-027–031 | T026, T027 |
| Payment failure | TC-032 | T027 |
| Partial payment | TC-013 | T028 |
| Duplicate webhook | TC-015 | T026 |
| Wrong amount | TC-033 | T026 |
| Expired QR | TC-034 | T027 |
| Refund | TC-035 | T029 |
| Multi-outlet isolation | TC-016, TC-067 | T023 |
| Customer consent | TC-036, TC-037 | T033, T034 |
| Receipt generation | TC-017 | T036, T033 |

### 9d. UX_SPEC acceptance criteria
AC-1.1/1.2 → TC-038 · AC-1.3 → TC-003 · AC-1.4 → TC-036 · AC-1b.1 → TC-011 · AC-1b.2 → TC-005 · AC-1b.3 → TC-006 · AC-1b.4 → TC-008 · AC-1b.5 → TC-044 · AC-1b.6 → TC-034 · AC-1b.7 → TC-073 · AC-2.1 → TC-070 · AC-2.2 → TC-020 · AC-2.3 → TC-071 · AC-2.4 → TC-013 · AC-2.5 → TC-039 · AC-3.1 → TC-070 · AC-3.2 → TC-053 · AC-3.3 → TC-056 · AC-3.4 → TC-057 · AC-3.5 → TC-058 · AC-3.6 → TC-033 · AC-3.7 → TC-054 · AC-4.1 → TC-060 · AC-4.2 → TC-059 · AC-4.3 → TC-016 · AC-4.4 → TC-061 · AC-4.5 → TC-062 · AC-4b.1 → TC-025 · AC-4b.2 → TC-021/022 · AC-4b.3 → TC-026 · AC-4b.4 → TC-024 · AC-4b.5 → TC-023 · AC-5.1 → TC-012/034 · AC-5.2 → TC-045 · AC-5.3 → TC-068 · AC-5.4 → TC-039.

### 9e. Items with NO (or only partial) covering build task
1. **Tip reporting UI/export** (Part H #19) — T032 stores tip separately; no task builds the report. T014/T019 are docs only.
2. **WhatsApp opt-out** (TC-037) — T033/T034 cover consent records only; no opt-out/withdrawal behaviour.
3. **Printing** of running/final bill and receipt with versions and tip line (TC-069) — no E15 task; brief silent.
4. **Server-side enforcement for captain settle / cash-close / resolve-review** (Part H #20) — T039 hides UI; only refund (T029) has a server AC. Relies on ROS-E04-T005 (Backlog/deferred?).
5. **Webhook replay window** (TC-049) and **concurrent payments on one bill** (TC-050) — not explicit ACs in T026/T028.
6. **Invalid number / template rejected** (TC-040/041) — no explicit AC in T033/T035.
7. **Customer "request bill" surface** (Part H #4) — no task names it.
8. **Regression ownership** — no E15 task; relies on ROS-E13-T005.

### 9f. Ambiguities / contradictions found
1. Board T009 note and board Open question 9 say the 20 tests / Part H are missing — but the Founder order **Appendix now contains them**. Board note is stale.
2. **Partial payments:** Founder Order 1 describes the 200 + 300 flow as standard; CEO default D2 sets partials OFF by default, and V25 sends partials-OFF underpayment to MANUAL_REVIEW. Part H config for B doesn't state partials. Plan assumes B partials ON only for partial cases.
3. **Kitchen release under PAY_BEFORE_PREPARATION:** "Kitchen release is a separate policy and is not forced" — expected KDS behaviour for Restaurant A when unpaid is undefined.
4. **Restaurant C mapping** of order types → policy is not given.
5. **"Superseded"** is used in brief/UX but is not one of the 9 statuses (Q6).
6. **WhatsApp itemized bill + QR** required by Order 1 vs CEO default summary + link (template limits, Q3).
7. **"Fixed tip"** — fixed amount suggestion vs fixed config not defined; Restaurant B config lists only % + custom, so test #8 has no defined fixed amount for B.
8. **Tip % base and rounding** (D6) and tax effects on ₹ amounts are CEO defaults pending Founder; calculator outputs (GST) are TBD from Backend, so expected totals for ₹1/20/149/520/1250 can't be pre-filled.
9. **Exact-amount enforcement** depends on provider (T001 pending); wrong-amount tests may be unrunnable if the sandbox can't pay a different amount.

## CTO-requested additions (QA to own)

These cases are not executed. QA owns them. Each result needs the evidence in §6. A design note in an ADR is not a pass.

- **Signatures, replay, and secret rotation.** Send a payment webhook and a WhatsApp delivery webhook with a valid signature, a missing signature, a bad signature, a replay of the same event ID, and a secret from the previous rotation. Expected: only the valid, unreplayed event is accepted. Replay is a no-op. The old secret is rejected after the overlap ends. Neither webhook marks a bill paid by itself.
- **Verification with both secrets during rotation.** While rotation is in progress, send one webhook signed with the current secret and one signed with the previous secret. Expected: both verify. A third secret is rejected. After the overlap, only the current secret verifies.
- **Alert when the webhook is disabled.** Simulate Razorpay disabling the webhook after 24 hours of failed retries. Expected: an alert is raised. The bill is not marked paid because the webhook stopped.
- **Reconciliation poll catching a missed event.** Leave a captured payment with no webhook, then run the periodic status-API poll. Expected: the poll records that payment once. A second poll does not add a second ledger row.
- **FAILED to PAID.** Record a provider failure, then a later provider confirmation of the same payment. Expected: the payment moves from FAILED to PAID, one paid receipt is created, and the amount is not doubled. A later failure does not move PAID back to FAILED.
- **Credential protection.** Confirm merchant and WABA secrets are absent from the browser, from logs, and from the receipt. Expected: stored values are encrypted, and a cross-outlet read returns neither secret.
- **Tenant isolation, including a shared-organisation WABA with outlet overrides.** Two outlets share one organisation WABA, and one outlet has its own number override. Expected: sends, consent, and webhooks are keyed by organisation and outlet. Outlet A cannot see outlet B's recipient or message.
- **Late payment on a SUPERSEDED request.** Change the bill version, then pay the old request. Expected: the payment goes to MANUAL_REVIEW and does not settle the new bill.
- **New bill version with the same total.** Replace the bill with a new version whose total equals the old total, then pay the old request. Expected: equal totals do not settle the new version. The old request stays SUPERSEDED and the money goes to review.
- **Only one active request at a time.** Create two requests for the same order together. Expected: one request is ACTIVE. The other is rejected or superseded.
- **Concurrency between request creation and balance updates.** Create a request while a cancel or append commits. Expected: the request matches the committed balance and bill version, or it is not issued.
- **Duplicate payment and refund IDs.** Deliver the same provider payment ID twice, and the same refund ID twice. Expected: one ledger collection and one refund. The permanent unique index rejects the second row.
- **Race between polling and the webhook.** Poll status and deliver the webhook together. Expected: one ledger effect and one receipt intent.
- **Crash recovery.** Stop the worker after the webhook is stored and before the ledger commit, then retry. Expected: the retry completes one money effect and does not double the amount paid.
- **Reconciliation of a missed webhook.** Leave a captured payment with no webhook, then run reconciliation. Expected: the status API supplies the payment once, and the bill is not marked paid before that check.
- **WhatsApp consent revoked at send time.** Queue a bill, then receive STOP, UNSUBSCRIBE, or OPT OUT before dispatch. Expected: the send is suppressed. START re-subscribes that billing purpose only.
- **WhatsApp send dedupe.** Retry the same bill version and recipient. Expected: one initial send. A second job does not send a second initial bill.
- **WhatsApp sends whose outcome is UNKNOWN.** Time out after the provider may have accepted the send. Expected: the state is UNKNOWN. The worker does not blindly send again before reconciliation.
- **Stale WhatsApp messages.** Queue a bill, then supersede it before send. Expected: the stale message is not sent.
- **Tip refund and allocation.** Pay a bill with a tip, then refund the tip only, the base only, and both. Expected: each component moves by the refunded amount once, and the report matches the ledger.
- **Tip rounding to the rupee.** Compute 5 percent of a base that ends in paise. Expected: half-up to the rupee, from the post-discount, pre-tax subtotal.
- **Configurable tip cap.** Submit a custom tip above the configured cap, using the 25 percent default once. Expected: the server rejects the excess. The cap change applies to the next bill.
- **Turning tips off affects new bills only.** Turn tips off after a bill already has a confirmed tip. Expected: that historical tip stays. The next bill has no tip step and no tip line.

## 10. Open questions
| # | Question | Owner |
|---|---|---|
| QA-1 | Restaurant C order-type → policy mapping? | PD / Founder |
| QA-2 | Partials ON or OFF for B (and test #13 config)? | PD / Founder (D2) |
| QA-3 | Kitchen release behaviour for A when unpaid? | PD / Founder |
| QA-4 | Fixed tip amount(s) for B (test #8)? | PD / Finance |
| QA-5 | Custom tip max cap? | Finance / PD |
| QA-6 | Provider minimum amount (₹1 demo) and whether sandbox can pay a wrong amount / simulate failure, expiry, refund? | CTO (T001) |
| QA-7 | WhatsApp opt-out mechanism and required behaviour? | CTO (T002) |
| QA-8 | Webhook replay window / timestamp tolerance? | CTO (T012) |
| QA-9 | Is printing in scope for E15? | PD |
| QA-10 | Who builds tip reporting UI? | PD |
| QA-11 | Rate-limit thresholds (board OQ6), polling interval (Q12), customer self-regenerate (Q11), Superseded status (Q6), manual-review roles (Q10) | CTO / PD |
| QA-12 | Evidence storage path and staging URL | DevOps / CTO |

## 11. Execution mapping and blockers
| QA task | Status | Test cases | Blockers |
|---|---|---|---|
| ROS-E15-T009 (this plan) | Draft → In Review | — | Answers to §10 |
| ROS-E15-T015 WHATSAPP_PAYMENT_E2E_REPORT | Blocked | TC-011–018, 027–052, 059–068 | EXT: merchant sandbox keys, WhatsApp test number; T022–T029, T033–T036 built |
| ROS-E15-T021 BILLING_POLICY_E2E_REPORT | Backlog | TC-001–010, 019, 021–026, 053–058, 070, 072 | Depends on T046; T030–T032, T037, T043 built; every policy shown in actual app |
| ROS-E15-T045 Demo + restaurants A/B/C | Blocked | TC-027–031 (+ §11 set: 001, 011, 013–017, 032–036, 038) | ROS-E13-T001 seed; sandbox keys; WhatsApp test number |
| ROS-E15-T046 Execute all | Blocked | All TC-001–078 | T009 accepted, T045, T006 Design QA, sandbox keys, test number |
Global blocker: **no E15 build starts until Wave 1 merges into `pro-max/release`** (board OQ1: branch did not exist yet). No live payments before T047 + Founder approval.
