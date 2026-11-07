# TRONX PRO MAX Master Plan – Restaurant OS (ROS): Level 1 → Pro Max

**Status:** Draft v0.1 (TRONX Project Director, 2026-11-07). Source of every fact: audit PR https://github.com/Videsh999/tronxvideomenu/pull/1, branch `pro-max/audit`, files `docs/pro-max/TRONX_PRO_MAX_MODULE_INVENTORY.md`, `docs/pro-max/TRONX_PRO_MAX_FINDINGS.md`, `docs/pro-max/TRONX_PRO_MAX_ARCHITECTURE.md`. Audit baseline: `main` @ `fcc89586190e2dd40673c7cb04f6baa358dd7969`. Task detail: `TRONX_PRO_MAX_TASK_BOARD.md`.

## 1. Goal

Take the existing Restaurant OS to production-grade ("Pro Max") by **evolving the codebase and restructuring its seams, not rewriting it** (audit recommendation). Keep a modular monolith on Next.js + MongoDB; only the device connector is a separate deployable.

| Item | Value |
|---|---|
| Client | TBD – needs Founder approval via CEO |
| Deadline / milestone dates | TBD – needs Founder approval via CEO |
| Budget | TBD – needs Founder approval via CEO |
| Repo | `Videsh999/tronxvideomenu` (default branch `main`) |
| Live site | `https://tronxvideomenu.vercel.app` (config NOT TESTED by audit) |

## 2. Current state (from the module inventory)

- **Stack:** Next.js 16.3.6 (App Router), React 19.2.8, TypeScript 5.9.3, Tailwind 4.3.3, MongoDB via Mongoose 9.10.2 (no migrations; `lib/db/models.ts` is the schema), Zod 4.6.5, xlsx 0.18.5, `node:test` via tsx. Separate `device-connector/` package.
- **Modules:** 17 EXISTS-PARTIAL (auth, onboarding, admin dashboard, menu/Excel, QR + captain approval, captain portal, POS, KDS/KOT, reservations/tables, billing/GST/coupons/refunds/cash close, inventory/procurement, CRM, multi-outlet, AI, hardware, reports); **EXISTS-BROKEN:** customer loyalty self-service, cloud device connector (both blocked by proxy, F-01); **MISSING:** payment gateway, dedicated cashier and kitchen logins.
- End-to-end restaurant flows are **NOT VERIFIABLE** (no DB, browser, or hardware in the audit).
- **Checks:** `npm test` 210 tests, 209 pass, 1 fail (F-16); lint FAIL (15 errors, 26 warnings); typecheck FAIL (2 errors in `TablesManager.tsx`); build PASS but skips types; integration 8 skipped; device-connector 8/8 pass; `npm audit` 12 advisories (1 critical, 3 high, 8 moderate). No CI, no deploy config in repo, no E2E, no coverage tool.
- Real-time is HTTP polling (no WebSocket/SSE). 173 API handlers.

## 3. Workstreams (A–N) and what each delivers

| Epic | Stream | Delivers | Owner (audit) |
|---|---|---|---|
| ROS-E00 | Wave 0 | Split `lib/validations/index.ts` into domain modules (no feature change) | Backend, CTO review |
| ROS-E01 | A – Authz matrix | Per-handler contracts below. No blanket customer or connector class (F-01, F-07) | Backend |
| ROS-E02 | B – Order aggregate | Frozen line tax and settings snapshots; compare-and-swap updates; atomic cancel marker; crash-retry and concurrency tests; QR variants; QR idempotency returns the existing order (F-02, F-04, F-11, F-12, F-15) | Backend |
| ROS-E03 | C – Bill UI | POS and captain previews call B's billing contract. C does not edit `lib/billing/**` or `lib/order-pricing.ts`. The billing parity test is B's (F-03) | Frontend, after B |
| ROS-E04 | D – Identities | Wave 1: F-16 credential test, demo password literals out of git, public seed route lockdown, credential verification script. Memberships deferred (F-06, F-07, F-16) | Backend, UI by Frontend |
| ROS-E05 | E – Floor UI | Table statuses tsc-clean; captain/KDS intact (F-05, F-17) | Frontend, QA writes cases |
| ROS-E06 | F – Menu & catalog | Replace/isolate `xlsx` (F-08); import/export tests pass | Frontend + Backend for import |
| ROS-E07 | G – Customer menu & loyalty UX | Variant UI, working loyalty pages, honest marketing copy (F-04, F-01, F-19, F-14) | Frontend |
| ROS-E08 | H – Schema steward | Sole editor of `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`; membership collection (F-09, F-18) | Backend, CTO reviews every change |
| ROS-E09 | I – Inventory/procurement/CRM/reports/multi-outlet | Tests still pass; idempotency kept | Backend + Frontend screens |
| ROS-E10 | J – AI | Heuristic still refuses unknown tools; no provider call in unit tests | Backend |
| ROS-E11 | K – Hardware | Pair uses a pairing code. Heartbeat, job poll, and ack use the connector secret. No staff cookie (F-01) | Backend |
| ROS-E12 | L – DevOps | PR workflow. CI fails if integration tests are skipped. Wave 1 gates: payment retry, workbook compatibility, UI-vs-server parity matrix, migration-safety declaration, seeded-credential rotation assessment. Final gates last (F-05, F-10, F-21, F-22) | DevOps |
| ROS-E13 | M – Demo & QA | `seed-pro-max-demo.ts` / `cleanup-pro-max-demo.ts` (loopback only), E2E, API, load tests | QA; DevOps supplies DB |
| ROS-E14 | N – UI shell | Shell/sidebar owner; POS & kitchen full-width | UI/UX, implemented by Frontend |

File ownership rule: from Wave 2, `docs/pro-max/PATH_OWNERS.md` governs. In Wave 1, typecheck and lint fixes in files owned by C, E, or F are made serially by the single Wave 1 implementer. The owning stream lead reviews those diffs in the Wave 1 PR. `lib/services/order.service.ts` → B only; `lib/billing/**` and `lib/order-pricing.ts` → B only; `lib/db/models.ts`/`types/index.ts` → H only; `proxy.ts`/`lib/api-authz.ts` → A only; `next.config.ts` and the root `package.json` → L only; sidebar → N only. `lib/demo/seed-demo-kitchen.ts` and the legacy seed route → D. In Wave 1, D may only remove credential literals there. M never edits those paths.

Handler contracts for Stream A (no blanket class):

| Handler | Contract |
|---|---|
| `POST /api/public/loyalty/login`, `register`, `forgot-password`, `reset-password` | Anonymous. The proxy must not require an existing customer session or a staff session. Login and register set the customer cookie on success. Reset uses the token in the body. |
| `POST /api/public/loyalty/logout` | Anonymous. Clears the customer cookie even when it is missing. |
| `GET /api/public/loyalty/me` | No staff cookie. The handler returns `data: null` when the customer cookie is absent. The proxy does not demand a customer session first. |
| `POST /api/connector/pair` | Pairing code only. Not `requireConnectorAuth` and not a connector secret. The code record binds the outlet. |
| `POST /api/connector/heartbeat`, `GET /api/connector/jobs`, `POST /api/connector/jobs/[jobId]/ack` | Connector id and secret. Not a pairing code. No staff cookie. |

## 4. Waves

- **Wave 0 – In Progress:** validation split (ROS-E00-T001). Goes first, per the CTO merge order. Lands in the `pro-max/release` integration branch ahead of the Wave 2 streams. ROS-E02-T002 keeps its dependency on it.
- **Wave 1 – In Progress:** A (all), B (all), C (all), D Wave 1 only (F-16 captain credential test, demo password literals out of git, public seed route lockdown, credential verification script). Memberships are deferred. L (CI, integration job, ignoreBuildErrors, env template, secret scan, dev origin), typecheck (TablesManager statuses), lint (F-21), xlsx (F-08). Typecheck and lint fixes in C, E, or F files are serial work by the single Wave 1 implementer; the owning stream lead reviews them in the Wave 1 PR.
- **Wave 2 onward – Backlog:** PATH_OWNERS.md governs. Rest of D (memberships and later identity work), E, F (beyond xlsx), G, H, I, J, K, M, N, plus the payment adapter (Founder decision pending) and advisory follow-ups.
- **CTO merge order:** validation contracts first; H's compatible schema before D's membership consumers; B's billing contract before C; A before connector and loyalty acceptance; D and H before full-role demo QA; L's final gates last. A and B must be merged before any production deploy (otherwise loyalty, printing and cancel math stay wrong). The earlier "C–N in any order" line does not apply.

## 5. Dependencies between workstreams

- G loyalty → A (per-handler allow-list, not a customer-session class). K connector → A (pair is a pairing code; heartbeat, jobs, and ack are the connector secret).
- G variant UI → B (server accepts variantId). B variant schema (ROS-E02-T002) → Wave 0 (ROS-E00-T001). That dependency stays.
- C (ROS-E03-T001 and T002) starts only after B's billing contract (ROS-E02-T001). C imports that contract and does not edit `lib/billing/**` or `lib/order-pricing.ts`. The billing parity test (ROS-E03-T003) is owned by B.
- L `ignoreBuildErrors` removal → E (table statuses) and B leave `tsc` clean. L's final gates merge last. CI fails if the integration suite is skipped.
- D memberships are deferred. When they start, they wait on H's membership collection. Phase B demo users (M) wait on that same collection.
- M builds `scripts/seed-pro-max-demo.ts` and `scripts/cleanup-pro-max-demo.ts` only. M never edits `lib/demo/seed-demo-kitchen.ts`, `lib/demo/**`, `app/api/dev/seed-demo-kitchen/**`, or `scripts/verify-demo-reupload-import.mjs`. Those stay with D, matching PATH_OWNERS.md.
- M → L/DevOps for a local replica-set database.
- All streams → N for sidebar links; → H for schema patches. From Wave 2, shared-file edits are queued patches under PATH_OWNERS.md. A and L do not edit another stream's files to discharge a security duty; they queue a patch to that path owner.

## 6. Key risks (from findings)

| Risk | Finding | Sev |
|---|---|---|
| Loyalty and cloud printing blocked at the edge proxy | F-01 | S1 |
| Cancel recomputes tax with legacy formula; GST split/packaging/service/billSnapshot go stale | F-02 | S1 |
| Staff screens show a different bill than the server stores | F-03 | S2 |
| QR guests cannot pick variants; charged base price | F-04 | S2 |
| Builds skip TypeScript; tsc fails | F-05 | S2 |
| Reversible staff passwords; committed demo password | F-06 | S2 |
| Demo seed route public to the proxy | F-07 | S2 |
| `xlsx@0.18.5` high advisories on upload parser; `next` critical advisory (not confirmed reachable) | F-08 | S2 |
| One admin per outlet; no cashier/kitchen login | F-09 | S3 |
| No CI; Mongo concurrency suite never run; standalone Mongo silently drops transactions | F-10 | S3 |
| Also: order number fallback collision (F-11), QR 409 on double-tap + no rate limit (F-12), login limiter fails open (F-13), Wi-Fi slug-only secret (F-14), swallowed KOT failures (F-15), lint failures (F-21), no payment gateway (F-20, parked, Founder decision pending) | | S3–S4 |
| Shared hot files (`order.service.ts` 1655 lines, `models.ts`) → merge conflicts unless single owner | Architecture | — |

## 7. Roles

- **TRONX Project Director** – owns the task board and register; assigns, tracks status.
- **TRONX CTO** – reviews all engineering work before it is eligible for release. A and B must be in the release candidate or loyalty, printing, and cancel math stay wrong.
- **TRONX QA ENGINEER** – verifies against acceptance criteria; only QA sets **Verified**.
- **Founder** – approves scope, deadline and budget changes, routed via **CEO**. Every merge to `main` and every production deploy needs explicit Founder approval. That approval comes after CTO review, QA sign-off, and green CI. No one else may merge or deploy to `main`.
- Engineers: TRONX BACKEND / FRONTEND / DEVOPS ENGINEER, TRONX UI UX DESIGNER, TRONX OPERATIONS & SUPPORT – one accountable owner per task.

## 8. Status workflow

`Backlog → Ready → In Progress → In Review → QA → Ready for Release → Released → Verified`, with `Blocked` (from any active state) and `QA Failed` (QA → back to In Progress).

- In Review = CTO review. QA = handed to QA with acceptance criteria, preview/staging link and engineer name.
- **No task is done until QA marks it Verified.** Test evidence must be attached on the board.
- **Release branch.** Every implementation PR targets `pro-max/release`. This audit PR (`pro-max/audit`, PR #1) is docs-only. It is not an implementation PR and it is not merged to `main` until the Founder approves.
- **Merge and deploy to `main`.** Required order: CTO review, then QA sign-off, then green CI on `pro-max/release`, then explicit Founder approval. A merge or deploy to `main` without that approval does not happen. Client, deadline, and budget stay TBD until the Founder sets them.

## 9. Open items

See "Open questions" in `TRONX_PRO_MAX_TASK_BOARD.md`. All dates, budget and client details: TBD – needs Founder approval via CEO.

## 10. CEO decisions (2026-11-07)

1. **Wave 0 goes first**, per the CTO merge order. ROS-E00-T001 is **In Progress**. It lands in the `pro-max/release` integration branch ahead of the Wave 2 streams. ROS-E02-T002 keeps its dependency on ROS-E00-T001.
2. **Stream D, Wave 1 only:** the F-16 captain credential test fix, moving the demo passwords out of git (F-06), locking down the public seed route, and the credential verification script. Memberships are deferred.
3. **D owns** `lib/demo/seed-demo-kitchen.ts` and the legacy seed route. In Wave 1, D may only remove credential literals in that file. M never edits that file or the legacy seed route. M builds the new demo seed on its own paths.
4. **Wave 1 typecheck and lint** fixes in files owned by C, E, or F are made serially by the single Wave 1 implementer. The owning stream lead reviews those diffs in the Wave 1 PR. From Wave 2 on, `docs/pro-max/PATH_OWNERS.md` governs.
5. **Payment gateway (F-20)** stays parked under D as Backlog until the Founder picks a gateway. Status: Founder decision pending.
6. **Client, deadline, and budget stay TBD** until the Founder approves them. No values are set in this plan.
