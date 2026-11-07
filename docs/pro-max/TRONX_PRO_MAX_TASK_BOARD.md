# TRONX PRO MAX Task Board – Restaurant OS (ROS) — v2

Sources: audit PR https://github.com/Videsh999/tronxvideomenu/pull/1 (branch `pro-max/audit`): `docs/pro-max/TRONX_PRO_MAX_MODULE_INVENTORY.md`, `TRONX_PRO_MAX_FINDINGS.md`, `TRONX_PRO_MAX_ARCHITECTURE.md` (CTO-revised), `PATH_OWNERS.md`. E15 from `whatsapp-payments/FOUNDER_ORDER_2026-11-07.md` and `whatsapp-payments/UX_SPEC.md`. v2 by TRONX Project Director, 2026-11-07. Previous version: `TRONX_PRO_MAX_TASK_BOARD.md.v1.bak`. A task is done only when TRONX QA ENGINEER marks it **Verified**. `EXT:` dependencies are external inputs, not tasks.

## Epic → workstream mapping

| Epic | Workstream | Name | Tasks |
|---|---|---|---|
| ROS-E00 | Wave 0 | Validation contracts + ADRs | 6 |
| ROS-E01 | A | Authz matrix | 6 |
| ROS-E02 | B | Order aggregate | 11 |
| ROS-E03 | C | Bill UI | 4 |
| ROS-E04 | D | Identities | 11 |
| ROS-E05 | E | Floor UI (captain, kitchen, tables, reservations) | 4 |
| ROS-E06 | F | Menu and catalog | 1 |
| ROS-E07 | G | Customer menu and loyalty UX | 5 |
| ROS-E08 | H | Schema steward | 4 |
| ROS-E09 | I1–I5 | Inventory, procurement, CRM, multi-outlet, reports (separate queues) | 1 |
| ROS-E10 | J | AI | 1 |
| ROS-E11 | K | Hardware | 2 |
| ROS-E12 | L | DevOps | 14 |
| ROS-E13 | M | Demo and QA | 7 |
| ROS-E14 | N | UI shell | 1 |
| ROS-E15 | O | WhatsApp Billing + Dynamic UPI + Billing Policies + Tips | 47 |

**Status counts:** In Progress 35, Backlog 61, Ready 20, Blocked 8 (total 124)

## Summary

| ID | Title | Owner | Status | Reviewer |
|---|---|---|---|---|
| ROS-E00-T001 | Wave 0 validation contracts: split lib/validations/index.ts into domain modules | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T001 | Explicit anonymous allow-list for the six loyalty handlers (no blanket customer class) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T002 | Connector edge contracts: pair = pairing-code claim; heartbeat/jobs/ack = connector secret | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T003 | Route-enumeration authz test covering every app/api/**/route.ts method (173 handlers) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T004 | Edge: stop classifying POST /api/dev/seed-demo-kitchen as `public` (A half of seed lockdown) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T001 | Line cancel uses B's snapshot-safe bill function and writes every money field together | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T002 | QR (public) orders accept and price variants like POS | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T003 | Public QR idempotency returns the existing order instead of bare 409 | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T004 | Rate limit on POST /api/public/orders | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T005 | Allocate order numbers atomically with the insert; remove 1001 fallback | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T006 | Surface KOT print failures instead of swallowing them | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T001 | POS terminal preview uses calculateRestaurantBill | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T002 | Captain order pad preview uses calculateRestaurantBill | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T003 | Screen half of UI-vs-server bill parity matrix | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T001 | Fix stale captain credential test double (touchLastActiveAt) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T002 | Remove legacy demo credential literals (seed + verify script); rotation assessment | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T003 | Remove recoverable staff passwords or gate behind an audited reveal with reason | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T004 | Staff memberships: many managers / cashiers / kitchen per outlet | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T005 | Cashier/manager role for cash shift and refunds | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T006 | Login limiter: fail closed, trusted client IP, constant-time secret compare | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T007 | PaymentAdapter interface with mock implementation (no live gateway) | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T008 | Identity UI: membership and credential screens | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T001 | TablesManager labels/styles for BILL_REQUESTED, PAYMENT_PENDING, CLEANING (tsc clean) | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO (diff also reviewed by owning C/E/F lead in the Wave 1 PR) |
| ROS-E05-T002 | Table admin API/schema accepts full floor status enum | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T003 | Resolve dead captain branch of GET /api/kitchen/orders | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T004 | Floor UI regression: captain approval and KDS still compile and work | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E06-T001 | Replace or isolate xlsx@0.18.5 for untrusted workbook parsing | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E07-T001 | Customer menu variant selection UI | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T002 | Loyalty pages work end-to-end once proxy allows them | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T003 | Correct marketing copy that claims instant/real-time kitchen | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T004 | Wi-Fi reveal rate limit | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T001 | Membership collection schema and indexes | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T002 | Reservation timezone not hard-locked to Asia/Kolkata | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T003 | Require Mongo replica set; fail startup if transaction probe fails | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E09-T001 | Inventory/procurement/CRM/org-reports regression guard | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E10-T001 | AI safety invariants preserved | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E11-T001 | Connector handlers and client work with new connector class | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T001 | GitHub Actions PR workflow: lint, typecheck, unit tests | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T002 | CI integration job on Mongo replica-set service container | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T003 | Remove typescript.ignoreBuildErrors once tsc is clean | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T004 | Production env template listing required names without values | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T005 | Fix lint errors (15 errors) so lint gate can pass | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO (diff also reviewed by owning C/E/F lead in the Wave 1 PR) |
| ROS-E12-T006 | CI npm audit and secret scan | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T007 | Remove hardcoded dev LAN origin | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T008 | Assess next@16.3.6 critical and zod/source-map-js high advisories | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T001 | scripts/seed-pro-max-demo.ts (Phase A, loopback only) | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T002 | scripts/cleanup-pro-max-demo.ts | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T003 | Demo seed Phase B: 2 managers, 2 cashiers, 3 kitchen users | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T004 | QA demo acceptance run | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T005 | Playwright E2E against localhost | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T006 | API tests incl. IDOR and connector-secret checks on local replica set | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T007 | 100-user load and concurrency run with mock payment adapter | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E14-T001 | UI shell invariants and sidebar-link process | TRONX UI UX DESIGNER | Backlog | TRONX CTO |
| ROS-E00-T002 | ADR 0001: Tenancy (proposed → CTO accepts) | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E00-T003 | ADR 0002: Identity (proposed → CTO accepts) | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E00-T004 | ADR 0003: Billing snapshots (proposed → CTO accepts) | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E00-T005 | ADR 0004: Transaction requirements (proposed → CTO accepts) | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E00-T006 | ADR 0005: Polling (proposed → CTO accepts) | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E01-T005 | IDOR / tenant-boundary matrix test | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T006 | Origin/CSRF check spec for cookie-authenticated mutations | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T007 | Append keeps frozen line prices/GST rates; settings frozen in billSnapshot | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T008 | replaceItemsAndTotals compare-and-swap on version/updatedAt (lost updates) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T009 | Cancel idempotency marker commits in the same transaction as the money write | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T010 | Server half of UI-vs-server bill parity matrix | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T011 | Correlation id on order events and payment ledger entries | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E03-T004 | Integrate E→C handoff of captain billing callers (take-order, bills) | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T009 | Lock down seed route handler POST /api/dev/seed-demo-kitchen | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T010 | Credential rotation and reset policy | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T011 | Trim public restaurant payload (billing, organizationId, subscription, feature overrides) | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T005 | Rate limit on loyalty login, register and reset | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T004 | Schema-change protocol: schemaVersion, idempotent backfill, staged indexes, rollback, restore note | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E11-T002 | Deliver KOT failure alerts and retries; correlation id on print jobs | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T009 | Land xlsx replacement in root package.json/package-lock.json (F's dependency request) | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T010 | Structured redacted JSON logger | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T011 | Request/correlation id at the edge | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T012 | Backup/restore drill on a synthetic database copy | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T013 | Shared rate-limit store | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T014 | Payment-recording retry and concurrency gate | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E15-T001 | Provider capability verification and architecture/provider approval | TRONX CTO | Ready | Founder (via CEO) |
| ROS-E15-T002 | India payment requirements and WhatsApp policy/template review (pre-production) | TRONX CTO | Ready | Founder (via CEO) |
| ROS-E15-T003 | Payment & tip UX spec (UX_SPEC.md) – finalize, replace TBD-PD tags, resolve §15 | TRONX UI UX DESIGNER | In Progress | TRONX CTO |
| ROS-E15-T004 | Design tokens + shared status chip (icon+label) and TEST band design | TRONX UI UX DESIGNER | Ready | TRONX CTO |
| ROS-E15-T005 | Accessibility & localisation audit (contrast, screen reader, 200% zoom, Hindi with Noto UI) | TRONX UI UX DESIGNER | Backlog | TRONX CTO |
| ROS-E15-T006 | Design QA on preview build before QA hand-off | TRONX UI UX DESIGNER | Backlog | TRONX CTO |
| ROS-E15-T007 | Reconciliation workflow: late/superseded requests, wrong amount, partial, double pay, manual review | TRONX FINANCE MANAGER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T008 | Tip tax treatment, receipt presentation and customer tip wording | TRONX FINANCE MANAGER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T009 | QA test plan: Order 1 failure list, Order 2 '20 listed tests', UX_SPEC AC-1…AC-5, regression | TRONX QA ENGINEER | Ready | TRONX CTO |
| ROS-E15-T010 | Doc: WHATSAPP_BILLING_ARCHITECTURE.md | TRONX CTO | Ready | Founder (via CEO) |
| ROS-E15-T011 | Doc: DYNAMIC_UPI_QR_IMPLEMENTATION.md | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E15-T012 | Doc: PAYMENT_WEBHOOK_SECURITY.md | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E15-T013 | Doc: WHATSAPP_TEMPLATE_GUIDE.md | TRONX BACKEND ENGINEER | Ready | TRONX CTO |
| ROS-E15-T014 | Doc: PAYMENT_RECONCILIATION_REPORT.md | TRONX FINANCE MANAGER | Blocked | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T015 | Doc: WHATSAPP_PAYMENT_E2E_REPORT.md | TRONX QA ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T016 | Doc: RESTAURANT_BILLING_POLICIES.md | TRONX FINANCE MANAGER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T017 | Doc: BILL_GENERATION_WORKFLOW.md | TRONX FINANCE MANAGER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T018 | Doc: CUSTOMER_TIP_CONFIGURATION.md | TRONX UI UX DESIGNER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T019 | Doc: TIP_ACCOUNTING_AND_RECONCILIATION.md | TRONX FINANCE MANAGER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T020 | Doc: DYNAMIC_PAYMENT_AMOUNT_RULES.md | TRONX BACKEND ENGINEER | Ready | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T021 | Doc: BILLING_POLICY_E2E_REPORT.md | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T022 | Payment provider abstraction (extends PaymentAdapter) | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T023 | Per-outlet merchant mapping + encrypted write-only secrets | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T024 | Payment request model bound to org/outlet/order/bill version; supersede on change | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T025 | Dynamic exact-amount QR / payment link per request | TRONX BACKEND ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T026 | Signature-verified webhook + authenticated status check (idempotent) | TRONX BACKEND ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T027 | Ledger integration and 9-status payment state machine | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T028 | Partial payments with remainder request; overpay guard | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T029 | Provider refunds, role-gated | TRONX BACKEND ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T030 | Billing policy engine + bill timing (PAY_BEFORE_PREPARATION, PAY_AFTER_MEAL, FLEXIBLE) | TRONX BACKEND ENGINEER | Backlog | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T031 | Bill versioning: finalized-only send, new version on item add, no duplicate per version | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T032 | Tip records separate from food revenue; ENABLE_CUSTOMER_TIPS default OFF | TRONX BACKEND ENGINEER | Backlog | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T033 | WhatsApp Cloud API integration: templates, send, status, delivery logs, consent | TRONX BACKEND ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T034 | Payment security: rate limits, consent records, phone protection, no secrets in browser/logs | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T035 | Failure handling and fallbacks (WA down, QR fail, provider down, merchant disconnected, offline) | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T036 | Customer payment web page (Screen 1b) incl. tip step, receipt, expired/checking states | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T037 | Tips UI component (conditionally imported) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T038 | Staff WhatsApp send/resend controls + delivery status (Screen 1) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T039 | Shared PaymentPanel logic for captain + POS (role props, no duplication) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T040 | Captain bill / QR / status / remaining (Screen 2) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T041 | POS payment panel (Screen 3) incl. manual-review resolution | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T042 | Admin › Settings › Payments & WhatsApp (Screen 4) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T043 | Settings › Billing & Payments › Billing Preferences (Screen 4b) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO + TRONX FINANCE MANAGER |
| ROS-E15-T044 | Payment state catalogue on all surfaces (Screen 5) | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E15-T045 | TRONX WHATSAPP PAYMENT DEMO + test restaurants A/B/C (sandbox only) | TRONX QA ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T046 | Execute all scenarios (failure list, 20 tests, UX ACs, regression) | TRONX QA ENGINEER | Blocked | TRONX CTO |
| ROS-E15-T047 | Production readiness gate: no live payments before onboarding + production credentials + Founder approval | TRONX CTO | Backlog | Founder (via CEO) |

## CEO decisions (2026-11-07)

1. **Wave 0 first:** ROS-E00-T001 is In Progress. It merges first, per the CTO's merge order, into the integration branch `pro-max/release`, before the Wave 2 streams. ROS-E02-T002 keeps its dependency on it.
2. **D Wave 1 = F-16 + F-06:** ROS-E04-T001 and ROS-E04-T002 (the credential literals plus `scripts/verify-demo-reupload-import.mjs` / `scripts/seed-tronx-demo-kitchen.ts`). The seed-route handler lockdown is added as ROS-E04-T009 (In Progress). The edge half stays ROS-E01-T004. Memberships (ROS-E04-T004) are deferred to Backlog.
3. **Legacy seed ownership:** D owns `lib/demo/seed-demo-kitchen.ts` and only removes the credential literals in Wave 1. M never edits that file, `lib/demo/**`, the legacy seed route, or the credential verification script. M builds `scripts/seed-pro-max-demo.ts` only.
4. **Wave 1 typecheck/lint:** fixes are made serially by one implementer (TRONX FRONTEND ENGINEER: ROS-E05-T001, then ROS-E12-T005). The owning C/E/F lead reviews the diff in the Wave 1 PR. From Wave 2 on, `docs/pro-max/PATH_OWNERS.md` governs.
5. **F-20 payment adapter (ROS-E04-T007):** status note "Founder decision pending".
6. **Client, deadline, budget:** stay TBD. The CEO is taking them to the Founder.

## CTO review mapping (`pro-max/audit`: revised `TRONX_PRO_MAX_ARCHITECTURE.md`, `TRONX_PRO_MAX_FINDINGS.md`, new `PATH_OWNERS.md`)

- **Merge order:**
  1. Wave 0 (ROS-E00-T001)
  2. H schema (ROS-E08-T001/T004)
  3. B billing contract (ROS-E02-T001/T007/T008/T009), then C (ROS-E03-*)
  4. A before K/G acceptance (ROS-E11-T001, ROS-E07-T002)
  5. D + H before M full-role QA (ROS-E13-T003)
  6. L final gates last (ROS-E12-T003)
- **Ownership manifest:** task file lists were updated to the manifest. Stream I is now I1–I5 (ROS-E09). C now owns POS shifts. D owns the seed route, `lib/demo/**`, `app/api/restaurants/**` and `restaurant-normalize`. H owns `mongo-tx`, `mongodb` and the barrels. L owns the root manifests, so the xlsx change is ROS-E12-T009.
- **Per-handler authz contracts** (no blanket customer class; pair vs secret): ROS-E01-T001/T002/T003, ROS-E11-T001.
- **Money integrity** (snapshot-safe append, CAS lost updates, crash-retry marker, the three required tests): ROS-E02-T001, T007, T008, T009 and T010.
- **Security/ops deliverables:**
  - IDOR: ROS-E01-T005
  - CSRF: ROS-E01-T006
  - Rate limits: ROS-E02-T004, ROS-E07-T004/T005, ROS-E11-T001, ROS-E12-T013
  - Fail-closed limiter: ROS-E04-T006
  - Credential rotation: ROS-E04-T010
  - Logs: ROS-E12-T010
  - Correlation ids: ROS-E12-T011, ROS-E02-T011, ROS-E11-T002
  - KOT alerts: ROS-E02-T006, ROS-E11-T002
  - Backup/RPO/RTO drill: ROS-E12-T012
- **Schema-change protocol:** ROS-E08-T004.
- **ADRs 0001–0005:** ROS-E00-T002 to T006.
- **Not mapped or partly mapped:** see Open questions 2, 3, 4 and 5.

## UX_SPEC TBD-PD acceptance-criteria mapping

| TBD-PD criterion (summary) | Spec section | Task ID(s) |
|---|---|---|
| AC-1.1 Send disabled until bill finalized ('Finalize bill first') | §4 Screen 1 | ROS-E15-T031, ROS-E15-T038 |
| AC-1b.2 Tips OFF → no tip element in DOM, no receipt tip line | §5 Screen 1b | ROS-E15-T037 |
| AC-3.2 Amount above remaining → 'Max ₹300', no request created | §7 Screen 3 | ROS-E15-T041, ROS-E15-T028 |
| AC-4.2 Saved secret shown only as masked last-4 in UI and API | §8 Screen 4 | ROS-E15-T023, ROS-E15-T042 |
| AC-4b.1 New outlet has tips OFF | §9 Screen 4b | ROS-E15-T032, ROS-E15-T043 |
| AC-5.1 Late payment on superseded/expired request → Manual review, never Paid | §10 Screen 5 | ROS-E15-T027, ROS-E15-T044 |

Other spec ACs already tagged with existing IDs (ROS-E04-T007, E03-T001/T002, E04-T005, E08-T003) also map to the E15 Frontend tasks named in their acceptance criteria.

## Open questions

1. **Branch `pro-max/release`** now exists, created from `main` at `fcc89586190e2dd40673c7cb04f6baa358dd7969` (`fcc8958`). Implementation PRs target it.
2. **ADR authors — pending CTO confirmation.** Proposed author for `docs/adr/0001` through `docs/adr/0005` is TRONX BACKEND ENGINEER. ADR 0005 covers KOT failure alerts and retries. No KOT ADR was numbered 0006, so none was moved to 0012. ADR files 0006–0011 were not in the attachments and were not added.
3. **Paths — pending CTO confirmation** except the legacy admin pages, which are already assigned. Logger: L, `lib/observability/logger.ts`. Request id: L proposes `lib/observability/request-id.ts`; A lands the `proxy.ts` patch. Rate-limit store: L, `lib/rate-limit/store.ts`. Backup drill: L, `docs/ops/BACKUP_RESTORE_DRILL.md`. `PRODUCTION_DEPLOYMENT_CHECKLIST.md`: L. Legacy `app/admin/menu/**`, `media/**`, and `availability/**`: F. Profile pages and `RestaurantProfileForm.tsx`: FROZEN. API-test folder for ROS-E13-T006 remains unnamed.
4. **Stream O** is now a PATH_OWNERS.md section. Backend owns `lib/payments/**`, `lib/whatsapp/**`, `app/api/payments/**`, and `app/api/webhooks/**`. Frontend owns the payment and WhatsApp settings UI and the captain and POS payment UI. B's billing contract stays with B. Pending CTO confirmation of those proposed paths.
5. **RPO 15 min / RTO 1 h** are stated in the audit as drill-design targets, not measurements. The board records them only as targets. — CTO
6. **Rate-limit thresholds** (public order, Wi-Fi, loyalty, pairing, payment) are not specified. — CTO
7. **Product decisions not specified by the audit:** password recovery removed vs audited reveal (F-06), non-Kolkata reservation timezones (F-18), replacement marketing copy (F-19). — Founder via CEO
8. **Payment gateway/provider:** Founder decision pending (ROS-E04-T007, ROS-E15-T001). This also covers UX_SPEC §15 Q2 on which capabilities are guaranteed. — Founder, then CTO verifies
9. **Founder brief:** the 20 listed tests and the WhatsApp demo cases are in `docs/whatsapp-payments/FOUNDER_BRIEF.md`. Product questions that the brief does not decide stay in items 14–23.
10. **TRONX FINANCE MANAGER** is a new owner bot not in the original owner list. Confirm it exists. It is also the reviewer on CTO/Finance-pair tasks. — PD/CEO
11. **Reviewer for CTO-owned E15 tasks** is set to "Founder (via CEO)". Confirm. — CEO
12. **Local vs repo copies:** `pro-max/audit` now has `docs/pro-max/TRONX_PRO_MAX_MASTER_PLAN.md` and `TRONX_PRO_MAX_TASK_BOARD.md` committed. This local v2 diverges from them. — CEO (single source)
13. **Deadlines, budget, client:** TBD – needs Founder approval via CEO.

UX_SPEC §15 questions not answered by the Founder brief:

14. Template constraints: can a variable-length itemized list fit an approved template, or summary + link/PDF? Can the QR be a media header? Which BSP or Cloud API? (Q3) — CTO
15. Policy precedence is recorded: order override, then table or session, then channel or order type, then outlet, then organization, then default. Kitchen release is a separate policy. (Q4)
16. Can the public payment page show the itemized bill (privacy review)? (Q5) — PD with CTO security review
17. Is "superseded" its own status or CANCELLED with a reason? The brief's 9 statuses don't include it. (Q6) — CTO
18. Customer-facing tip wording and tip % base (pre- or post-tax) (Q7), tip tax and receipt presentation (Q8). The brief only says "no assumed tax treatment". — Finance; Founder for wording
19. Captain-device tip entry for guests without phones? (Q9) — PD (product), Founder if policy
20. Which roles edit vs view Payments settings, and who resolves Manual review (depends on ROS-E04-T005)? (Q10) — PD with CTO
21. Can customers regenerate an expired link themselves, or only staff? (Q11) — PD
22. Status polling interval (no SSE; ADR 0005 polling). (Q12) — CTO
23. Brand assets and launch languages. (Q13) — Founder via CEO

UX_SPEC §15 Q1 (task IDs / which epic) is resolved: new Epic ROS-E15 (Stream O), mapped above. Q2 is covered by item 8.


## Task details


### ROS-E00 — Wave 0: Validation contracts + ADRs

#### ROS-E00-T001 — Wave 0 validation contracts: split lib/validations/index.ts into domain modules

- **Source:** ARCHITECTURE Wave 0 (rev. CTO review); PATH_OWNERS.md 'Validation modules after Wave 0'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Merge first (CTO merge order step 1) into integration branch pro-max/release, before every other stream. Contracts for orders, loyalty, pairing and billing inputs land here.
- **Dependencies:** —
- **Affected files:** `lib/validations/index.ts`, `lib/validations/auth.ts`, `lib/validations/orders.ts`, `lib/validations/billing.ts`, `lib/validations/captain.ts`, `lib/validations/tables.ts`, `lib/validations/reservations.ts`, `lib/validations/catalog.ts`, `lib/validations/loyalty.ts`, `lib/validations/inventory.ts`, `lib/validations/procurement.ts`, `lib/validations/crm.ts`, `lib/validations/organization.ts`, `lib/validations/devices.ts`
- **Acceptance criteria:**
  - [ ] `lib/validations/index.ts` only re-exports from domain modules
  - [ ] No feature/behaviour change: `npm test` result unchanged vs baseline (209 pass; the 1 known F-16 failure aside)
  - [ ] `npm run typecheck` introduces no new errors
  - [ ] Domain modules exist as listed in PATH_OWNERS.md; each module's post-merge owner is recorded (auth→D, orders/billing→B, captain/tables/reservations→E, catalog→F, loyalty→G, inventory→I1, procurement→I2, crm→I3, organization→I4, devices→K)
  - [ ] After merge `lib/validations/index.ts` is stewarded by H and only re-exports
  - [ ] Merged into pro-max/release before any Wave 2 stream PR
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: In Progress, goes first per CTO merge order.


### ROS-E01 — A: Authz matrix

#### ROS-E01-T001 — Explicit anonymous allow-list for the six loyalty handlers (no blanket customer class)

- **Source:** F-01 (rev.); ARCHITECTURE 'Intended handler contracts'; Stream A
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Make the edge match the per-handler contracts: login/register/forgot/reset anonymous; logout and GET /me pass without a staff cookie and the handler decides.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] Login, register, forgot-password and reset-password reachable with no customer cookie and no staff cookie
  - [ ] The proxy must not require an existing customer session for login, register, or reset. A test fails if it does
  - [ ] Logout and GET /api/public/loyalty/me reachable with no staff cookie; `me` returns `data: null` without a customer cookie
  - [ ] No proxy class requires a customer session for every loyalty path
  - [ ] Existing captain-vs-admin proxy tests still pass
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T002 — Connector edge contracts: pair = pairing-code claim; heartbeat/jobs/ack = connector secret

- **Source:** F-01 (rev.); ARCHITECTURE 'Intended handler contracts'; Stream A
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Let both connector contracts through the proxy without folding pairing into the secret rule.
- **Dependencies:** —
- **Affected files:** `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] POST /api/connector/pair reachable with a pairing code and without a connector secret or staff cookie
  - [ ] Heartbeat, GET jobs and ack reach `requireConnectorAuth` without a staff cookie
  - [ ] Pairing rejects a connector secret presented as a code; heartbeat/poll/ack reject a staff cookie used alone
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T003 — Route-enumeration authz test covering every app/api/**/route.ts method (173 handlers)

- **Source:** Stream A; Test strategy (unit + security); target architecture #2
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Prevent any new route silently falling through to `staff`.
- **Dependencies:** —
- **Affected files:** `tests/api-proxy-authz.test.ts`, `lib/api-authz.ts`
- **Acceptance criteria:**
  - [ ] Test enumerates every method in every app/api/**/route.ts and asserts an explicit expected class
  - [ ] Adding an unlisted route makes the test fail
  - [ ] Test passes in `npm test`
  - [ ] Test also asserts the ten 'Intended handler contracts'
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T004 — Edge: stop classifying POST /api/dev/seed-demo-kitchen as `public` (A half of seed lockdown)

- **Source:** F-07
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop anonymous callers upserting the demo restaurant when NODE_ENV is not production or ALLOW_PRODUCTION_SEED=true without a token.
- **Dependencies:** ROS-E04-T009
- **Affected files:** `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] `classifyApiRequest` no longer returns `public` for POST /api/dev/seed-demo-kitchen
  - [ ] Anonymous POST to the route is rejected at the proxy in a unit test
  - [ ] Enumeration test (ROS-E01-T003) records the new class
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Seed route is a separate seed contract owned by D (ARCHITECTURE). A changes only lib/api-authz.ts; handler lockdown is ROS-E04-T009.


### ROS-E02 — B: Order aggregate

#### ROS-E02-T001 — Line cancel uses B's snapshot-safe bill function and writes every money field together

- **Source:** F-02 (rev.); ARCHITECTURE 'Money integrity'; Stream B
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Remove the second bill formula from cancel so GST split, packaging, service charge and billSnapshot stay consistent with total.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `lib/order-pricing.ts`, `lib/billing/`, `tests/order-pricing.test.ts`
- **Acceptance criteria:**
  - [ ] Line cancel (lib/services/order.service.ts:1530-1550) calls `calculateRestaurantBill`, not `computeBillTotals`
  - [ ] Cancel persists cgstAmount, sgstAmount, igstAmount, packagingCharge, serviceCharge and billSnapshot together with total
  - [ ] New unit test: after a partial cancel, stored CGST, SGST, IGST, packaging and total equal `calculateRestaurantBill` for the remaining lines
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T002 — QR (public) orders accept and price variants like POS

- **Source:** F-04 (server side); Stream B
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Let the public order path carry variantId and price the selected variant instead of dish.price.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/validations/orders.ts`, `lib/services/order.service.ts`, `app/api/public/orders/route.ts`
- **Acceptance criteria:**
  - [ ] `placeOrderSchema` accepts a variantId
  - [ ] createPublic prices the chosen variant (not `dish.price`) and snapshots it
  - [ ] A dish that has variants is rejected without a variant, matching POS/captain (order.service.ts:355-365, 678-688)
  - [ ] Unit test with the Half/Full demo shape passes
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Customer UI half is ROS-E07-T001.

#### ROS-E02-T003 — Public QR idempotency returns the existing order instead of bare 409

- **Source:** F-12; Stream B
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Make a double-tap on QR look like success, matching POS behaviour.
- **Dependencies:** —
- **Affected files:** `lib/services/order.service.ts`, `app/api/public/orders/route.ts`
- **Acceptance criteria:**
  - [ ] Repeat POST /api/public/orders with the same idempotency key returns the original order (not 409 'already submitted')
  - [ ] Still exactly one order document per {restaurantId, idempotencyKey}
  - [ ] Unit test covers duplicate-key (11000) path
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T004 — Rate limit on POST /api/public/orders

- **Source:** F-12; Test strategy (security)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Add the missing rate limit to anonymous order creation.
- **Dependencies:** —
- **Affected files:** `app/api/public/orders/route.ts`
- **Acceptance criteria:**
  - [ ] Looped requests beyond the limit receive 429 in a test
  - [ ] Normal single-guest ordering unaffected
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit specifies 429 but no threshold – open question. Spec owner A; path owner B lands it (PATH_OWNERS queued patches).

#### ROS-E02-T005 — Allocate order numbers atomically with the insert; remove 1001 fallback

- **Source:** F-11
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Prevent the null-counter fallback colliding with an existing order number.
- **Dependencies:** —
- **Affected files:** `lib/repositories/order.repository.ts`
- **Acceptance criteria:**
  - [ ] When the counter update returns null, code does not fall back to 1001
  - [ ] Counter increment and order insert are not able to produce a duplicate-number insert failure in a unit test
  - [ ] Behaviour on failed insert is documented (gap acceptable per audit, duplicate not)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T006 — Surface KOT print failures instead of swallowing them

- **Source:** F-15
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Ensure an accepted order without a KOT is visible and no unhandled rejection occurs.
- **Dependencies:** —
- **Affected files:** `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] `appendItemsToOrder` print side effect (order.service.ts:805) cannot produce an unhandled rejection (test with a throwing import)
  - [ ] Device errors in KOT enqueue (order.service.ts:1295-1325) are returned/recorded, not only logged as a warning
  - [ ] Order acceptance behaviour on print failure is covered by a unit test
  - [ ] A failed/missing KOT after accept or append raises an outlet-visible alert; retries use existing print-job attempt counter and dedupe key; order API still succeeds
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** B enqueues, K delivers (ROS-E11-T002). Alert target is chosen 'in the ADR' (which ADR not named).


### ROS-E03 — C: Bill UI

#### ROS-E03-T001 — POS terminal preview uses calculateRestaurantBill

- **Source:** F-03; Stream C
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make the amount the cashier sees equal what the server stores.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009
- **Affected files:** `components/admin/PosTerminal.tsx`, `app/admin/[slug]/pos/page.tsx`
- **Acceptance criteria:**
  - [ ] PosTerminal no longer imports `computeBillTotals` or a single `taxRatePercent`
  - [ ] On-screen total equals `calculateRestaurantBill` for packaging, service charge, inclusive mode, mixed dish rates and IGST
  - [ ] Includes app/admin/[slug]/pos/page.tsx
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Starts only after B's billing contract is merged (CTO merge order step 3). C does not edit lib/billing/**, lib/order-pricing.ts or order.service.ts.

#### ROS-E03-T002 — Captain order pad preview uses calculateRestaurantBill

- **Source:** F-03; Stream C
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make the captain's bill preview match the server.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009
- **Affected files:** `components/captain/CaptainOrderPad.tsx`
- **Acceptance criteria:**
  - [ ] CaptainOrderPad no longer imports `computeBillTotals`
  - [ ] On-screen total equals `calculateRestaurantBill` for packaging, service charge, inclusive mode and IGST
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Starts only after B's billing contract is merged (CTO merge order step 3). C does not edit lib/billing/**, lib/order-pricing.ts or order.service.ts.

#### ROS-E03-T003 — Screen half of UI-vs-server bill parity matrix

- **Source:** Stream C acceptance
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Lock in parity between UI helper and server helper.
- **Dependencies:** ROS-E03-T001, ROS-E03-T002, ROS-E02-T010
- **Affected files:** `components/admin/PosTerminal.tsx`, `components/captain/CaptainOrderPad.tsx`
- **Acceptance criteria:**
  - [ ] A unit test feeds the same lines to the screen helper and to `calculateRestaurantBill` and asserts equal totals and tax split
  - [ ] Covers packaging, service charge, inclusive and IGST cases
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** tests/billing-calculator.test.ts is B's (server half ROS-E02-T010); C's test file location not named in audit.


### ROS-E04 — D: Identities

#### ROS-E04-T001 — Fix stale captain credential test double (touchLastActiveAt)

- **Source:** F-16; Stream D
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Make the only failing unit test pass and actually reach the reset-password login assertion.
- **Dependencies:** —
- **Affected files:** `tests/captain-credential-access.test.ts`, `lib/services/captain.service.ts`, `lib/repositories/captain.repository.ts`
- **Acceptance criteria:**
  - [ ] Test double implements `touchLastActiveAt`
  - [ ] `tests/captain-credential-access.test.ts` passes and its 'reset password can log in' assertion executes
  - [ ] `npm test` reports 0 failures
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: Wave 1 D = F-16 + F-06.

#### ROS-E04-T002 — Remove legacy demo credential literals (seed + verify script); rotation assessment

- **Source:** F-06 (demo literals); Stream D
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop demo login literals in git becoming real credentials on shared databases.
- **Dependencies:** —
- **Affected files:** `lib/demo/seed-demo-kitchen.ts`, `scripts/seed-tronx-demo-kitchen.ts`, `scripts/verify-demo-reupload-import.mjs`
- **Acceptance criteria:**
  - [ ] `DEMO_KITCHEN.adminPassword` is not a string literal in git; value comes from an env var
  - [ ] `scripts/verify-demo-reupload-import.mjs` has no password literal
  - [ ] Seed fails clearly if the env var is missing and never prints it
  - [ ] Rotation assessment recorded for any database where the old seed ran (L's gate, D lands)
  - [ ] Wave 1 change to lib/demo/seed-demo-kitchen.ts is limited to removing the literal
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: D owns lib/demo/seed-demo-kitchen.ts and only removes the credential literals in Wave 1; covers the 'credential script' item. M must not touch that file until this merges.

#### ROS-E04-T003 — Remove recoverable staff passwords or gate behind an audited reveal with reason

- **Source:** F-06 (reversible passwords); Stream D
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop a stolen CREDENTIALS_ENCRYPTION_KEY + DB dump yielding live staff passwords.
- **Dependencies:** ROS-E08-T001
- **Affected files:** `lib/services/captain.service.ts`, `lib/security/`, `app/api/admin/captains/`, `lib/db/models.ts`
- **Acceptance criteria:**
  - [ ] Either passwordCiphertext/Iv/AuthTag are no longer stored for captains and restaurant admins, or reveal requires an explicit reason and writes an audit record
  - [ ] Test proves a restaurant-admin session cannot silently recover a captain password
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Product choice (remove vs audited reveal) needs decision.

#### ROS-E04-T004 — Staff memberships: many managers / cashiers / kitchen per outlet

- **Source:** F-09; Stream D; target architecture #5
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Replace one-admin-per-outlet with memberships so a real floor team can be represented.
- **Dependencies:** ROS-E08-T001, ROS-E08-T004
- **Affected files:** `lib/auth-core.ts`, `lib/auth-server.ts`, `lib/services/restaurant-admin.service.ts`, `lib/repositories/restaurant-admin.repository.ts`, `app/api/auth/`, `tests/restaurant-admin-auth.test.ts`
- **Acceptance criteria:**
  - [ ] Two managers can exist for one outlet (test)
  - [ ] Cashier and kitchen roles have their own sessions and smaller permission sets
  - [ ] Captains remain a floor role with table assignments
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: memberships deferred (Backlog). D's membership consumers merge only after H's compatible schema/index change.

#### ROS-E04-T005 — Cashier/manager role for cash shift and refunds

- **Source:** F-09; F-20; target architecture #6
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Let a cash-office role open/close shifts and refund without a full admin cookie.
- **Dependencies:** ROS-E04-T004, ROS-E01-T003
- **Affected files:** `lib/services/pos-shift.service.ts`, `app/api/pos/shifts/route.ts`, `app/api/pos/orders/[orderId]/refund/route.ts`
- **Acceptance criteria:**
  - [ ] Cashier session can open/close /api/pos/shifts and refund; captain cannot
  - [ ] Proxy class and handler guard agree (enumeration test updated)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Files app/api/pos/shifts/**, lib/services/pos-shift.service.ts are C's per PATH_OWNERS; refund route is B's (app/api/pos/orders/**). Changes are queued patches to those owners.

#### ROS-E04-T006 — Login limiter: fail closed, trusted client IP, constant-time secret compare

- **Source:** F-13; Test strategy (security)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Harden admin/super-admin login rate limiting and secret comparison.
- **Dependencies:** ROS-E12-T013
- **Affected files:** `lib/security/login-rate-limiter.ts`, `app/api/auth/login/route.ts`
- **Acceptance criteria:**
  - [ ] Limiter fails closed when its store is down (replaces lib/security/login-rate-limiter.ts:40-44)
  - [ ] Client key not taken blindly from first x-forwarded-for hop
  - [ ] `matchesSecret` does not return early on length mismatch; super-admin compare is constant-time
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Spec owner A; D lands (PATH_OWNERS). Shared limiter store is L (ROS-E12-T013).

#### ROS-E04-T007 — PaymentAdapter interface with mock implementation (no live gateway)

- **Source:** F-20; target architecture #6
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Introduce a payment seam; recorded tenders remain for cash.
- **Dependencies:** ROS-E04-T005
- **Affected files:** `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] `PaymentAdapter` interface exists with a mock used in tests
  - [ ] No live gateway called from demo or tests
  - [ ] Refunds and cash close route through adapter + shift
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Status note: Founder decision pending. No workstream owns this in the audit; placed under D. Feeds E15 provider abstraction.

#### ROS-E04-T008 — Identity UI: membership and credential screens

- **Source:** Stream D (UI by Frontend)
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Frontend screens for memberships and credential changes.
- **Dependencies:** ROS-E04-T004, ROS-E04-T003
- **Affected files:** `components/super-admin/`, `components/auth/`, `components/admin/CaptainManagement.tsx`
- **Acceptance criteria:**
  - [ ] Screens create/list multiple memberships per outlet
  - [ ] No password value is displayed without the audited reveal flow
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E05 — E: Floor UI (captain, kitchen, tables, reservations)

#### ROS-E05-T001 — TablesManager labels/styles for BILL_REQUESTED, PAYMENT_PENDING, CLEANING (tsc clean)

- **Source:** F-05 (tsc errors); Stream E acceptance; typecheck item
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Fix the two TS2739 errors and missing runtime labels.
- **Dependencies:** —
- **Affected files:** `components/admin/TablesManager.tsx`
- **Acceptance criteria:**
  - [ ] `npm run typecheck` reports no errors in components/admin/TablesManager.tsx (lines 22-23)
  - [ ] All model table statuses (lib/db/models.ts:285-289) render a label and style
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO (diff also reviewed by owning C/E/F lead in the Wave 1 PR)
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: Wave 1 typecheck/lint fixes are made serially by one implementer (TRONX FRONTEND ENGINEER); owning lead reviews the diff in the Wave 1 PR. From Wave 2 on PATH_OWNERS.md governs.

#### ROS-E05-T002 — Table admin API/schema accepts full floor status enum

- **Source:** F-17
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Bring create/update table schemas in line with the order-flow enum.
- **Dependencies:** ROS-E00-T001, ROS-E05-T001
- **Affected files:** `lib/validations/tables.ts`, `app/api/tables/`
- **Acceptance criteria:**
  - [ ] createTableSchema/updateTableSchema accept BILL_REQUESTED, PAYMENT_PENDING, CLEANING
  - [ ] Unit test for each status
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E05-T003 — Resolve dead captain branch of GET /api/kitchen/orders

- **Source:** F-01 (kitchen)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Either remove the unreachable captain branch or classify the route so it is reachable.
- **Dependencies:** ROS-E01-T003
- **Affected files:** `app/api/kitchen/orders/route.ts`
- **Acceptance criteria:**
  - [ ] Proxy class and handler agree for GET /api/kitchen/orders (enumeration test)
  - [ ] Captain kitchen UI continues using /api/captain/kitchen
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E05-T004 — Floor UI regression: captain approval and KDS still compile and work

- **Source:** Stream E acceptance
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Keep captain approvals and KDS intact while floor UI changes land.
- **Dependencies:** ROS-E05-T001
- **Affected files:** `app/captain/`, `components/captain/`, `components/kitchen/`, `components/admin/KitchenDisplay.tsx`
- **Acceptance criteria:**
  - [ ] `tsc` clean for Stream E files
  - [ ] No edits to lib/services/order.service.ts
  - [ ] QA cases (written by QA per Stream E) pass
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E06 — F: Menu and catalog

#### ROS-E06-T001 — Replace or isolate xlsx@0.18.5 for untrusted workbook parsing

- **Source:** F-08; Stream F; xlsx item
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop the vulnerable parser handling uploaded workbooks on the server.
- **Dependencies:** ROS-E12-T009
- **Affected files:** `lib/menu-import/`, `lib/menu-export/`, `tests/menu-import.test.ts`, `tests/menu-export.test.ts`
- **Acceptance criteria:**
  - [ ] Uploaded workbooks are not parsed by xlsx@0.18.5
  - [ ] `npm audit` no longer reports the xlsx high advisories (or the parser is isolated, documented)
  - [ ] tests/menu-import.test.ts and tests/menu-export.test.ts pass
  - [ ] Malformed-workbook and import/export compatibility tests added (L's gate, F lands)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** F files a dependency request; L lands the package change (ROS-E12-T009).


### ROS-E07 — G: Customer menu and loyalty UX

#### ROS-E07-T001 — Customer menu variant selection UI

- **Source:** F-04 (UI); Stream G
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Let QR guests choose a variant (e.g. Half/Full).
- **Dependencies:** ROS-E02-T002
- **Affected files:** `components/customer/`
- **Acceptance criteria:**
  - [ ] Customer components submit a variantId
  - [ ] Guest choosing Half is charged the Half price (stored total check)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E07-T002 — Loyalty pages work end-to-end once proxy allows them

- **Source:** F-01; Stream G
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make guest register/login/reset/me work through existing handlers.
- **Dependencies:** ROS-E01-T001
- **Affected files:** `components/customer/CustomerLoyaltyPanel.tsx`, `app/menu/[slug]/loyalty/reset/page.tsx`, `app/api/public/loyalty/`, `lib/customer-auth.ts`
- **Acceptance criteria:**
  - [ ] Guest with no staff cookie can register, log in, reset password and read /me
  - [ ] No edits to proxy.ts in this stream
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Loyalty acceptance merges only after A (merge order step 4).

#### ROS-E07-T003 — Correct marketing copy that claims instant/real-time kitchen

- **Source:** F-19; Stream G
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Align home page copy with polling + captain approval.
- **Dependencies:** —
- **Affected files:** `app/page.tsx`
- **Acceptance criteria:**
  - [ ] app/page.tsx no longer says orders flow to the kitchen instantly or that guests see updates in real time
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Replacement wording needs Founder/CEO sign-off.

#### ROS-E07-T004 — Wi-Fi reveal rate limit

- **Source:** F-14; Test strategy (security)
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Limit slug-only Wi-Fi password retrieval and stop exposing billing/subscription fields on the public menu.
- **Dependencies:** ROS-E12-T013
- **Affected files:** `app/api/public/restaurants/[slug]/wifi/route.ts`
- **Acceptance criteria:**
  - [ ] Loop test on GET /api/public/restaurants/[slug]/wifi receives 429
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Spec owner A; path owner G lands (PATH_OWNERS). Payload trimming moved to ROS-E04-T011 (D owns those paths).


### ROS-E08 — H: Schema steward

#### ROS-E08-T001 — Membership collection schema and indexes

- **Source:** F-09; Stream H
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Schema support for multiple staff memberships per outlet.
- **Dependencies:** ROS-E00-T001, ROS-E08-T004
- **Affected files:** `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`
- **Acceptance criteria:**
  - [ ] New membership collection with indexes; unique-per-restaurantId admin constraint (models.ts:627) no longer blocks multiple managers
  - [ ] No second source of truth for money fields
  - [ ] Short note of each new collection
  - [ ] Merges before D's membership consumers (merge order step 2)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E08-T002 — Reservation timezone not hard-locked to Asia/Kolkata

- **Source:** F-18
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Allow other reservation timezones.
- **Dependencies:** ROS-E08-T004
- **Affected files:** `lib/db/models.ts`
- **Acceptance criteria:**
  - [ ] Reservation timezone enum (models.ts:643) accepts more than Asia/Kolkata, or decision to keep is documented
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Whether other timezones are in scope is a product question.

#### ROS-E08-T003 — Require Mongo replica set; fail startup if transaction probe fails

- **Source:** F-10; target architecture #8
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop withOptionalTransaction silently dropping transactional guarantees on standalone Mongo.
- **Dependencies:** —
- **Affected files:** `lib/db/mongo-tx.ts`, `lib/db/mongodb.ts`
- **Acceptance criteria:**
  - [ ] Startup fails in deployed environments when a transaction probe fails
  - [ ] Payments, stock and coupon redemption never use the non-transactional path in deployed environments
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** lib/db/mongo-tx.ts is in no stream's file list.


### ROS-E09 — I1–I5: Inventory, procurement, CRM, multi-outlet, reports (separate queues)

#### ROS-E09-T001 — Inventory/procurement/CRM/org-reports regression guard

- **Source:** Stream I acceptance
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Keep each subfolder's tests and idempotency guarantees intact while other streams change.
- **Dependencies:** —
- **Affected files:** `lib/inventory/`, `app/api/procurement/`, `lib/crm/`, `lib/org-rbac.ts`, `tests/org-rbac.test.ts`, `tests/multi-outlet-boundaries.test.ts`, `tests/financial-reconciliation.test.ts`, `tests/analytics-sales.test.ts`, `tests/loyalty-coupons.test.ts`, `tests/recipe-cost.test.ts`
- **Acceptance criteria:**
  - [ ] All current unit tests in these subfolders pass
  - [ ] Stock transfer and coupon redemption keep idempotency keys
  - [ ] No change to order create
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Stream I is now I1–I5 with separate Backend owners and queues (PATH_OWNERS). I1 owns tests/integration/mongo-concurrency.test.ts; coupon/loyalty cases are a queued patch from I3, purchase-receipt cases from I2.


### ROS-E10 — J: AI

#### ROS-E10-T001 — AI safety invariants preserved

- **Source:** Stream J acceptance
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Keep AI module safe while other work lands.
- **Dependencies:** —
- **Affected files:** `lib/ai/`, `app/api/ai/`, `components/admin/ai/`
- **Acceptance criteria:**
  - [ ] Heuristic mode still refuses unknown tools
  - [ ] No provider call in unit tests
  - [ ] Outlet id comes from the session, not the model; tests/ai-*.ts pass
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E11 — K: Hardware

#### ROS-E11-T001 — Connector handlers and client work with new connector class

- **Source:** F-01 (connector); Stream K
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Restore cloud-to-Windows printing once the proxy lets connectors through.
- **Dependencies:** ROS-E01-T002, ROS-E12-T013
- **Affected files:** `app/api/connector/`, `lib/connector-auth.ts`, `device-connector/`, `tests/connector-pairing.test.ts`
- **Acceptance criteria:**
  - [ ] Connector can pair, heartbeat, poll jobs and ack with no staff cookie
  - [ ] Handlers still require the connector secret
  - [ ] device-connector tests pass (8/8 baseline); USB stays labeled unsupported
  - [ ] Pair acceptance = pairing-code contract; heartbeat/poll/ack = secret contract
  - [ ] Rate limit on pairing-code claims (A spec, K lands)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E12 — L: DevOps

#### ROS-E12-T001 — GitHub Actions PR workflow: lint, typecheck, unit tests

- **Source:** F-10; Stream L; target architecture #9
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Create the first CI gate.
- **Dependencies:** —
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] A pull_request workflow runs `npm run lint`, `tsc --noEmit` and `npm test`
  - [ ] Workflow fails the PR when any step fails
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T002 — CI integration job on Mongo replica-set service container

- **Source:** F-10; Stream L; Test strategy
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Actually execute the skipped concurrency suite (coupon, loyalty, stock, print lease).
- **Dependencies:** ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] Job starts a replica-set service container and sets RUN_INTEGRATION=1 and MONGODB_URI
  - [ ] 8 integration tests execute (not skipped) and results are recorded
  - [ ] CI fails if integration tests are skipped
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** tests/integration/mongo-concurrency.test.ts is I1's and print-job-lease is K's; L changes only .github/**.

#### ROS-E12-T003 — Remove typescript.ignoreBuildErrors once tsc is clean

- **Source:** F-05; Stream L
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Make typecheck a deploy gate again.
- **Dependencies:** ROS-E05-T001, ROS-E02-T001, ROS-E02-T002, ROS-E00-T001, ROS-E01-T003, ROS-E02-T008, ROS-E03-T001, ROS-E12-T005
- **Affected files:** `next.config.ts`, `tsconfig.json`
- **Acceptance criteria:**
  - [ ] `next.config.ts` no longer sets ignoreBuildErrors: true
  - [ ] `npm run build` no longer prints 'Skipping validation of types' and exits 0
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Merge-order step 6: required-gate + ignoreBuildErrors removal commit merges last on the release branch.

#### ROS-E12-T004 — Production env template listing required names without values

- **Source:** Stream L acceptance
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Document required env names for deploy.
- **Dependencies:** —
- **Affected files:** `.env.example`
- **Acceptance criteria:**
  - [ ] Template lists MONGODB_URI, AUTH_SECRET, CREDENTIALS_ENCRYPTION_KEY, WIFI_ENCRYPTION_KEY, Cloudinary and super-admin names etc.
  - [ ] Contains no values
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** PRODUCTION_DEPLOYMENT_CHECKLIST.md is not in any PATH_OWNERS section.

#### ROS-E12-T005 — Fix lint errors (15 errors) so lint gate can pass

- **Source:** F-21; lint item
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make `npm run lint` exit 0.
- **Dependencies:** ROS-E05-T001
- **Affected files:** `components/admin/MenuImportWizard.tsx`, `app/captain/[slug]/page.tsx`, `components/captain/CaptainApprovals.tsx`, `components/captain/CaptainOrderPad.tsx`
- **Acceptance criteria:**
  - [ ] `npm run lint` exits 0 with 0 errors
  - [ ] No Date.now() during render in the three cited captain files
  - [ ] No @next/next/no-html-link-for-pages error at MenuImportWizard.tsx:299
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO (diff also reviewed by owning C/E/F lead in the Wave 1 PR)
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: same single implementer as ROS-E05-T001, done serially after it; C/E/F lead reviews their files' diff in the Wave 1 PR. eslint.config.mjs is L's file – any config change is a queued patch to L.

#### ROS-E12-T006 — CI npm audit and secret scan

- **Source:** Test strategy (security); target architecture #9
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Fail CI on credentialed mongodb+srv:// strings and private-key blocks.
- **Dependencies:** ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] CI runs `npm audit`
  - [ ] Secret scan fails on mongodb+srv:// with credentials and on private-key blocks
  - [ ] No env values printed in logs
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T007 — Remove hardcoded dev LAN origin

- **Source:** F-22
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Stop allowedDevOrigins being one developer's LAN IP.
- **Dependencies:** —
- **Affected files:** `next.config.ts`
- **Acceptance criteria:**
  - [ ] `next.config.ts` no longer hardcodes 192.168.46.190 (configurable or removed)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T008 — Assess next@16.3.6 critical and zod/source-map-js high advisories

- **Source:** F-08 (other advisories)
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Upgrade or document non-reachability of remaining advisories.
- **Dependencies:** —
- **Affected files:** `package.json`
- **Acceptance criteria:**
  - [ ] Decision recorded per advisory; if upgraded, `npm test` and `npm run build` pass
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit says the next critical is not confirmed reachable; not assigned to any stream.


### ROS-E13 — M: Demo and QA

#### ROS-E13-T001 — scripts/seed-pro-max-demo.ts (Phase A, loopback only)

- **Source:** Stream M; Demo plan
- **Owner:** TRONX QA ENGINEER
- **Objective:** Build the TRONX PRO MAX DEMO RESTAURANT seed with today's roles.
- **Dependencies:** ROS-E12-T002, ROS-E04-T002
- **Affected files:** `scripts/seed-pro-max-demo.ts`, `fixtures/pro-max/`
- **Acceptance criteria:**
  - [ ] Refuses unless MONGODB_URI contains localhost/127.0.0.1 and when NODE_ENV=production; ignores ALLOW_PRODUCTION_SEED
  - [ ] Passwords from env (e.g. PRO_MAX_DEMO_ADMIN_PASSWORD), fail if missing, never printed
  - [ ] All ids prefixed `pro-max-demo-`
  - [ ] 1 org + 1 ENTERPRISE outlet, INR, GST intra-state, non-zero packaging & service charge, loyalty on
  - [ ] 50 OPEN tables; 100+ dishes with variants/add-ons/SKUs/stations/5% & 12% overrides
  - [ ] Ingredients, recipes, 2 suppliers, 2 POs (1 received,1 open), 3 coupons (percent, fixed, expired)
  - [ ] 10 captains per audit assignment rules incl. one with payment permission off
  - [ ] One closed historical shift, no open shift
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** DevOps supplies the database (Stream M). CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T002 — scripts/cleanup-pro-max-demo.ts

- **Source:** Stream M; Demo plan
- **Owner:** TRONX QA ENGINEER
- **Objective:** Exact cleanup of demo data.
- **Dependencies:** ROS-E13-T001, ROS-E04-T002
- **Affected files:** `scripts/cleanup-pro-max-demo.ts`
- **Acceptance criteria:**
  - [ ] Same loopback refusal
  - [ ] Deletes only by `pro-max-demo-` prefix and demo restaurantId (incl. orders, print jobs, loyalty rows)
  - [ ] Refuses any other outlet id
  - [ ] --dry-run prints counts only
  - [ ] After cleanup zero `pro-max-demo-` documents
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T003 — Demo seed Phase B: 2 managers, 2 cashiers, 3 kitchen users

- **Source:** Demo plan Phase B; F-09
- **Owner:** TRONX QA ENGINEER
- **Objective:** Create floor-team users once memberships exist.
- **Dependencies:** ROS-E04-T004, ROS-E08-T001, ROS-E13-T001, ROS-E04-T002
- **Affected files:** `scripts/seed-pro-max-demo.ts`
- **Acceptance criteria:**
  - [ ] Creates users when membership collection exists; otherwise skips with printed reason
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T004 — QA demo acceptance run

- **Source:** Demo plan QA acceptance
- **Owner:** TRONX QA ENGINEER
- **Objective:** Verify core floor flows on the demo outlet.
- **Dependencies:** ROS-E13-T001, ROS-E02-T001, ROS-E03-T002, ROS-E04-T002
- **Affected files:** `scripts/seed-pro-max-demo.ts`
- **Acceptance criteria:**
  - [ ] Captain with no guest phone places order on assigned table; second assigned table visible; unassigned table rejected
  - [ ] QR order waits in approvals until captain approves; kitchen poll shows it after
  - [ ] Stored total matches calculateRestaurantBill
  - [ ] Cleanup leaves zero demo docs
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T005 — Playwright E2E against localhost

- **Source:** Stream M; Test strategy (E2E)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Browser coverage of key flows (none exists today).
- **Dependencies:** ROS-E13-T001, ROS-E04-T002
- **Affected files:** `tests/e2e/`
- **Acceptance criteria:**
  - [ ] Covers guest QR, captain multi-table order without phone, POS cash close, kitchen column move
  - [ ] Points only at localhost (never tronxvideomenu.vercel.app)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T006 — API tests incl. IDOR and connector-secret checks on local replica set

- **Source:** Test strategy (API, security)
- **Owner:** TRONX QA ENGINEER
- **Objective:** API-level verification of money and tenancy paths.
- **Dependencies:** ROS-E13-T001, ROS-E01-T002, ROS-E04-T002, ROS-E01-T005
- **Affected files:** `tests/e2e/`
- **Acceptance criteria:**
  - [ ] Hits public order, captain approve, POS pay, refund, coupon redeem
  - [ ] Restaurant A cookie reading B's order, dish, customer returns 403
  - [ ] /api/connector/* without secret rejected
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name a folder for API tests; tests/e2e/ assumed – open question. CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.

#### ROS-E13-T007 — 100-user load and concurrency run with mock payment adapter

- **Source:** Test strategy (concurrency and load)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Measure, don't invent, concurrency correctness and p95 poll latency.
- **Dependencies:** ROS-E13-T001, ROS-E04-T007, ROS-E12-T002, ROS-E04-T002, ROS-E02-T009
- **Affected files:** `scripts/load-benchmark-menu.mjs`
- **Acceptance criteria:**
  - [ ] Zero duplicate orders per idempotency key; zero negative stock; zero coupon redemptions above maxRedemptions
  - [ ] p95 of poll endpoints recorded from the actual run
  - [ ] Zero double cancels on retry
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit says to add a load script; file name not specified. CEO decision 2026-11-07: M builds the new demo seed separately and does not touch lib/demo/seed-demo-kitchen.ts until D's change (ROS-E04-T002) has merged. New npm deps go to L.


### ROS-E14 — N: UI shell

#### ROS-E14-T001 — UI shell invariants and sidebar-link process

- **Source:** Stream N
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Own shell layout; other streams request links rather than editing the sidebar.
- **Dependencies:** —
- **Affected files:** `app/globals.css`, `components/shared/`, `components/admin/AdminShell.tsx`, `components/admin/AdminSidebar.tsx`, `components/admin/AdminHeader.tsx`, `lib/admin-layout.ts`, `components/admin/AdminModal.tsx`, `lib/theme.ts`
- **Acceptance criteria:**
  - [ ] POS and kitchen stay full-width (isImmersiveOpsPath)
  - [ ] Mobile nav still closes
  - [ ] No feature logic moves into the shell
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Owner UI/UX; implemented by TRONX FRONTEND ENGINEER (Stream N).


### ROS-E00 — Wave 0: Validation contracts + ADRs

#### ROS-E00-T002 — ADR 0001: Tenancy (proposed → CTO accepts)

- **Source:** ARCHITECTURE 'ADR plan'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Write the proposed ADR for tenancy; not accepted until the CTO marks it accepted.
- **Dependencies:** —
- **Affected files:** `docs/adr/0001-tenancy.md`
- **Acceptance criteria:**
  - [ ] `docs/adr/0001-tenancy.md` exists with status Proposed
  - [ ] CTO marks it Accepted (recorded in the file)
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name the ADR author; Backend assigned provisionally (open question).

#### ROS-E00-T003 — ADR 0002: Identity (proposed → CTO accepts)

- **Source:** ARCHITECTURE 'ADR plan'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Write the proposed ADR for identity; not accepted until the CTO marks it accepted.
- **Dependencies:** —
- **Affected files:** `docs/adr/0002-identity.md`
- **Acceptance criteria:**
  - [ ] `docs/adr/0002-identity.md` exists with status Proposed
  - [ ] CTO marks it Accepted (recorded in the file)
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name the ADR author; Backend assigned provisionally (open question).

#### ROS-E00-T004 — ADR 0003: Billing snapshots (proposed → CTO accepts)

- **Source:** ARCHITECTURE 'ADR plan'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Write the proposed ADR for billing snapshots; not accepted until the CTO marks it accepted.
- **Dependencies:** —
- **Affected files:** `docs/adr/0003-billing-snapshots.md`
- **Acceptance criteria:**
  - [ ] `docs/adr/0003-billing-snapshots.md` exists with status Proposed
  - [ ] CTO marks it Accepted (recorded in the file)
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name the ADR author; Backend assigned provisionally (open question).

#### ROS-E00-T005 — ADR 0004: Transaction requirements (proposed → CTO accepts)

- **Source:** ARCHITECTURE 'ADR plan'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Write the proposed ADR for transaction requirements; not accepted until the CTO marks it accepted.
- **Dependencies:** —
- **Affected files:** `docs/adr/0004-transaction-requirements.md`
- **Acceptance criteria:**
  - [ ] `docs/adr/0004-transaction-requirements.md` exists with status Proposed
  - [ ] CTO marks it Accepted (recorded in the file)
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name the ADR author; Backend assigned provisionally (open question).

#### ROS-E00-T006 — ADR 0005: Polling (proposed → CTO accepts)

- **Source:** ARCHITECTURE 'ADR plan'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Write the proposed ADR for polling; not accepted until the CTO marks it accepted.
- **Dependencies:** —
- **Affected files:** `docs/adr/0005-polling.md`
- **Acceptance criteria:**
  - [ ] `docs/adr/0005-polling.md` exists with status Proposed
  - [ ] CTO marks it Accepted (recorded in the file)
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name the ADR author; Backend assigned provisionally (open question).


### ROS-E01 — A: Authz matrix

#### ROS-E01-T005 — IDOR / tenant-boundary matrix test

- **Source:** ARCHITECTURE 'Security and operations deliverables'; PATH_OWNERS queued patches
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** A writes the matrix; each API owner adds the case for its routes; M runs them on the demo seed.
- **Dependencies:** ROS-E01-T003
- **Affected files:** `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] Restaurant A session requesting B's order, dish, customer, print job and loyalty profile gets 404 or 403
  - [ ] Outlet id never taken from the body to expand access
  - [ ] Per-route cases are queued patches landed by the route's path owner
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T006 — Origin/CSRF check spec for cookie-authenticated mutations

- **Source:** ARCHITECTURE 'Security and operations deliverables'; PATH_OWNERS queued patches
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Specify the cross-site Origin rejection; route owners land the patch.
- **Dependencies:** —
- **Affected files:** `proxy.ts`, `lib/api-authz.ts`
- **Acceptance criteria:**
  - [ ] State-changing cookie-authenticated routes reject a cross-site `Origin` when present
  - [ ] SameSite=lax stays
  - [ ] Pairing and connector calls keep code/secret contracts (not cookie CSRF)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Implementation per route is a queued patch by that route's owner.


### ROS-E02 — B: Order aggregate

#### ROS-E02-T007 — Append keeps frozen line prices/GST rates; settings frozen in billSnapshot

- **Source:** F-02 (rev.); ARCHITECTURE 'Money integrity' (historical snapshot)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop appendItemsToOrder re-rating history from the live menu (order.service.ts:750-770).
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/services/order.service.ts`, `lib/billing/`
- **Acceptance criteria:**
  - [ ] Existing lines keep frozen unit prices, line totals and line GST rates; new lines priced from current menu
  - [ ] Packaging, service charge and supply type come from frozen billSnapshot settings
  - [ ] Stored discounts unchanged unless the same request changes them
  - [ ] Snapshot test: change live dish GST after order exists, append a line, old line's rate and total unchanged
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T008 — replaceItemsAndTotals compare-and-swap on version/updatedAt (lost updates)

- **Source:** F-02 (rev.); ARCHITECTURE 'Money integrity' (lost updates)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Prevent two concurrent writers both succeeding.
- **Dependencies:** —
- **Affected files:** `lib/repositories/order.repository.ts`, `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] Repository update has a version or updatedAt precondition; caller re-reads and retries
  - [ ] Lost-update test: two concurrent appends/replace on one order – exactly one wins, loser applies on top of winner
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** This task is cancellation and append lost-update only. Payment-recording retry and concurrency are ROS-E12-T014, a separate requirement. B lands those payment tests on its own files. L does not edit them.

#### ROS-E02-T009 — Cancel idempotency marker commits in the same transaction as the money write

- **Source:** F-02 (rev.); ARCHITECTURE 'Money integrity' (crash retry)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** A retry after a crash returns the already-cancelled order and cancels nothing twice.
- **Dependencies:** ROS-E08-T003
- **Affected files:** `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] Parent cancellation marker and total write are one transaction; money write does not commit without the marker
  - [ ] Crash-retry test: fail after total write, before marker; retry is a no-op on quantities and tax components
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Depends on transactions actually being available (replica set, ROS-E08-T003).

#### ROS-E02-T010 — Server half of UI-vs-server bill parity matrix

- **Source:** PATH_OWNERS 'Queued security and CI patches'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** B lands the server half of the parity matrix in its billing test file.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007
- **Affected files:** `tests/billing-calculator.test.ts`
- **Acceptance criteria:**
  - [ ] Parity fixtures for packaging, service charge, inclusive mode, mixed rates and IGST in tests/billing-calculator.test.ts
  - [ ] Fixtures are exportable for C's screen half (ROS-E03-T003)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T011 — Correlation id on order events and payment ledger entries

- **Source:** ARCHITECTURE 'Security and operations deliverables'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Store the edge request id on order and payment writes, reusing `correlationId` in lib/db/mongo-tx.ts:40.
- **Dependencies:** ROS-E12-T011
- **Affected files:** `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] Order event and payment ledger entry carry the request id
  - [ ] No new id format introduced
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E03 — C: Bill UI

#### ROS-E03-T004 — Integrate E→C handoff of captain billing callers (take-order, bills)

- **Source:** ARCHITECTURE Stream C/E; PATH_OWNERS C
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** C lands the queued patch from E, one file at a time, after B's contract.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009
- **Affected files:** `app/captain/[slug]/take-order/page.tsx`, `app/captain/[slug]/bills/page.tsx`
- **Acceptance criteria:**
  - [ ] take-order no longer passes taxRatePercent into CaptainOrderPad
  - [ ] bills page totals come from B's snapshot-safe function
  - [ ] Each file integrated in its own commit
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E04 — D: Identities

#### ROS-E04-T009 — Lock down seed route handler POST /api/dev/seed-demo-kitchen

- **Source:** F-07; ARCHITECTURE (seed contract owned by D); PATH_OWNERS D
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Close the anonymous-upsert path in the handler (NODE_ENV / ALLOW_PRODUCTION_SEED / missing DEMO_SEED_TOKEN).
- **Dependencies:** —
- **Affected files:** `app/api/dev/seed-demo-kitchen/route.ts`, `lib/demo/seed-demo-kitchen.ts`, `tests/safeguards-and-rate-limiter.test.ts`
- **Acceptance criteria:**
  - [ ] Anonymous call without a valid seed token is rejected even when NODE_ENV is not production
  - [ ] ALLOW_PRODUCTION_SEED=true without a token does not permit a write
  - [ ] Seed-guard test in tests/safeguards-and-rate-limiter.test.ts passes (coordinate with A on limiter assertion)
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO decision 2026-11-07: Wave 1 D task. Edge half is ROS-E01-T004.

#### ROS-E04-T010 — Credential rotation and reset policy

- **Source:** ARCHITECTURE 'Security and operations deliverables'
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Session invalidation on reset and key rotation with rollback.
- **Dependencies:** ROS-E04-T003
- **Affected files:** `lib/security/`, `lib/auth-server.ts`, `app/api/auth/`
- **Acceptance criteria:**
  - [ ] Staff and customer resets invalidate existing sessions
  - [ ] CREDENTIALS_ENCRYPTION_KEY and WIFI_ENCRYPTION_KEY rotation has a re-encryption step and documented rollback
  - [ ] Reset tokens not returned in production API bodies
  - [ ] Super-admin bootstrap passwords stay in env and rotate without code change
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Customer reset touches G's files (queued patch).

#### ROS-E04-T011 — Trim public restaurant payload (billing, organizationId, subscription, feature overrides)

- **Source:** F-14; PATH_OWNERS D (app/api/restaurants/**, lib/restaurant-normalize.ts)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop leaking internal settings on the public full-menu response.
- **Dependencies:** —
- **Affected files:** `app/api/restaurants/[restaurantId]/route.ts`, `lib/restaurant-normalize.ts`
- **Acceptance criteria:**
  - [ ] Public GET /api/restaurants/[restaurantId]?fullMenu=true omits billing settings, organizationId, subscription and feature overrides (or decision documented)
  - [ ] Customer menu still renders
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E07 — G: Customer menu and loyalty UX

#### ROS-E07-T005 — Rate limit on loyalty login, register and reset

- **Source:** ARCHITECTURE security deliverables; PATH_OWNERS queued patches
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** G lands A's rate-limit spec on loyalty routes.
- **Dependencies:** ROS-E01-T001, ROS-E12-T013
- **Affected files:** `app/api/public/loyalty/`
- **Acceptance criteria:**
  - [ ] Burst on login/register/reset returns 429
  - [ ] Anonymous access contracts unchanged
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E08 — H: Schema steward

#### ROS-E08-T004 — Schema-change protocol: schemaVersion, idempotent backfill, staged indexes, rollback, restore note

- **Source:** ARCHITECTURE 'Schema changes'; PATH_OWNERS H
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Make every model change safe to roll back.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/db/models.ts`, `lib/db/mongo-mappers.ts`, `types/`
- **Acceptance criteria:**
  - [ ] Each changed collection has a version field/schemaVersion and a backfill safe to run twice
  - [ ] New index added in a release that still accepts old shape; old unique index dropped only in a later release
  - [ ] Previous app version works against pre-backfill docs
  - [ ] Backfill PR names the restore command and required backup point-in-time
  - [ ] Migration-safety note present whenever lib/db/** changes (L's gate)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E11 — K: Hardware

#### ROS-E11-T002 — Deliver KOT failure alerts and retries; correlation id on print jobs

- **Source:** ARCHITECTURE 'Security and operations deliverables' (KOT alerts, correlation ids)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** K delivers the outlet alert B enqueues and stores the request id on print jobs.
- **Dependencies:** ROS-E02-T006, ROS-E12-T011
- **Affected files:** `lib/services/device.service.ts`, `lib/devices/`
- **Acceptance criteria:**
  - [ ] Failed/missing KOT produces an outlet-visible alert
  - [ ] Retries use the existing attempt counter and dedupe key
  - [ ] Print job stores the request id
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E12 — L: DevOps

#### ROS-E12-T009 — Land xlsx replacement in root package.json/package-lock.json (F's dependency request)

- **Source:** F-08; PATH_OWNERS (L sole owner of root manifests)
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** L lands the dependency change F requests.
- **Dependencies:** —
- **Affected files:** `package.json`, `package-lock.json`
- **Acceptance criteria:**
  - [ ] Root manifests no longer resolve xlsx@0.18.5 for the import path (or isolation documented)
  - [ ] npm ci and npm test pass
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T010 — Structured redacted JSON logger

- **Source:** ARCHITECTURE 'Security and operations deliverables'
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Provide one logger every stream uses.
- **Dependencies:** —
- **Affected files:** `lib/observability/logger.ts` (proposed, pending CTO confirmation)
- **Acceptance criteria:**
  - [ ] Logs are JSON
  - [ ] Phone, email, password, cookie, connector secret, pairing code and payment account fields redacted
  - [ ] Reuses lib/ai/redact.ts pattern, no second redactor
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Path proposed in MASTER_PLAN §11. Pending CTO confirmation.

#### ROS-E12-T011 — Request/correlation id at the edge

- **Source:** ARCHITECTURE 'Security and operations deliverables'
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Accept or generate a request id at the request boundary.
- **Dependencies:** —
- **Affected files:** `lib/observability/request-id.ts` (proposed, pending CTO confirmation). Any `proxy.ts` change is a queued patch to A.
- **Acceptance criteria:**
  - [ ] Request id accepted or generated at the edge and propagated
  - [ ] Reuses correlationId helper in lib/db/mongo-tx.ts:40
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Proposed helper is `lib/observability/request-id.ts`. Pending CTO confirmation. `proxy.ts` stays A's.

#### ROS-E12-T012 — Backup/restore drill on a synthetic database copy

- **Source:** ARCHITECTURE 'Security and operations deliverables'
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Execute and record one restore drill.
- **Dependencies:** ROS-E08-T004
- **Affected files:** `docs/ops/BACKUP_RESTORE_DRILL.md` (proposed, pending CTO confirmation)
- **Acceptance criteria:**
  - [ ] Drill run against a synthetic copy, never production; steps executed once and result recorded
  - [ ] Drill record declares RPO/RTO targets for order and payment collections as targets, not measurements
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T013 — Shared rate-limit store

- **Source:** ARCHITECTURE security deliverables (rate limits: L for the shared store)
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Provide the store A's rate-limit specs use.
- **Dependencies:** —
- **Affected files:** `lib/rate-limit/store.ts` (proposed, pending CTO confirmation). Not `lib/security/**`.
- **Acceptance criteria:**
  - [ ] Store available to login, public order, Wi-Fi, loyalty and pairing limiters
  - [ ] Limiter fails closed if store is down
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Proposed path `lib/rate-limit/store.ts`, owner L, pending CTO confirmation. Not inside `lib/security/**` (D). `PRODUCTION_DEPLOYMENT_CHECKLIST.md` is also proposed as L's.

#### ROS-E12-T014 — Payment-recording retry and concurrency gate

- **Source:** CTO approval follow-up. Separate from cancellation crash-retry on ROS-E02-T009 and lost-update on ROS-E02-T008.
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** CI requires payment-recording retry and concurrency tests. v2 had reused ROS-E12-T010 for the logger, so this gate is restored under a new id.
- **Dependencies:** ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] Cancellation crash-retry and concurrency tests stay on ROS-E02-T008 and ROS-E02-T009. This task does not replace them, and those tests do not satisfy this task
  - [ ] A repeated payment request with the same idempotency key does not add a second ledger entry and does not increase `amountPaid` a second time
  - [ ] A payment recovered after a crash, including a crash between the ledger write and the response, does not duplicate a ledger entry or `amountPaid`
  - [ ] Concurrent payment posts for the same order and key leave exactly one ledger entry and one `amountPaid` increment
  - [ ] CI fails if those payment tests are missing or failing
  - [ ] The test code is a queued patch to B (`lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `tests/order-payment-recording.test.ts`). L does not edit those files
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E15 — O: WhatsApp Billing + Dynamic UPI + Billing Policies + Tips

#### ROS-E15-T001 — Provider capability verification and architecture/provider approval

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC §15 Q2
- **Owner:** TRONX CTO
- **Objective:** Verify candidate providers' real capabilities (dynamic QR per request, exact-amount lock, links, partial, UPI intent on iOS, expiry, refund API) and approve.
- **Dependencies:** EXT: Founder's provider choice
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Capability matrix contains only verified capabilities; unconfirmed shown as unknown
  - [ ] No exact-amount claim unless provider guarantees it
  - [ ] Approval recorded for the Founder-chosen provider; no credentials invented
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** Founder (via CEO)
- **Completion date:** —
- **Notes:** No provider is named in the brief.

#### ROS-E15-T002 — India payment requirements and WhatsApp policy/template review (pre-production)

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC §15 Q3
- **Owner:** TRONX CTO
- **Objective:** CTO reviews India payment requirements, WhatsApp policy and template constraints before production.
- **Dependencies:** —
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Written review incl. whether an itemized list fits an approved template and whether QR can be a media header
  - [ ] Go-live blocked until signed off
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** Founder (via CEO)
- **Completion date:** —

#### ROS-E15-T003 — Payment & tip UX spec (UX_SPEC.md) – finalize, replace TBD-PD tags, resolve §15

- **Source:** UX_SPEC; FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Designer owns the spec covering screens 1, 1b, 2, 3, 4, 4b, 5 state catalogue, receipt, tokens, accessibility.
- **Dependencies:** —
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Every TBD-PD tag replaced with the E15 task ID from the board mapping
  - [ ] §15 questions resolved or tracked on the board
  - [ ] Spec covers all 9 provider statuses and fallbacks; tips never preselected; captain/POS share one payment flow
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Spec already drafted, so In Progress. Spec file lives in TRONX HQ workspace, not the repo.

#### ROS-E15-T004 — Design tokens + shared status chip (icon+label) and TEST band design

- **Source:** UX_SPEC §10, §12, §16
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Single status-chip and token set shared by customer, captain and POS.
- **Dependencies:** ROS-E14-T001
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Tokens defined for Tailwind theme (via N shell owner)
  - [ ] Status chip spec covers every §10 state
  - [ ] TEST band spec for all payment surfaces
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E15-T005 — Accessibility & localisation audit (contrast, screen reader, 200% zoom, Hindi with Noto UI)

- **Source:** UX_SPEC §14, §16
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Audit preview build before QA hand-off.
- **Dependencies:** ROS-E15-T036, ROS-E15-T040, ROS-E15-T041
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Contrast, screen-reader and 200% zoom checks pass on all payment surfaces
  - [ ] Hindi strings render with Noto UI
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T006 — Design QA on preview build before QA hand-off

- **Source:** UX_SPEC §16
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Designer signs off implementation against spec.
- **Dependencies:** ROS-E15-T036, ROS-E15-T040, ROS-E15-T041, ROS-E15-T042, ROS-E15-T043, ROS-E15-T037, ROS-E15-T044
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Each screen checked against spec; deviations logged as tasks
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T007 — Reconciliation workflow: late/superseded requests, wrong amount, partial, double pay, manual review

- **Source:** FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** Define finance reconciliation against the ledger.
- **Dependencies:** —
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Late payment on superseded/expired request → Manual review, never Paid
  - [ ] Wrong amount/duplicate → MANUAL_REVIEW; bill Paid once
  - [ ] Ledger stays source of truth
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T008 — Tip tax treatment, receipt presentation and customer tip wording

- **Source:** FOUNDER_ORDER Order 2; UX_SPEC §15 Q7–8
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** No assumed tax treatment; Finance verifies with professional guidance.
- **Dependencies:** —
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Written professional guidance recorded
  - [ ] Tip % base (pre/post tax) and customer wording decided (Founder sign-off on wording)
  - [ ] No promise that tips go directly to an employee
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T009 — QA test plan: Order 1 failure list, Order 2 '20 listed tests', UX_SPEC AC-1…AC-5, regression

- **Source:** FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2; UX_SPEC
- **Owner:** TRONX QA ENGINEER
- **Objective:** Write scenario catalogue before build.
- **Dependencies:** —
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] All Order 1 failure cases listed
  - [ ] Test restaurants A/B/C as in brief
  - [ ] Every UX_SPEC AC (AC-1.x…AC-5.x) has a test case
  - [ ] '20 listed tests'/'Part H' added once their text is supplied
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** The condensed brief contains neither the 20 tests nor 'Part H' (open question).

#### ROS-E15-T010 — Doc: WHATSAPP_BILLING_ARCHITECTURE.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX CTO
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/WHATSAPP_BILLING_ARCHITECTURE.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/WHATSAPP_BILLING_ARCHITECTURE.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** Founder (via CEO)
- **Completion date:** —

#### ROS-E15-T011 — Doc: DYNAMIC_UPI_QR_IMPLEMENTATION.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/DYNAMIC_UPI_QR_IMPLEMENTATION.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/DYNAMIC_UPI_QR_IMPLEMENTATION.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E15-T012 — Doc: PAYMENT_WEBHOOK_SECURITY.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/PAYMENT_WEBHOOK_SECURITY.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/PAYMENT_WEBHOOK_SECURITY.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E15-T013 — Doc: WHATSAPP_TEMPLATE_GUIDE.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/WHATSAPP_TEMPLATE_GUIDE.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/WHATSAPP_TEMPLATE_GUIDE.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E15-T014 — Doc: PAYMENT_RECONCILIATION_REPORT.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** Report of actual results only (never fabricated).
- **Dependencies:** EXT: merchant sandbox keys
- **Affected files:** `docs/whatsapp-payments/PAYMENT_RECONCILIATION_REPORT.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/PAYMENT_RECONCILIATION_REPORT.md` exists
  - [ ] Contains only results from runs actually executed (sandbox, no real money, no real customers)
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys.

#### ROS-E15-T015 — Doc: WHATSAPP_PAYMENT_E2E_REPORT.md

- **Source:** FOUNDER_ORDER Order 1 (Docs)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Report of actual results only (never fabricated).
- **Dependencies:** EXT: merchant sandbox keys, EXT: WhatsApp test number
- **Affected files:** `docs/whatsapp-payments/WHATSAPP_PAYMENT_E2E_REPORT.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/WHATSAPP_PAYMENT_E2E_REPORT.md` exists
  - [ ] Contains only results from runs actually executed (sandbox, no real money, no real customers)
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys, WhatsApp test number.

#### ROS-E15-T016 — Doc: RESTAURANT_BILLING_POLICIES.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/RESTAURANT_BILLING_POLICIES.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/RESTAURANT_BILLING_POLICIES.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T017 — Doc: BILL_GENERATION_WORKFLOW.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/BILL_GENERATION_WORKFLOW.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/BILL_GENERATION_WORKFLOW.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T018 — Doc: CUSTOMER_TIP_CONFIGURATION.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/CUSTOMER_TIP_CONFIGURATION.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/CUSTOMER_TIP_CONFIGURATION.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T019 — Doc: TIP_ACCOUNTING_AND_RECONCILIATION.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX FINANCE MANAGER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/TIP_ACCOUNTING_AND_RECONCILIATION.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/TIP_ACCOUNTING_AND_RECONCILIATION.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T020 — Doc: DYNAMIC_PAYMENT_AMOUNT_RULES.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Required spec document.
- **Dependencies:** —
- **Affected files:** `docs/whatsapp-payments/DYNAMIC_PAYMENT_AMOUNT_RULES.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/DYNAMIC_PAYMENT_AMOUNT_RULES.md` exists
  - [ ] Accepted by reviewer
- **Status:** Ready
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —

#### ROS-E15-T021 — Doc: BILLING_POLICY_E2E_REPORT.md

- **Source:** FOUNDER_ORDER Order 2 (Docs)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Report of actual results only (never fabricated).
- **Dependencies:** ROS-E15-T046
- **Affected files:** `docs/whatsapp-payments/BILLING_POLICY_E2E_REPORT.md`
- **Acceptance criteria:**
  - [ ] `docs/whatsapp-payments/BILLING_POLICY_E2E_REPORT.md` exists
  - [ ] Contains only results from runs actually executed (sandbox, no real money, no real customers)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Every policy must be demonstrated in the actual app first. Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T022 — Payment provider abstraction (extends PaymentAdapter)

- **Source:** FOUNDER_ORDER Order 1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Provider-agnostic interface; mock in tests.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T001, ROS-E04-T007, EXT: Founder's provider choice
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Covers create request, status check, webhook verify, refund
  - [ ] Mock used in tests; only verified capabilities exposed
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T023 — Per-outlet merchant mapping + encrypted write-only secrets

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC AC-4.2/4.3
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Isolated per-outlet merchant config; settlement direct to restaurant merchant account, no TRONX wallet.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T001, ROS-E08-T004
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Secrets encrypted at rest, write-only; API returns only masked last-4
  - [ ] No other outlet's merchant/WhatsApp data returned (test)
  - [ ] No bank passwords or UPI PINs stored
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T024 — Payment request model bound to org/outlet/order/bill version; supersede on change

- **Source:** FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Amount only from server bill; not reusable across orders.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T001, ROS-E08-T004
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Amount from server bill, never client (test)
  - [ ] Reuse for another order rejected
  - [ ] Bill/tip change supersedes old request and issues new (e.g. 500 → 550)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T025 — Dynamic exact-amount QR / payment link per request

- **Source:** FOUNDER_ORDER Order 1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Generate provider QR/link for final confirmed amount.
- **Dependencies:** ROS-E15-T024, EXT: merchant sandbox keys
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] QR encodes the server request amount
  - [ ] Sandbox only
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys.

#### ROS-E15-T026 — Signature-verified webhook + authenticated status check (idempotent)

- **Source:** FOUNDER_ORDER Order 1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Only verified events mark payments.
- **Dependencies:** ROS-E15-T024, ROS-E15-T027, EXT: merchant sandbox keys
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Invalid signature rejected
  - [ ] Checks merchant, payment ref, order ref, amount, currency, status
  - [ ] Duplicate/delayed webhooks idempotent; wrong amount → MANUAL_REVIEW
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys.

#### ROS-E15-T027 — Ledger integration and 9-status payment state machine

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC §3, AC-5.1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Existing ledger remains source of truth.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T001, ROS-E15-T024
- **Affected files:** `lib/services/order.service.ts`
- **Acceptance criteria:**
  - [ ] PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED, PARTIALLY_PAID, REFUND_PENDING, REFUNDED, MANUAL_REVIEW
  - [ ] Late payment on superseded/expired request → MANUAL_REVIEW, never SUCCESS
  - [ ] Uncertain → Pending/Manual review
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release. order.service.ts changes are queued to B.

#### ROS-E15-T028 — Partial payments with remainder request; overpay guard

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC AC-2.4, AC-3.2
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** 500 = 200 + 300 flow.
- **Dependencies:** ROS-E15-T027
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] 200 recorded, PARTIALLY_PAID, new 300 request
  - [ ] Amount above remaining rejected server-side, no request created
  - [ ] Paid only after remainder verified; no duplicates
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T029 — Provider refunds, role-gated

- **Source:** FOUNDER_ORDER Order 1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Captains have no refund rights by default.
- **Dependencies:** ROS-E15-T027, ROS-E04-T005, EXT: merchant sandbox keys
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] REFUND_PENDING → REFUNDED from verified provider status
  - [ ] Captain refund rejected by default
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys.

#### ROS-E15-T030 — Billing policy engine + bill timing (PAY_BEFORE_PREPARATION, PAY_AFTER_MEAL, FLEXIBLE)

- **Source:** FOUNDER_ORDER Order 2; UX_SPEC AC-4b.2/4b.4
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Clear precedence; kitchen release separate; running bill for table sessions.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T016
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Effective policy and its reason exposed to managers
  - [ ] Precedence is order override, then table or session, then channel or order type, then outlet, then organization, then default
  - [ ] Kitchen release is a separate policy and is not forced
  - [ ] Open orders keep their policy when policy changes
  - [ ] Order/bill/request/collection/verification/receipt kept separate
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T031 — Bill versioning: finalized-only send, new version on item add, no duplicate per version

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC AC-1.1–1.3
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Preserve running-bill snapshots and audit history.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Send rejected for non-finalized bill
  - [ ] Same version never sent twice ('Already sent')
  - [ ] Re-finalize creates new version; old link Superseded
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T032 — Tip records separate from food revenue; ENABLE_CUSTOMER_TIPS default OFF

- **Source:** FOUNDER_ORDER Order 2; UX_SPEC AC-4b.1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Store amount, currency, source, confirmation, order, bill, payment ref, outlet, timestamp.
- **Dependencies:** ROS-E02-T001, ROS-E02-T007, ROS-E02-T008, ROS-E02-T009, ROS-E15-T008, ROS-E08-T004
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Tips default OFF for every new outlet
  - [ ] Tip separate from food revenue
  - [ ] No tax treatment assumed
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T033 — WhatsApp Cloud API integration: templates, send, status, delivery logs, consent

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC Screen 1, AC-1.4
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Send itemized bill and post-verification receipts per policy (interim owner Backend).
- **Dependencies:** ROS-E15-T031, ROS-E15-T002, EXT: WhatsApp test number
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Itemized bill fields per brief
  - [ ] Send blocked without recorded consent
  - [ ] Receipt only after verified payment; no real customers in demo
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: WhatsApp test number.

#### ROS-E15-T034 — Payment security: rate limits, consent records, phone protection, no secrets in browser/logs

- **Source:** FOUNDER_ORDER Order 1
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Apply constraints across payment/WhatsApp endpoints.
- **Dependencies:** ROS-E12-T010, ROS-E12-T013
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Burst returns 429
  - [ ] Phones and payment account fields redacted in logs
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T035 — Failure handling and fallbacks (WA down, QR fail, provider down, merchant disconnected, offline)

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC AC-5.3/5.4
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Bill stays in POS/captain; other authorized methods; Pending/Manual review when in doubt.
- **Dependencies:** ROS-E15-T027
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Each fallback covered by an automated test with mock provider
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T036 — Customer payment web page (Screen 1b) incl. tip step, receipt, expired/checking states

- **Source:** UX_SPEC §5, §11; FOUNDER_ORDER Order 1
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Mobile-first payment page; UPI intent primary on mobile, QR primary on desktop.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T024, ROS-E15-T025, ROS-E15-T027
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Shown amount equals server request (AC-1b.1)
  - [ ] 'Checking payment…' until verified (AC-1b.5); Expired state at 0 (AC-1b.6)
  - [ ] Mobile/desktop primary action per AC-1b.7
  - [ ] Receipt only after verified payment
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T037 — Tips UI component (conditionally imported)

- **Source:** FOUNDER_ORDER Order 2; UX_SPEC §5 tip step, AC-1b.2–1b.4, AC-4b.3
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** No tip / fixed / % / custom with explicit confirmation.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T032, ROS-E15-T024
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Tips OFF → no tip element in DOM and no receipt tip line (test asserts absence)
  - [ ] No option preselected; Pay/QR unavailable until choice confirmed
  - [ ] Confirmed tip creates new request (500+50=550), old not payable
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T038 — Staff WhatsApp send/resend controls + delivery status (Screen 1)

- **Source:** UX_SPEC §4, AC-1.x, AC-2.5
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Send/Resend with finalize guard, consent block, delivery state.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T031, ROS-E15-T033
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] 'Finalize bill first' disabled state
  - [ ] 'Not delivered' note with QR still usable and 'Bill available in POS'
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T039 — Shared PaymentPanel logic for captain + POS (role props, no duplication)

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC §16
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** One payment logic, role-gated.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T027, ROS-E03-T001, ROS-E03-T002, ROS-E04-T005
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Single component/hook used by both surfaces
  - [ ] Role props hide refund/settle/cash-close/resolve for default captain
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T040 — Captain bill / QR / status / remaining (Screen 2)

- **Source:** UX_SPEC §6
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Captain mobile payment screen.
- **Dependencies:** ROS-E15-T039, ROS-E15-T028
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Payable equals server bill (AC-2.1)
  - [ ] No Refund/Settle/Cash close/Resolve for default captain (AC-2.2)
  - [ ] Status follows verified webhook via polling (AC-2.3); partial flow (AC-2.4)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T041 — POS payment panel (Screen 3) incl. manual-review resolution

- **Source:** UX_SPEC §7
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Cashier/manager payment panel.
- **Dependencies:** ROS-E15-T039, ROS-E15-T028, ROS-E04-T005
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Amount > remaining → 'Max ₹…' and no request (AC-3.2)
  - [ ] Resolve actions only for permitted role, reason required (AC-3.3)
  - [ ] Close bill disabled while PENDING (AC-3.4); write failure shows error+retry (AC-3.5)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T042 — Admin › Settings › Payments & WhatsApp (Screen 4)

- **Source:** FOUNDER_ORDER Order 1; UX_SPEC §8
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Provider, WhatsApp Business, billing rules per outlet; test/live mode.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T023, ROS-E15-T001, ROS-E14-T001
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Live mode disabled with checklist without live credentials (AC-4.1)
  - [ ] Secrets masked last-4 only (AC-4.2); outlet isolation (AC-4.3)
  - [ ] TEST band on all surfaces in test mode (AC-4.4); unconfirmed capability shows '?' (AC-4.5)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release. Sidebar link via N.

#### ROS-E15-T043 — Settings › Billing & Payments › Billing Preferences (Screen 4b)

- **Source:** FOUNDER_ORDER Order 2; UX_SPEC §9
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Policy, timing and tip settings with effective-policy preview.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T030, ROS-E15-T032
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] New outlet tips OFF (AC-4b.1)
  - [ ] Preview shows effective policy and 'Why' (AC-4b.2)
  - [ ] Policy change note for open orders (AC-4b.4)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO + TRONX FINANCE MANAGER
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T044 — Payment state catalogue on all surfaces (Screen 5)

- **Source:** UX_SPEC §10
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Consistent state rendering via shared chip.
- **Dependencies:** ROS-E15-T003, ROS-E15-T004, ROS-E15-T027
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Late payment on superseded/expired → Manual review everywhere (AC-5.1)
  - [ ] Duplicate → Manual review, bill Paid once (AC-5.2)
  - [ ] Offline → no transition to Paid, UPI actions disabled (AC-5.3)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Build gated on Wave 1 merging into pro-max/release.

#### ROS-E15-T045 — TRONX WHATSAPP PAYMENT DEMO + test restaurants A/B/C (sandbox only)

- **Source:** FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2
- **Owner:** TRONX QA ENGINEER
- **Objective:** A pay-before/tips off; B pay-after/tips 5/10/15% + custom; C flexible by order type.
- **Dependencies:** ROS-E13-T001, EXT: merchant sandbox keys, EXT: WhatsApp test number
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Loopback DB only; no real money; no real customer messages
  - [ ] All §10 states reachable in sandbox
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys, WhatsApp test number.

#### ROS-E15-T046 — Execute all scenarios (failure list, 20 tests, UX ACs, regression)

- **Source:** FOUNDER_ORDER Order 1; FOUNDER_ORDER Order 2
- **Owner:** TRONX QA ENGINEER
- **Objective:** Run the plan on the demo.
- **Dependencies:** ROS-E15-T009, ROS-E15-T045, ROS-E15-T006, EXT: merchant sandbox keys, EXT: WhatsApp test number
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Evidence from actual runs for every scenario
  - [ ] Every policy demonstrated in the actual app
- **Status:** Blocked
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Blocked: merchant sandbox keys, WhatsApp test number.

#### ROS-E15-T047 — Production readiness gate: no live payments before onboarding + production credentials + Founder approval

- **Source:** FOUNDER_ORDER Order 1 + standing constraints
- **Owner:** TRONX CTO
- **Objective:** Gate go-live.
- **Dependencies:** ROS-E15-T002, ROS-E15-T046
- **Affected files:** — (not named in source docs)
- **Acceptance criteria:**
  - [ ] Merchant onboarding and production credentials verified
  - [ ] Founder approval recorded before live, before merges/deploys to main, and before any payments
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** Founder (via CEO)
- **Completion date:** —
