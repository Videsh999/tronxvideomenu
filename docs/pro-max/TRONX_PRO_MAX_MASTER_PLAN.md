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
| ROS-E01 | A – Authz matrix | Per-handler contracts. No blanket customer or connector class. Login, register, and reset must not require an existing customer session. Pair is a pairing code. Heartbeat, jobs, and ack use the connector secret (F-01, F-07) | Backend |
| ROS-E02 | B – Order aggregate | Frozen line tax and settings snapshots; compare-and-swap; atomic cancel marker; cancellation crash-retry stays separate from payment-recording retry (ROS-E12-T015); QR variants; QR idempotency returns the existing order (F-02, F-04, F-11, F-12, F-15) | Backend |
| ROS-E03 | C – Bill UI | POS and captain previews consume B's billing contract and do not edit `lib/billing/**` or `lib/order-pricing.ts`. The billing parity test file is B's (F-03) | Frontend, after B |
| ROS-E04 | D – Identities | Fix credential test; demo passwords out of git; memberships; audited/no password reveal (F-06, F-09, F-13, F-16) | Backend, UI by Frontend |
| ROS-E05 | E – Floor UI | Table statuses tsc-clean; captain/KDS intact (F-05, F-17) | Frontend, QA writes cases |
| ROS-E06 | F – Menu & catalog | Replace/isolate `xlsx` (F-08); import/export tests pass | Frontend + Backend for import |
| ROS-E07 | G – Customer menu & loyalty UX | Variant UI, working loyalty pages, honest marketing copy (F-04, F-01, F-19, F-14) | Frontend |
| ROS-E08 | H – Schema steward | Sole editor of `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`; membership collection (F-09, F-18) | Backend, CTO reviews every change |
| ROS-E09 | I1–I5 – Inventory / Procurement / CRM / Multi-outlet / Reports | Tests still pass; idempotency kept; separate owners and merge queues | Backend (one per sub-stream) |
| ROS-E10 | J – AI | Heuristic still refuses unknown tools; no provider call in unit tests | Backend |
| ROS-E11 | K – Hardware | Pair uses a pairing code. Heartbeat, job poll, and ack use the connector secret. No staff cookie (F-01) | Backend |
| ROS-E12 | L – DevOps | PR workflow (lint, typecheck, unit), integration on replica set, remove `ignoreBuildErrors`, env template (F-05, F-10, F-21, F-22) | DevOps |
| ROS-E13 | M – Demo & QA | `seed-pro-max-demo.ts` / `cleanup-pro-max-demo.ts` (loopback only), E2E, API, load tests | QA; DevOps supplies DB |
| ROS-E15 | O – WhatsApp Billing + Dynamic UPI + Billing Policies + Tips | Provider abstraction, per-outlet merchant mapping, dynamic QR, verified webhooks, ledger states, partial/refunds, policy engine, tips, WhatsApp Cloud API, admin/captain/POS/customer payment UI, 12 docs in `docs/whatsapp-payments/` | CTO, Finance, Backend, Frontend, UI/UX, QA (Founder order 2026-11-07, UX_SPEC.md) |
| ROS-E14 | N – UI shell | Shell/sidebar owner; POS & kitchen full-width | UI/UX, implemented by Frontend |

File ownership: `docs/pro-max/PATH_OWNERS.md` governs from Wave 2 on; changes outside a stream's paths are queued patches landed by the owner, one at a time. `lib/services/order.service.ts`, `lib/billing/**`, and `lib/order-pricing.ts` → B only. `lib/db/models.ts` and `types/index.ts` → H only. `proxy.ts` and `lib/api-authz.ts` → A only. `next.config.ts` and the root `package.json` → L only. Sidebar → N only. `lib/demo/seed-demo-kitchen.ts` and the legacy seed route → D. M never edits those paths. `app/admin/menu/**`, `app/admin/media/**`, and `app/admin/availability/**` → F. `app/admin/profile/**`, `app/admin/[slug]/profile/**`, and `RestaurantProfileForm.tsx` are FROZEN until an owner is assigned. Restaurant APIs stay with D. Stream O is the CTO section in PATH_OWNERS.md: Backend owns `lib/payments/**` and `lib/messaging/whatsapp/**`; Frontend owns `components/payments/**`, `components/messaging/whatsapp/**`, and `app/admin/[slug]/settings/payments-whatsapp/**`. B still owns the billing contract and the policy resolver. There is no blanket `app/api/webhooks/**` owner.

Handler contracts for Stream A:

| Handler | Contract |
|---|---|
| Loyalty login, register, forgot-password, reset-password | Anonymous. The proxy must not require an existing customer session or a staff session. |
| Loyalty logout | Anonymous. Clears the customer cookie even when it is missing. |
| `GET /api/public/loyalty/me` | No staff cookie. Returns `data: null` when the customer cookie is absent. |
| `POST /api/connector/pair` | Pairing code only. Not `requireConnectorAuth` and not a connector secret. |
| Heartbeat, job poll, ack | Connector id and secret. Not a pairing code. |

## 4. Waves and merge order

All implementation PRs target the integration branch `pro-max/release`. That branch now exists. It was created from `main` at `fcc89586190e2dd40673c7cb04f6baa358dd7969` (`fcc8958`). This audit PR stays on `pro-max/audit` and is not an implementation PR.

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

- G loyalty → A (per-handler allow-list, not a customer-session class). K connector → A (pair is a pairing code; heartbeat, jobs, and ack are the connector secret).
- G variant UI → B (server accepts variantId). B variant schema → Wave 0 split.
- C (ROS-E03-T001 and T002) starts only after B's billing contract. C imports that contract and does not edit `lib/billing/**` or `lib/order-pricing.ts`. The billing parity test file is B's.
- L `ignoreBuildErrors` removal → E (table statuses) and B leave `tsc` clean. CI fails if integration tests are skipped.
- D memberships, Phase B demo users (M) → H membership collection.
- M → L/DevOps for a local replica-set database.
- All streams → N for sidebar links; → H for schema patches; → L for root dependency changes.
- M never edits `lib/demo/seed-demo-kitchen.ts`, `lib/demo/**`, `app/api/dev/seed-demo-kitchen/**`, or `scripts/verify-demo-reupload-import.mjs`. Those stay with D.
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
- **TRONX CTO** – reviews all engineering work before it is eligible for release. A and B must be in the release candidate or loyalty, printing, and cancel math stay wrong.
- **TRONX QA ENGINEER** – verifies against acceptance criteria; only QA sets **Verified**.
- **Founder** – approves scope, deadline and budget changes, routed via **CEO**. Every merge to `main` and every production deploy needs explicit Founder approval after CTO review, QA sign-off, and green CI. No one else may merge or deploy to `main`. Client, deadline, and budget stay TBD until the Founder sets them.
- **TRONX FINANCE MANAGER:** E15 billing workflows, reconciliation and tip accounting. Finance-related tasks are reviewed by CTO + Finance.
- Engineers: TRONX BACKEND / FRONTEND / DEVOPS ENGINEER, TRONX UI UX DESIGNER, TRONX OPERATIONS & SUPPORT – one accountable owner per task.

## 8. Status workflow

`Backlog → Ready → In Progress → In Review → QA → Ready for Release → Released → Verified`, with `Blocked` (from any active state) and `QA Failed` (QA → back to In Progress).

- In Review = CTO review. QA = handed to QA with acceptance criteria, preview/staging link and engineer name.
- **No task is done until QA marks it Verified.** Test evidence must be attached on the board.
- **Release branch.** Every implementation PR targets `pro-max/release`, which exists at `fcc89586190e2dd40673c7cb04f6baa358dd7969`. This audit PR is docs-only and is not merged to `main` until the Founder approves.
- **Merge and deploy to `main`.** Required order: CTO review, then QA sign-off, then green CI on `pro-max/release`, then explicit Founder approval. The gate task is ROS-E12-T014. A merge or deploy to `main` without that approval does not happen.

## 9. Decisions and open items

CEO decisions (2026-11-07), the CTO review mapping, the UX_SPEC TBD-PD mapping and the open questions are all in `TRONX_PRO_MAX_TASK_BOARD.md`. F-20 payment adapter: Founder decision pending.

## 10. Open items

See "Open questions" in `TRONX_PRO_MAX_TASK_BOARD.md`. All dates, budget and client details: TBD – needs Founder approval via CEO.

## 11. Unmapped items (pending CTO confirmation)

These proposals are not approved. They fill gaps the board left open. Each line is **pending CTO confirmation**.

| Item | Proposed owner | Proposed path | Notes |
|---|---|---|---|
| Structured logger | L | `lib/observability/logger.ts` | JSON logs. Redaction reuses `lib/ai/redact.ts`. Other streams call it; they do not add a second logger. |
| Request / correlation id | L proposes the helper; A lands the edge read because A owns `proxy.ts` | `lib/observability/request-id.ts`, queued patch on `proxy.ts` | Reuse `correlationId` in `lib/db/mongo-tx.ts` (H). B stores it on order events and the payment ledger. K stores it on print jobs. |
| Rate-limit store | L | `lib/rate-limit/store.ts` | Not inside `lib/security/**` (D). Login, public order, Wi-Fi, loyalty, and pairing limiters call it. Fail closed when the store is down. |
| Backup and restore drill | L | `docs/ops/BACKUP_RESTORE_DRILL.md` | Synthetic copy only. RPO 15 minutes and RTO 1 hour stay design targets, not measurements. |
| `PRODUCTION_DEPLOYMENT_CHECKLIST.md` | L | repo root, existing file | Deploy checklist. No secret values. |
| Legacy `/admin` pages | Already assigned, not a new proposal | `app/admin/menu/**`, `app/admin/media/**`, `app/admin/availability/**` → F. Profile paths FROZEN | APIs stay with their domain owners. See PATH_OWNERS.md. |

ADR authors, also **pending CTO confirmation**: TRONX BACKEND ENGINEER for `docs/adr/0001-tenancy.md` through `docs/adr/0005-polling.md`. ADR 0005 already covers KOT failure alerts and retries. ADRs 0006–0011 are in `docs/adr/` as Proposed. Nothing was renumbered to 0012.

Billing policy precedence, for the resolver B owns: **order override, then table or session, then channel or order type, then outlet, then organization, then default.** Kitchen release is a separate policy and is not forced by the payment policy. The prepay kitchen gate is the bill total excluding tip.

## 12. CTO fixes re-applied on this v2.2 copy

v2.2 is the board and plan. These approved rules were put back where v2.2 dropped them:

- Per-handler auth contracts replace the blanket customer and connector classes.
- M never edits D's legacy seed. PATH_OWNERS Stream O stays the CTO patch.
- Profile paths stay FROZEN. Menu, media, and availability stay with F.
- Payment-recording retry and concurrency is ROS-E12-T015. v2.2 reused ROS-E12-T014 for the release gate, and that gate is kept.
- Razorpay stays the conditional primary. Cashfree stays a capability proof with no exception to credential isolation.
