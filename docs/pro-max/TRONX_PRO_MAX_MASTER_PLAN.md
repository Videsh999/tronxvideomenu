# TRONX PRO MAX Master Plan – Restaurant OS (ROS): Level 1 → Pro Max

**Status:** Draft v0.2.2 (v0.2.1 backed up as `.v2.1.bak`). Earlier: v0.2.1 (v0.2 as `.v2.bak`). Earlier: v0.2 (v0.1 backed up as `.v1.bak`; adds CEO decisions, CTO review incl. `docs/pro-max/PATH_OWNERS.md`, Epic E15). Originally drafted (TRONX Project Director, 2026-11-07). Source of every fact: audit PR https://github.com/Videsh999/tronxvideomenu/pull/1, branch `pro-max/audit`, files `docs/pro-max/TRONX_PRO_MAX_MODULE_INVENTORY.md`, `docs/pro-max/TRONX_PRO_MAX_FINDINGS.md`, `docs/pro-max/TRONX_PRO_MAX_ARCHITECTURE.md`. Audit baseline: `main` @ `fcc89586190e2dd40673c7cb04f6baa358dd7969`. Task detail: `TRONX_PRO_MAX_TASK_BOARD.md`.

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
| ROS-E01 | A – Authz matrix | `customer` + `connector` proxy classes; every route classified by test (F-01, F-07) | Backend |
| ROS-E02 | B – Order aggregate | Cancel uses `calculateRestaurantBill` & writes all money fields; QR variants; QR idempotency returns existing order (F-02, F-04, F-11, F-12, F-15) | Backend |
| ROS-E03 | C – Bill UI | POS & captain previews equal server bill; parity test (F-03) | Frontend (Backend reviews calculator import) |
| ROS-E04 | D – Identities | Fix credential test; demo passwords out of git; memberships; audited/no password reveal (F-06, F-09, F-13, F-16) | Backend, UI by Frontend |
| ROS-E05 | E – Floor UI | Table statuses tsc-clean; captain/KDS intact (F-05, F-17) | Frontend, QA writes cases |
| ROS-E06 | F – Menu & catalog | Replace/isolate `xlsx` (F-08); import/export tests pass | Frontend + Backend for import |
| ROS-E07 | G – Customer menu & loyalty UX | Variant UI, working loyalty pages, honest marketing copy (F-04, F-01, F-19, F-14) | Frontend |
| ROS-E08 | H – Schema steward | Sole editor of `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`; membership collection (F-09, F-18) | Backend, CTO reviews every change |
| ROS-E09 | I1–I5 – Inventory / Procurement / CRM / Multi-outlet / Reports | Tests still pass; idempotency kept; separate owners and merge queues | Backend (one per sub-stream) |
| ROS-E10 | J – AI | Heuristic still refuses unknown tools; no provider call in unit tests | Backend |
| ROS-E11 | K – Hardware | Connector handlers/client work via `connector` class | Backend |
| ROS-E12 | L – DevOps | PR workflow (lint, typecheck, unit), integration on replica set, remove `ignoreBuildErrors`, env template (F-05, F-10, F-21, F-22) | DevOps |
| ROS-E13 | M – Demo & QA | `seed-pro-max-demo.ts` / `cleanup-pro-max-demo.ts` (loopback only), E2E, API, load tests | QA; DevOps supplies DB |
| ROS-E15 | O – WhatsApp Billing + Dynamic UPI + Billing Policies + Tips | Provider abstraction, per-outlet merchant mapping, dynamic QR, verified webhooks, ledger states, partial/refunds, policy engine, tips, WhatsApp Cloud API, admin/captain/POS/customer payment UI, 12 docs in `docs/whatsapp-payments/` | CTO, Finance, Backend, Frontend, UI/UX, QA (Founder order 2026-11-07, UX_SPEC.md) |
| ROS-E14 | N – UI shell | Shell/sidebar owner; POS & kitchen full-width | UI/UX, implemented by Frontend |

File ownership: `docs/pro-max/PATH_OWNERS.md` (CTO) governs from Wave 2 on; changes outside a stream's paths are queued patches landed by the owner, one at a time. Earlier rule (audit): streams run in parallel only inside their listed paths. `lib/services/order.service.ts` → B only; `lib/db/models.ts`/`types/index.ts` → H only; `proxy.ts`/`lib/api-authz.ts` → A only; `next.config.ts` → L only; sidebar → N only.

## 4. Waves and merge order

All PRs target the integration branch `pro-max/release` (created from `main` at `fcc8958`).

- **Wave 0, In Progress, merges first:** validation contracts (ROS-E00-T001). ADRs 0001–0005 (ROS-E00-T002 to T006) are Ready.
- **Wave 1, In Progress:**
  - A, B and C (C starts after B's billing contract)
  - D (F-16 + F-06 + seed-route lockdown)
  - L
  - Typecheck/lint, done serially by one implementer and reviewed by the C/E/F leads
  - xlsx (F + L)
- **Wave 2 and later, Backlog:** the rest of D, E, F, G, H, I1–I5, J, K, M and N. E15 build tasks are gated on Wave 1 merging into `pro-max/release`.
- **CTO merge order:**
  1. Wave 0
  2. H schema
  3. B billing contract before C
  4. A before K/G acceptance
  5. D + H before M full-role QA
  6. L final gates (required CI, typecheck on, `ignoreBuildErrors` removed) last
- **Production deploy needs:** Wave 0, H (for collections written), A and B merged. Founder approval is required before merges/deploys to `main`, going live, or any payments.

## 4a. Founder gates

Founder approval (via CEO) is an extra gate, on top of normal review, for:
- the payment provider choice (ROS-E15-T001)
- the first real-money test (ROS-E15-T048)
- going live (ROS-E15-T047)
- any merge or deploy of `pro-max/release` to `main` (ROS-E12-T014)

## 5. Dependencies between workstreams

- G loyalty → A (proxy). K connector → A (connector class).
- G variant UI → B (server accepts variantId). B variant schema → Wave 0 split.
- C → may import `calculateRestaurantBill` now; must not edit `lib/order-pricing.ts` until B removes the cancel dependency.
- L `ignoreBuildErrors` removal → E (table statuses) and B leave `tsc` clean.
- D memberships, Phase B demo users (M) → H membership collection.
- M → L/DevOps for a local replica-set database.
- All streams → N for sidebar links; → H for schema patches; → L for root dependency changes.
- M → D: M doesn't touch `lib/demo/seed-demo-kitchen.ts` until ROS-E04-T002 merges.
- E15 depends on:
  - the Wave 1 billing writer and B's contract (ROS-E02-T001/T007/T008/T009)
  - CTO provider approval (ROS-E15-T001)
  - the Founder's provider choice
  - merchant sandbox keys
  - the WhatsApp test number

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
| Also: order number fallback collision (F-11), QR 409 on double-tap + no rate limit (F-12), login limiter fails open (F-13), Wi-Fi slug-only secret (F-14), swallowed KOT failures (F-15), lint failures (F-21), no payment gateway (F-20) | | S3–S4 |
| Shared hot files (`order.service.ts` 1655 lines, `models.ts`) → merge conflicts unless single owner | Architecture | — |

## 7. Roles

- **TRONX Project Director** – owns the task board and register; assigns, tracks status.
- **TRONX CTO** – reviews all engineering work; gates production deploy on A + B.
- **TRONX QA ENGINEER** – verifies against acceptance criteria; only QA sets **Verified**.
- **Founder** – approves scope, deadline and budget changes, routed via **CEO**.
- **TRONX FINANCE MANAGER:** E15 billing workflows, reconciliation and tip accounting. Finance-related tasks are reviewed by CTO + Finance.
- Engineers: TRONX BACKEND / FRONTEND / DEVOPS ENGINEER, TRONX UI UX DESIGNER, TRONX OPERATIONS & SUPPORT – one accountable owner per task.

## 8. Status workflow

`Backlog → Ready → In Progress → In Review → QA → Ready for Release → Released → Verified`, with `Blocked` (from any active state) and `QA Failed` (QA → back to In Progress).

- In Review = CTO review. QA = handed to QA with acceptance criteria, preview/staging link and engineer name.
- **No task is done until QA marks it Verified.** Test evidence must be attached on the board.

## 9. Decisions and open items

CEO decisions (2026-11-07), the CTO review mapping, the UX_SPEC TBD-PD mapping and the open questions are all in `TRONX_PRO_MAX_TASK_BOARD.md`. F-20 payment adapter: Founder decision pending.

## 10. Open items

See "Open questions" in `TRONX_PRO_MAX_TASK_BOARD.md`. All dates, budget and client details: TBD – needs Founder approval via CEO.
