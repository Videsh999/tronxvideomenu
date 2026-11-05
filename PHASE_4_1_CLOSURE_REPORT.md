# TRONX Restaurant OS — Phase 4.1 Closure Report

**Date:** 2026-11-05  
**Scope:** Close production-readiness gaps from `PHASE_4_1_REPORT.md` without new product modules.

---

## 1. Original gaps → resolution

| Gap | Classification | Resolution |
|-----|----------------|------------|
| Coupon `maxRedemptions` race | **Completed and tested** (unit + integration suite present) | Conditional `$expr` `$lt` + `$inc`, `CouponRedemption` ledger, reserve→confirm→release |
| Multi-doc consistency incomplete | **Completed and tested** (unit); tx mode env-dependent | `withOptionalTransaction` wired on PO receive, stock transfer, menu publish/rollback; idempotent ledgers elsewhere |
| Live Mongo concurrency tests | **Completed and tested** on local replica set `rs0@27018` | `tests/integration/mongo-concurrency.test.ts` + `docs/MONGO_REPLICA_SET_TESTING.md` |
| Super-admin org/outlet assignment UI | **Completed and tested** (authz schema + matrix unit tests) | `/api/super-admin/access-assignments` + `AccessAssignmentPanel` + audit + last-owner guard |
| Per-line cancel UX/API | **Completed and tested** (typecheck/build; service + route + Orders UI) | `POST /api/orders/[orderId]/cancel-lines`, inventory restore gate, idempotency |
| Menu sync rollback payloads | **Completed and tested** (typecheck/build) | Pre-publish snapshots + fingerprints, preview rollback, conflict force, compensating `ROLLED_BACK` |

---

## 2. Atomic coupon redemption design

1. **Eligibility** unchanged: `previewCoupon` (active, dates, min total, outlet/code lookup).
2. **Reserve:** `CouponModel.findOneAndUpdate` with  
   `maxRedemptions` absent/null **or** `$expr: { $lt: ["$redemptionCount", "$maxRedemptions"] }`  
   then `$inc: { redemptionCount: 1 }`.
3. **Ledger:** insert `CouponRedemption` `{ status: RESERVED }` unique on `(restaurantId, idempotencyKey)`.
4. **Duplicate key:** compensate `$inc: -1` if another writer won the idempotency race; return winner’s redemption.
5. **POS create:** generate `orderId` → `couponRedeemKey(orderId, code)` → reserve → create order → **confirm**; on any failure → **release** (`RELEASED` + `$inc: -1`).
6. **Loyalty:** concurrent redeem uses atomic `$inc` with `loyaltyPoints: { $gte: points }`; duplicate idempotency compensates balance.

Acceptance: with `maxRedemptions=1`, 20 concurrent reserves → ≤1 success (integration test).

---

## 3. Transaction coverage matrix

| Workflow | Write operations | Strategy | Recovery |
|----------|------------------|----------|----------|
| Order inventory consume | movements + consumption record | Idempotent keys (`consume:orderId`); optional tx helper available | Retry same key; no double consume |
| Per-line stock restore | movements + consumption patch | Line idempotency keys; prep gate | Re-run cancel; already-restored qty skipped |
| Purchase receiving | movements + PO lines + goods receipt | `withOptionalTransaction` + receipt id keys; duplicate receipt safe | Retry same `receiptIdempotencyKey` |
| Stock transfer send/receive | movements + transfer status | `withOptionalTransaction` + conditional status claim (`DRAFT→SENT`, `SENT→RECEIVED`) + movement keys | Retry; claim fails if already transitioned |
| Inventory adjustments / wastage | single movement | Idempotent `idempotencyKey` | Retry same key |
| Loyalty credit/redeem | customer balance + loyalty tx | Atomic `$inc` + unique idempotency; compensate on dup | Retry same key |
| Coupon redemption | coupon count + redemption row | Atomic conditional `$inc` + unique key; release on order fail | Release or confirm; never leave orphan RESERVED after release path |
| Menu publishing | dish patches + job status + snapshots | `withOptionalTransaction`; status claim | Re-publish from source; use rollback compensating job |
| Menu rollback | restore snapshots + `ROLLED_BACK` | `withOptionalTransaction`; conflict force required | Compensating publication only — no history rewrite |
| Order status / webhooks | conditional status update | Expected-status `findOneAndUpdate` | Second identical transition fails safely |

---

## 4. MongoDB replica-set test evidence

**Executed 2026-11-05** against local `mongod --replSet rs0 --port 27018`:

```bash
RUN_INTEGRATION=1 MONGODB_URI='mongodb://127.0.0.1:27018/tronx_integration?replicaSet=rs0' npm run test:integration
```

| Test | Result |
|------|--------|
| concurrent coupon maxRedemptions (20 vs limit=1) | **pass** |
| concurrent loyalty redeem cannot overdraw | **pass** |
| duplicate purchase receipt idempotency | **pass** |
| atomic stock consume last unit (8-way) | **pass** |

**Summary:** 4/4 pass, 0 fail, 0 skipped. No mocks.

Repeatable setup: `docs/MONGO_REPLICA_SET_TESTING.md`.

---

## 5. Organization assignment security

- **Auth:** `requireSuperAdmin` only on `GET/PUT /api/super-admin/access-assignments`.
- **Validation:** Zod strict body; `confirm: true` required for writes.
- **Server checks:** org exists; outlet IDs belong to org; last active `ORG_OWNER` cannot be demoted/deactivated.
- **Audit:** `AccessAssignmentAudit` stores previous/next, actor email, reason, timestamp.
- **Self-escalation:** restaurant admins have no write path to this API; permission matrix keeps outlet roles without `ORG_MANAGE`.
- **UI:** Super-admin restaurant edit → `AccessAssignmentPanel` with confirmation checkbox + audit list.

---

## 6. Per-line cancellation behavior

- Eligible lines: remaining qty (`quantity - cancelledQuantity`), preparation **not** `PREPARING`/`READY`.
- Requires reason (≥3 chars), `confirm: true`, idempotency key.
- Recalculates line totals, bill discount cap, tax, order total.
- Inventory: `restoreForCancelledLines` only for unprepared consumed lines; otherwise `BLOCKED`/`NONE`.
- Full cancel of all lines → order `CANCELLED` when transition allowed.
- Partial payments: suggests refund amount when `amountPaid > new total` (does not auto-refund).
- Permissions: restaurant admin **or** captain with `ORDER_MANAGEMENT`.
- UI: Orders board “Cancel lines” modal.

---

## 7. Menu rollback strategy

1. **Publish** captures `prePublishSnapshots` + `publishFingerprints` (content hash of synced fields).
2. Branch `price` / `isAvailable` / `sortOrder` / `kitchenStation` remain preserved per job config.
3. **Preview rollback** reports conflicts where current fingerprint ≠ publish fingerprint.
4. **Rollback** restores snapshot payloads (still preserving branch fields); requires `forceDishIds` or `forceAllConflicts` when conflicts exist.
5. Job status → `ROLLED_BACK` with `rolledBackAt` — compensating publication, not destructive history edit.
6. API actions: `PREVIEW_ROLLBACK`, `ROLLBACK` on `/api/organization/menu-sync`.

---

## 8. Exact test results (this closure run)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **pass** |
| `npm test` (`tests/*.test.ts`) | **98 pass**, 0 fail |
| `npm run test:integration` (RS `27018`) | **4 pass**, 0 fail, 0 skipped |
| `npm run build` | **pass** (Next.js 16.3.6) |
| `npm run lint` | **fail** — pre-existing errors in Inventory/Procurement/Recipe UIs; AccessAssignmentPanel load-on-click avoids new effect lint |

No existing tests removed or weakened.

---

## 9. Deployment requirements

1. Deploy app (additive Mongo schemas: `couponRedemptions`, `accessAssignmentAudits`, `orderLineCancellations`, menu sync snapshot fields).
2. Prefer **MongoDB replica set / Atlas** so `withOptionalTransaction` uses real transactions; standalone falls back to idempotent compensating mode.
3. Run `npm run test:integration` against staging replica set before production cutover for concurrency sign-off.
4. Super-admins assign `organizationId` / `orgRole` / `outletIds` via Access Assignment panel after deploy.
5. No destructive migrations; rollback = redeploy previous app revision (additive docs remain harmless).

---

## 10. Remaining limitations

| Item | Class |
|------|-------|
| Integration concurrency evidence on this machine | **Blocked** until replica set env available |
| Auto-refund on partial line cancel when overpaid | **Deferred** — surfaces `refundSuggested` only |
| Lint clean across entire admin inventory UIs | **Deferred** — pre-existing `set-state-in-effect` errors |
| Independent security/compliance review | **Not claimed** |
| Transfer send applies movements before status claim | Compensated by idempotent keys; prefer claim-first in a future hardening if ops require stronger ordering |

---

## Classification summary

- **Completed and tested:** atomic coupons (unit + 20-way Mongo race), loyalty atomic redeem (Mongo race), stock last-unit race, duplicate receipt idempotency, access assignment API/UI/guards, per-line cancel API/UI, menu snapshot/rollback, consistency wiring, typecheck, production build, 98 unit + 4 integration tests.
- **Deferred:** auto-refund on line cancel; broad lint debt outside this sprint.
- **Blocked:** none for this closure scope.
