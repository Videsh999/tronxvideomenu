# TRONX PRO MAX Task Board – Restaurant OS (ROS)

Source: audit PR https://github.com/Videsh999/tronxvideomenu/pull/1 (branch `pro-max/audit`): `docs/pro-max/TRONX_PRO_MAX_MODULE_INVENTORY.md`, `TRONX_PRO_MAX_FINDINGS.md`, `TRONX_PRO_MAX_ARCHITECTURE.md`. Audit baseline: `main` @ `fcc89586`. Draft by TRONX Project Director, 2026-11-07. No task is done until TRONX QA ENGINEER marks it **Verified**.

## Epic → workstream mapping

| Epic | Workstream | Name | Tasks |
|---|---|---|---|
| ROS-E00 | Wave 0 | Validation split (serial prerequisite) | 1 |
| ROS-E01 | A | Authz matrix (per handler, no blanket class) | 4 |
| ROS-E02 | B | Order aggregate | 6 |
| ROS-E03 | C | Bill UI | 3 |
| ROS-E04 | D | Identities | 8 |
| ROS-E05 | E | Floor UI (captain, kitchen, tables, reservations) | 4 |
| ROS-E06 | F | Menu and catalog | 1 |
| ROS-E07 | G | Customer menu and loyalty UX | 4 |
| ROS-E08 | H | Schema steward | 3 |
| ROS-E09 | I | Inventory, procurement, CRM, reports, multi-outlet | 1 |
| ROS-E10 | J | AI | 1 |
| ROS-E11 | K | Hardware | 1 |
| ROS-E12 | L | DevOps | 14 |
| ROS-E13 | M | Demo and QA | 7 |
| ROS-E14 | N | UI shell | 1 |

## Summary

| ID | Title | Owner | Status | Reviewer |
|---|---|---|---|---|
| ROS-E00-T001 | Split lib/validations/index.ts into domain modules + re-export barrel | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T001 | Loyalty login, register, and reset stay anonymous (no existing customer session) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T002 | Pair accepts a pairing code; heartbeat, jobs, and ack use the connector secret | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T003 | Route-enumeration authz test covering every app/api/**/route.ts method (173 handlers) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E01-T004 | Remove `public` classification of POST /api/dev/seed-demo-kitchen | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T001 | Line cancel uses calculateRestaurantBill and persists all money fields | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T002 | QR (public) orders accept and price variants like POS | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T003 | Public QR idempotency returns the existing order instead of bare 409 | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T004 | Rate limit on POST /api/public/orders | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T005 | Allocate order numbers atomically with the insert; remove 1001 fallback | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E02-T006 | Surface KOT print failures instead of swallowing them | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T001 | POS terminal preview uses calculateRestaurantBill | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T002 | Captain order pad preview uses calculateRestaurantBill | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E03-T003 | Billing parity unit test (owned by Stream B) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T001 | Fix stale captain credential test double (touchLastActiveAt) | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T002 | Remove committed demo password literals; seed reads from environment | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E04-T003 | Remove recoverable staff passwords or gate behind an audited reveal with reason | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T004 | Staff memberships: many managers / cashiers / kitchen per outlet | TRONX BACKEND ENGINEER | Backlog (deferred) | TRONX CTO |
| ROS-E04-T005 | Cashier/manager role for cash shift and refunds | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T006 | Login limiter: fail closed, trusted client IP, constant-time secret compare | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E04-T007 | PaymentAdapter interface with mock implementation (no live gateway) | TRONX BACKEND ENGINEER | Backlog (Founder decision pending) | TRONX CTO |
| ROS-E04-T008 | Identity UI: membership and credential screens | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T001 | TablesManager labels/styles for BILL_REQUESTED, PAYMENT_PENDING, CLEANING (tsc clean) | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E05-T002 | Table admin API/schema accepts full floor status enum | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T003 | Resolve dead captain branch of GET /api/kitchen/orders | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E05-T004 | Floor UI regression: captain approval and KDS still compile and work | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E06-T001 | Replace or isolate xlsx@0.18.5 for untrusted workbook parsing | TRONX BACKEND ENGINEER | In Progress | TRONX CTO |
| ROS-E07-T001 | Customer menu variant selection UI | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T002 | Loyalty pages work end-to-end once proxy allows them | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T003 | Correct marketing copy that claims instant/real-time kitchen | TRONX FRONTEND ENGINEER | Backlog | TRONX CTO |
| ROS-E07-T004 | Wi-Fi reveal rate limit and trimmed public restaurant payload | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T001 | Membership collection schema and indexes | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T002 | Reservation timezone not hard-locked to Asia/Kolkata | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E08-T003 | Require Mongo replica set; fail startup if transaction probe fails | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E09-T001 | Inventory/procurement/CRM/org-reports regression guard | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E10-T001 | AI safety invariants preserved | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E11-T001 | Pair uses a pairing code; heartbeat, jobs, and ack use the connector secret | TRONX BACKEND ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T001 | GitHub Actions PR workflow: lint, typecheck, unit tests | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T002 | CI integration job on Mongo replica-set service container | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T003 | Remove typescript.ignoreBuildErrors once tsc is clean | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T004 | Production env template listing required names without values | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T005 | Fix lint errors (15 errors) so lint gate can pass | TRONX FRONTEND ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T006 | CI npm audit and secret scan | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T007 | Remove hardcoded dev LAN origin | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T008 | Assess next@16.3.6 critical and zod/source-map-js high advisories | TRONX DEVOPS ENGINEER | Backlog | TRONX CTO |
| ROS-E12-T009 | CI fails when integration tests are skipped | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T010 | Payment retry tests are a Wave 1 gate | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T011 | Malformed-workbook and import/export compatibility tests | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T012 | Full UI vs server bill parity matrix | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T013 | Migration-safety or no-data-changes declaration | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E12-T014 | Rotation assessment for previously seeded credentials | TRONX DEVOPS ENGINEER | In Progress | TRONX CTO |
| ROS-E13-T001 | scripts/seed-pro-max-demo.ts (Phase A, loopback only) | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T002 | scripts/cleanup-pro-max-demo.ts | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T003 | Demo seed Phase B: 2 managers, 2 cashiers, 3 kitchen users | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T004 | QA demo acceptance run | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T005 | Playwright E2E against localhost | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T006 | API tests incl. IDOR and connector-secret checks on local replica set | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E13-T007 | 100-user load and concurrency run with mock payment adapter | TRONX QA ENGINEER | Backlog | TRONX CTO |
| ROS-E14-T001 | UI shell invariants and sidebar-link process | TRONX UI UX DESIGNER | Backlog | TRONX CTO |

## Task details


### ROS-E00 — Wave 0: Validation split (serial prerequisite)

#### ROS-E00-T001 — Split lib/validations/index.ts into domain modules + re-export barrel

- **Source:** ARCHITECTURE Wave 0
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Serial prerequisite before the parallel wave so each stream adds schemas in its own file. No feature changes.
- **Dependencies:** —
- **Affected files:** `lib/validations/index.ts`
- **Acceptance criteria:**
  - [ ] `lib/validations/index.ts` only re-exports from domain modules
  - [ ] No feature/behaviour change: `npm test` result unchanged vs baseline (209 pass; the 1 known F-16 failure aside)
  - [ ] `npm run typecheck` introduces no new errors
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: Wave 0 goes first, per the CTO merge order. Land in the `pro-max/release` integration branch ahead of the Wave 2 streams. ROS-E02-T002 keeps its dependency on this task.


### ROS-E01 — A: Authz matrix

#### ROS-E01-T001 — Loyalty login, register, and reset stay anonymous (no existing customer session)

- **Source:** F-01; Stream A
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Let guests reach the existing loyalty handlers, which the proxy currently rejects as `staff`. Do not add a proxy class that requires a customer cookie.
- **Dependencies:** —
- **Affected files:** `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] POST /api/public/loyalty/login, register, forgot-password, and reset-password are reachable with no customer cookie and no staff cookie
  - [ ] The proxy must not require an existing customer session for login, register, or reset. A test fails if it does
  - [ ] POST logout and GET /me are reachable with no staff cookie. `me` may return `data: null` when the customer cookie is absent
  - [ ] There is no blanket `customer` class on `/api/public/loyalty/*`
  - [ ] Existing captain-vs-admin proxy tests still pass
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T002 — Pair accepts a pairing code; heartbeat, jobs, and ack use the connector secret

- **Source:** F-01; Stream A; Stream K
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop the proxy treating pairing and the secret channel as one staff route.
- **Dependencies:** —
- **Affected files:** `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`
- **Acceptance criteria:**
  - [ ] POST /api/connector/pair accepts a pairing code and does not call `requireConnectorAuth`. A connector secret is not required. No staff cookie is required
  - [ ] POST /api/connector/heartbeat, GET /api/connector/jobs, and POST /api/connector/jobs/[jobId]/ack reach `requireConnectorAuth` with no staff cookie
  - [ ] Those three reject a request that has no valid connector secret. A pairing code is not a substitute for that secret
  - [ ] There is no single `connector` class that applies one credential to all four routes
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
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E01-T004 — Remove `public` classification of POST /api/dev/seed-demo-kitchen

- **Source:** F-07
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop anonymous callers upserting the demo restaurant when NODE_ENV is not production or ALLOW_PRODUCTION_SEED=true without a token.
- **Dependencies:** —
- **Affected files:** `lib/api-authz.ts`, `app/api/dev/seed-demo-kitchen/route.ts`
- **Acceptance criteria:**
  - [ ] `classifyApiRequest` no longer returns `public` for POST /api/dev/seed-demo-kitchen
  - [ ] Anonymous POST to the route is rejected at the proxy in a unit test
  - [ ] Enumeration test (ROS-E01-T003) records the new class
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: locking down this route is Stream D Wave 1 scope, with ROS-E04-T002. D owns `app/api/dev/seed-demo-kitchen/route.ts`. In Wave 1, D may only remove credential literals from `lib/demo/seed-demo-kitchen.ts`. A proxy-class edit in `lib/api-authz.ts` is a queued patch to Stream A. Exact target class remains an open question.


### ROS-E02 — B: Order aggregate

#### ROS-E02-T001 — Line cancel uses calculateRestaurantBill and persists all money fields

- **Source:** F-02; Stream B; target architecture #3
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Remove the second bill formula from cancel so GST split, packaging, service charge and billSnapshot stay consistent with total.
- **Dependencies:** —
- **Affected files:** `lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `lib/order-pricing.ts`, `lib/billing/calculate-bill.ts`, `tests/order-pricing.test.ts`
- **Acceptance criteria:**
  - [ ] Line cancel (lib/services/order.service.ts:1530-1550) calls `calculateRestaurantBill`, not `computeBillTotals`
  - [ ] Cancel persists cgstAmount, sgstAmount, igstAmount, packagingCharge, serviceCharge and billSnapshot together with total
  - [ ] Existing lines keep frozen unit prices, line totals, and the GST rate stored when the line was created. Append does not re-resolve those rates from the live menu (order.service.ts:750-770). Order-level packaging, service charge, and supply type come from the frozen billSnapshot settings
  - [ ] `replaceItemsAndTotals` compare-and-swaps on a version or `updatedAt`. A second writer that read the old version does not overwrite the first
  - [ ] The cancellation idempotency marker commits in the same transaction as the money write. A crash between them is not observable
  - [ ] Crash-retry test: fail after the total write and before the marker; the retry does not cancel the quantity again
  - [ ] Concurrency test: two appends or an append and a cancel on one order; exactly one wins the version; the loser reapplies on the new snapshot
  - [ ] New unit test: after a partial cancel, stored CGST, SGST, IGST, packaging and total equal `calculateRestaurantBill` for the remaining lines at the frozen rates
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E02-T002 — QR (public) orders accept and price variants like POS

- **Source:** F-04 (server side); Stream B
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Let the public order path carry variantId and price the selected variant instead of dish.price.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/validations/index.ts`, `lib/services/order.service.ts`, `app/api/public/orders/route.ts`
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
- **Notes:** Audit specifies 429 but no threshold – open question.

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
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E03 — C: Bill UI

#### ROS-E03-T001 — POS terminal preview uses calculateRestaurantBill

- **Source:** F-03; Stream C
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make the amount the cashier sees equal what the server stores. Consume B's billing contract. Do not edit it.
- **Dependencies:** ROS-E02-T001
- **Affected files:** `components/admin/PosTerminal.tsx`, `app/admin/[slug]/pos/page.tsx`
- **Acceptance criteria:**
  - [ ] PosTerminal no longer imports `computeBillTotals` or a single `taxRatePercent`
  - [ ] On-screen total equals `calculateRestaurantBill` for packaging, service charge, inclusive mode, mixed dish rates and IGST
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Depends on B's billing contract (ROS-E02-T001). Must not include `lib/billing/**` or `lib/order-pricing.ts`. Backend reviews the import only.

#### ROS-E03-T002 — Captain order pad preview uses calculateRestaurantBill

- **Source:** F-03; Stream C
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make the captain's bill preview match the server. Consume B's billing contract. Do not edit it.
- **Dependencies:** ROS-E02-T001
- **Affected files:** `components/captain/CaptainOrderPad.tsx`, `app/captain/[slug]/take-order/page.tsx`
- **Acceptance criteria:**
  - [ ] CaptainOrderPad no longer imports `computeBillTotals`
  - [ ] On-screen total equals `calculateRestaurantBill` for packaging, service charge, inclusive mode and IGST
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Depends on B's billing contract (ROS-E02-T001). Must not include `lib/billing/**` or `lib/order-pricing.ts`. `take-order/page.tsx` is E's handoff to C.

#### ROS-E03-T003 — Billing parity unit test (owned by Stream B)

- **Source:** Stream B billing contract; F-02; F-03
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Lock the server calculator. This test is B's. C does not edit it.
- **Dependencies:** ROS-E02-T001
- **Affected files:** `tests/billing-calculator.test.ts`
- **Acceptance criteria:**
  - [ ] Owned and edited by Stream B (Backend), in `tests/billing-calculator.test.ts` only
  - [ ] Asserts `calculateRestaurantBill` totals and tax split for mixed rates, inclusive tax, IGST, discounts, packaging, and service charge
  - [ ] C's screens are covered by ROS-E12-T011, not by editing this file
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


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

#### ROS-E04-T002 — Remove committed demo password literals; seed reads from environment

- **Source:** F-06 (demo literals); Stream D
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Stop demo login literals in git becoming real credentials on shared databases.
- **Dependencies:** —
- **Affected files:** `lib/demo/seed-demo-kitchen.ts`, `scripts/verify-demo-reupload-import.mjs`
- **Acceptance criteria:**
  - [ ] `DEMO_KITCHEN.adminPassword` is not a string literal in git; value comes from an env var
  - [ ] `scripts/verify-demo-reupload-import.mjs` has no password literal
  - [ ] Seed fails clearly if the env var is missing and never prints it
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: this is Stream D Wave 1 scope, with the credential verification script (`scripts/verify-demo-reupload-import.mjs`). D owns `lib/demo/seed-demo-kitchen.ts` and the legacy seed route. In Wave 1, D may only remove credential literals there. M does not edit that file until this task has merged. No password value is committed.

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
- **Notes:** Not in Stream D Wave 1. CEO 2026-11-07 limits Wave 1 to the F-16 test, demo password literals, the public seed lockdown, and the credential verification script. Product choice (remove vs audited reveal) still needs a decision.

#### ROS-E04-T004 — Staff memberships: many managers / cashiers / kitchen per outlet

- **Source:** F-09; Stream D; target architecture #5
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Replace one-admin-per-outlet with memberships so a real floor team can be represented.
- **Dependencies:** ROS-E08-T001
- **Affected files:** `lib/auth-core.ts`, `lib/auth-server.ts`, `lib/services/restaurant-admin.service.ts`, `lib/repositories/restaurant-admin.repository.ts`, `app/api/auth/`, `tests/restaurant-admin-auth.test.ts`
- **Acceptance criteria:**
  - [ ] Two managers can exist for one outlet (test)
  - [ ] Cashier and kitchen roles have their own sessions and smaller permission sets
  - [ ] Captains remain a floor role with table assignments
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: memberships are deferred. Not in Stream D Wave 1.

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
- **Notes:** These files are not in any Stream D file list – ownership open question.

#### ROS-E04-T006 — Login limiter: fail closed, trusted client IP, constant-time secret compare

- **Source:** F-13; Test strategy (security)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Harden admin/super-admin login rate limiting and secret comparison.
- **Dependencies:** —
- **Affected files:** `lib/security/login-rate-limiter.ts`, `app/api/auth/login/route.ts`
- **Acceptance criteria:**
  - [ ] Limiter denies (or documented product decision recorded in test) when Mongo throws
  - [ ] Client key not taken blindly from first x-forwarded-for hop
  - [ ] `matchesSecret` does not return early on length mismatch; super-admin compare is constant-time
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

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
- **Status:** Backlog (Founder decision pending)
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: stays parked under D as Backlog until the Founder picks a gateway. Founder decision pending. Do not choose a provider in this board.

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
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: in Wave 1 this typecheck fix is made serially by the single Wave 1 implementer, in a file owned by E. The E stream lead reviews the diff in the Wave 1 PR. From Wave 2, PATH_OWNERS.md governs.

#### ROS-E05-T002 — Table admin API/schema accepts full floor status enum

- **Source:** F-17
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Bring create/update table schemas in line with the order-flow enum.
- **Dependencies:** ROS-E00-T001, ROS-E05-T001
- **Affected files:** `lib/validations/index.ts`, `app/api/tables/`
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
- **Dependencies:** —
- **Affected files:** `lib/menu-import/`, `lib/menu-export/`, `tests/menu-import.test.ts`, `tests/menu-export.test.ts`
- **Notes:** Any root `package.json` or lockfile change is a queued patch to L. F does not edit those files.
- **Acceptance criteria:**
  - [ ] Uploaded workbooks are not parsed by xlsx@0.18.5
  - [ ] `npm audit` no longer reports the xlsx high advisories (or the parser is isolated, documented)
  - [ ] tests/menu-import.test.ts and tests/menu-export.test.ts pass
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


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

#### ROS-E07-T004 — Wi-Fi reveal rate limit and trimmed public restaurant payload

- **Source:** F-14; Test strategy (security)
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Limit slug-only Wi-Fi password retrieval and stop exposing billing/subscription fields on the public menu.
- **Dependencies:** —
- **Affected files:** `app/api/public/restaurants/[slug]/wifi/route.ts`, `app/api/restaurants/[restaurantId]/route.ts`, `lib/restaurant-normalize.ts`
- **Acceptance criteria:**
  - [ ] Loop test on GET /api/public/restaurants/[slug]/wifi receives 429
  - [ ] Public full-menu response omits billing settings, organizationId, subscription and feature overrides (or decision documented)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** app/api/restaurants/** and lib/restaurant-normalize.ts are in no stream's file list.


### ROS-E08 — H: Schema steward

#### ROS-E08-T001 — Membership collection schema and indexes

- **Source:** F-09; Stream H
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Schema support for multiple staff memberships per outlet.
- **Dependencies:** ROS-E00-T001
- **Affected files:** `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`
- **Acceptance criteria:**
  - [ ] New membership collection with indexes; unique-per-restaurantId admin constraint (models.ts:627) no longer blocks multiple managers
  - [ ] No second source of truth for money fields
  - [ ] Short note of each new collection
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E08-T002 — Reservation timezone not hard-locked to Asia/Kolkata

- **Source:** F-18
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Allow other reservation timezones.
- **Dependencies:** —
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


### ROS-E09 — I: Inventory, procurement, CRM, reports, multi-outlet

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

#### ROS-E11-T001 — Pair uses a pairing code; heartbeat, jobs, and ack use the connector secret

- **Source:** F-01 (connector); Stream K
- **Owner:** TRONX BACKEND ENGINEER
- **Objective:** Restore cloud-to-Windows printing once the proxy lets connectors through.
- **Dependencies:** ROS-E01-T002
- **Affected files:** `app/api/connector/`, `lib/connector-auth.ts`, `device-connector/`, `tests/connector-pairing.test.ts`
- **Acceptance criteria:**
  - [ ] Pair accepts a pairing code and does not require a connector secret or `requireConnectorAuth`
  - [ ] Heartbeat, job poll, and ack require the connector secret and no staff cookie
  - [ ] device-connector tests pass (8/8 baseline); USB stays labeled unsupported
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
- **Affected files:** `.github/workflows/`, `tests/integration/mongo-concurrency.test.ts`, `tests/integration/print-job-lease.test.ts`
- **Acceptance criteria:**
  - [ ] Job starts a replica-set service container and sets RUN_INTEGRATION=1 and MONGODB_URI
  - [ ] 8 integration tests execute (not skipped) and results are recorded
  - [ ] CI fails if any integration test is skipped or if RUN_INTEGRATION is unset
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T003 — Remove typescript.ignoreBuildErrors once tsc is clean

- **Source:** F-05; Stream L
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Make typecheck a deploy gate again.
- **Dependencies:** ROS-E05-T001, ROS-E02-T001, ROS-E02-T002
- **Affected files:** `next.config.ts`, `tsconfig.json`
- **Acceptance criteria:**
  - [ ] `next.config.ts` no longer sets ignoreBuildErrors: true
  - [ ] `npm run build` no longer prints 'Skipping validation of types' and exits 0
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit: only after Streams E and B leave tsc clean.

#### ROS-E12-T004 — Production env template listing required names without values

- **Source:** Stream L acceptance
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Document required env names for deploy.
- **Dependencies:** —
- **Affected files:** `.env.example`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **Acceptance criteria:**
  - [ ] Template lists MONGODB_URI, AUTH_SECRET, CREDENTIALS_ENCRYPTION_KEY, WIFI_ENCRYPTION_KEY, Cloudinary and super-admin names etc.
  - [ ] Contains no values
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T005 — Fix lint errors (15 errors) so lint gate can pass

- **Source:** F-21; lint item
- **Owner:** TRONX FRONTEND ENGINEER
- **Objective:** Make `npm run lint` exit 0.
- **Dependencies:** —
- **Affected files:** `components/admin/MenuImportWizard.tsx`, `app/captain/[slug]/page.tsx`, `components/captain/CaptainApprovals.tsx`, `components/captain/CaptainOrderPad.tsx`, `eslint.config.mjs`
- **Acceptance criteria:**
  - [ ] `npm run lint` exits 0 with 0 errors
  - [ ] No Date.now() during render in the three cited captain files
  - [ ] No @next/next/no-html-link-for-pages error at MenuImportWizard.tsx:299
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** CEO 2026-11-07: in Wave 1 these lint fixes, including files owned by C, E, or F, are made serially by the single Wave 1 implementer. The owning stream lead reviews those diffs in the Wave 1 PR. From Wave 2, PATH_OWNERS.md governs. Coordinate `CaptainOrderPad.tsx` with ROS-E03-T002.

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
- **Notes:** Audit says the next critical is not confirmed reachable. `package.json` is L's. Domain code changes are queued patches to the path owner.

#### ROS-E12-T009 — CI fails when integration tests are skipped

- **Source:** CTO re-review 2026-11-07; F-10
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** A green CI run must have executed the integration suite.
- **Dependencies:** ROS-E12-T002
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] The workflow exits non-zero when `tests/integration` reports a skip, or when `RUN_INTEGRATION` is not `1`
  - [ ] A run that skips all 8 tests cannot be Ready for Release
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T010 — Payment retry tests are a Wave 1 gate

- **Source:** CTO re-review 2026-11-07; payment recording in `lib/services/order.service.ts` (`recordPayment`)
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** CI requires retry and concurrency tests for payment recording. These are not the cancellation tests.
- **Dependencies:** ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] Cancellation crash-retry and concurrency tests stay a separate requirement on ROS-E02-T001. This task does not replace them, and those tests do not satisfy this task
  - [ ] A repeated payment request with the same idempotency key does not add a second ledger entry and does not increase `amountPaid` a second time
  - [ ] A payment recovered after a crash, including a crash between the ledger write and the response, does not duplicate a ledger entry or `amountPaid`
  - [ ] Concurrent payment posts for the same order and key leave exactly one ledger entry and one `amountPaid` increment
  - [ ] CI fails if those payment tests are missing or failing
  - [ ] The test code is a queued patch to B (`lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `tests/order-payment-recording.test.ts`). L does not edit those files
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T011 — Malformed-workbook and import/export compatibility tests

- **Source:** CTO re-review 2026-11-07; F-08
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** CI requires workbook rejection and round-trip compatibility. F writes the tests.
- **Dependencies:** ROS-E06-T001, ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] CI fails if a malformed-workbook test and an import/export compatibility test are missing or failing
  - [ ] Test code is a queued patch to F (`lib/menu-import/`, `lib/menu-export/`, `tests/menu-import.test.ts`, `tests/menu-export.test.ts`). L does not edit those files
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T012 — Full UI vs server bill parity matrix

- **Source:** CTO re-review 2026-11-07; F-02; F-03
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** CI requires the parity matrix. B owns the server expected values. C owns the screen assertions.
- **Dependencies:** ROS-E02-T001, ROS-E03-T001, ROS-E03-T002, ROS-E03-T003
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] The matrix covers mixed rates, inclusive tax, IGST, discounts, packaging, service charge, and cancelled quantities
  - [ ] CI fails if that matrix is missing or failing
  - [ ] Server cases are a queued patch to B (`tests/billing-calculator.test.ts`). Screen cases are a queued patch to C (`components/admin/PosTerminal.tsx`, `components/captain/CaptainOrderPad.tsx`). L does not edit those files
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T013 — Migration-safety or no-data-changes declaration

- **Source:** CTO re-review 2026-11-07; schema section of the architecture doc
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Every Wave 1 PR states whether it changes stored documents.
- **Dependencies:** ROS-E12-T001
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] CI or the PR template requires either a migration-safety note (versioned backfill, staged index, rollback, restore) or an explicit "no data changes" declaration
  - [ ] A PR that edits `lib/db/models.ts` cannot declare "no data changes"
  - [ ] Schema edits stay a queued patch to H
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E12-T014 — Rotation assessment for previously seeded credentials

- **Source:** CTO re-review 2026-11-07; F-06
- **Owner:** TRONX DEVOPS ENGINEER
- **Objective:** Record whether databases that already ran the legacy seed must rotate staff credentials. Do not print secret values.
- **Dependencies:** ROS-E04-T002
- **Affected files:** `.github/workflows/`
- **Acceptance criteria:**
  - [ ] A written assessment, with no credential values, says which seeded accounts need rotation after the literals leave git
  - [ ] The assessment is a queued patch to D for `lib/demo/**` and `scripts/verify-demo-reupload-import.mjs`. L does not edit those files
  - [ ] CI does not echo env values
- **Status:** In Progress
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —


### ROS-E13 — M: Demo and QA

#### ROS-E13-T001 — scripts/seed-pro-max-demo.ts (Phase A, loopback only)

- **Source:** Stream M; Demo plan
- **Owner:** TRONX QA ENGINEER
- **Objective:** Build the TRONX PRO MAX DEMO RESTAURANT seed with today's roles.
- **Dependencies:** ROS-E12-T002
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
- **Notes:** DevOps supplies the database (Stream M). M never edits `lib/demo/seed-demo-kitchen.ts`, `lib/demo/**`, the legacy seed route, or `scripts/verify-demo-reupload-import.mjs`. Those stay with D (PATH_OWNERS.md). Passwords come from env names only; never commit a password value.

#### ROS-E13-T002 — scripts/cleanup-pro-max-demo.ts

- **Source:** Stream M; Demo plan
- **Owner:** TRONX QA ENGINEER
- **Objective:** Exact cleanup of demo data.
- **Dependencies:** ROS-E13-T001
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

#### ROS-E13-T003 — Demo seed Phase B: 2 managers, 2 cashiers, 3 kitchen users

- **Source:** Demo plan Phase B; F-09
- **Owner:** TRONX QA ENGINEER
- **Objective:** Create floor-team users once memberships exist.
- **Dependencies:** ROS-E04-T004, ROS-E08-T001, ROS-E13-T001
- **Affected files:** `scripts/seed-pro-max-demo.ts`
- **Acceptance criteria:**
  - [ ] Creates users when membership collection exists; otherwise skips with printed reason
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E13-T004 — QA demo acceptance run

- **Source:** Demo plan QA acceptance
- **Owner:** TRONX QA ENGINEER
- **Objective:** Verify core floor flows on the demo outlet.
- **Dependencies:** ROS-E13-T001, ROS-E02-T001, ROS-E03-T002
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

#### ROS-E13-T005 — Playwright E2E against localhost

- **Source:** Stream M; Test strategy (E2E)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Browser coverage of key flows (none exists today).
- **Dependencies:** ROS-E13-T001
- **Affected files:** `tests/e2e/`
- **Acceptance criteria:**
  - [ ] Covers guest QR, captain multi-table order without phone, POS cash close, kitchen column move
  - [ ] Points only at localhost (never tronxvideomenu.vercel.app)
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —

#### ROS-E13-T006 — API tests incl. IDOR and connector-secret checks on local replica set

- **Source:** Test strategy (API, security)
- **Owner:** TRONX QA ENGINEER
- **Objective:** API-level verification of money and tenancy paths.
- **Dependencies:** ROS-E13-T001, ROS-E01-T002
- **Affected files:** `tests/e2e/`
- **Acceptance criteria:**
  - [ ] Hits public order, captain approve, POS pay, refund, coupon redeem
  - [ ] Restaurant A cookie reading B's order, dish, customer returns 403
  - [ ] /api/connector/* without secret rejected
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit does not name a folder for API tests; tests/e2e/ assumed – open question.

#### ROS-E13-T007 — 100-user load and concurrency run with mock payment adapter

- **Source:** Test strategy (concurrency and load)
- **Owner:** TRONX QA ENGINEER
- **Objective:** Measure, don't invent, concurrency correctness and p95 poll latency.
- **Dependencies:** ROS-E13-T001, ROS-E04-T007, ROS-E12-T002
- **Affected files:** `scripts/load-benchmark-menu.mjs`
- **Acceptance criteria:**
  - [ ] Zero duplicate orders per idempotency key; zero negative stock; zero coupon redemptions above maxRedemptions
  - [ ] p95 of poll endpoints recorded from the actual run
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Audit says to add a load script; file name not specified.


### ROS-E14 — N: UI shell

#### ROS-E14-T001 — UI shell invariants and sidebar-link process

- **Source:** Stream N
- **Owner:** TRONX UI UX DESIGNER
- **Objective:** Own shell layout; other streams request links rather than editing the sidebar.
- **Dependencies:** —
- **Affected files:** `app/globals.css`, `components/shared/`, `components/admin/AdminShell.tsx`, `components/admin/AdminSidebar.tsx`, `components/admin/AdminHeader.tsx`, `lib/admin-layout.ts`
- **Acceptance criteria:**
  - [ ] POS and kitchen stay full-width (isImmersiveOpsPath)
  - [ ] Mobile nav still closes
  - [ ] No feature logic moves into the shell
- **Status:** Backlog
- **Test evidence:** —
- **Reviewer:** TRONX CTO
- **Completion date:** —
- **Notes:** Owner UI/UX; implemented by TRONX FRONTEND ENGINEER (Stream N).

## Open questions

1. **Wave 0 (validation split, ROS-E00-T001)** – Decided 2026-11-07: it runs first, status In Progress, and lands in `pro-max/release` ahead of the Wave 2 streams. ROS-E02-T002 still depends on it.
2. **"Part of D" in Wave 1** – Decided 2026-11-07: ROS-E04-T001 (F-16), ROS-E04-T002 (demo password literals and the credential verification script), and the public seed lockdown (ROS-E01-T004). Memberships (ROS-E04-T004 and later identity work) stay Backlog.
3. **Seed file conflict** – Decided 2026-11-07, aligned with PATH_OWNERS.md: D owns `lib/demo/seed-demo-kitchen.ts` and the legacy seed route. In Wave 1, D may only remove credential literals. M never edits those paths. M builds `scripts/seed-pro-max-demo.ts` only.
4. **Typecheck item vs stream ownership** – Decided 2026-11-07 for Wave 1: the single Wave 1 implementer makes the TablesManager typecheck fix serially. The E stream lead reviews that diff in the Wave 1 PR. From Wave 2, PATH_OWNERS.md governs. `ignoreBuildErrors` still comes off only after E and B leave tsc clean (L's final gate).
5. **Lint fixes cross streams** – Decided 2026-11-07 for Wave 1: the single Wave 1 implementer makes lint fixes in C, E, or F files serially. The owning stream lead reviews those diffs in the Wave 1 PR. From Wave 2, PATH_OWNERS.md governs. `CaptainOrderPad.tsx` still coordinates with ROS-E03-T002.
6. **Payment gateway** – Decided 2026-11-07: stays parked under D (ROS-E04-T007) as Backlog. Founder decision pending. No provider is chosen here.
7. **Remediation details not specified by audit** – target proxy class for the demo seed route (F-07), rate-limit thresholds (F-12, F-14), whether to keep fail-open limiter (F-13), whether non-Kolkata timezones are in scope (F-18), new marketing copy (F-19), password recovery remove vs audited reveal (F-06).
8. **Realtime/SSE** (target architecture #7, "later") and live Vercel config (NOT TESTED) – no task created; confirm scope.
9. **Stream C reviewer** – audit names Backend as reviewer for the calculator import; board uses TRONX CTO per brief, with Backend as secondary reviewer in notes.
10. **API test location** – audit does not name a folder for API tests (ROS-E13-T006 assumes `tests/e2e/`).
11. **Deadlines, budget, client, release dates** – Decided 2026-11-07: stay TBD until the Founder approves them. Do not invent values.
