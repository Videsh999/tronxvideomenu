# Captain Portal 2.0 — Progress report (Stages A–C)

**Date:** 2026-11-05

## Shipped

### POS repair
- Place buttons respect full `canPlaceOrder()` (table required for dine-in).
- CLOSED tables removed from POS picker.
- Idempotency key reused for retries; rotated after success.
- Proxy `floor` class lets captains hit POS create + payment + cancel-lines.
- See `POS_ORDER_CREATION_BUGFIX_REPORT.md`.

### Captain management & assignment
- Captain fields: `employeeCode`, `assignedTableIds`, `lastActiveAt`.
- Exclusive table assignment + history collection.
- Admin UI: per-captain table checkboxes + save.
- Guides: `CAPTAIN_TABLE_ASSIGNMENT_GUIDE.md`.

### Captain order placement
- Route: `POST /api/captain/orders` → shared `createPosOrder` → optional send to kitchen.
- UI: `/captain/[slug]/take-order` (phone optional).
- Nav: Take order tab.
- Tables view filtered to assigned tables.
- Workflow: `CAPTAIN_ORDER_WORKFLOW.md`.

## Tests
- `tests/api-proxy-authz.test.ts` — floor class
- `tests/captain-order-schema.test.ts`
- `tests/captain-assignment.test.ts`
- Existing POS schema tests still pass

## Remaining (Stages D–E)
- Bill request / service request boards
- Richer live dashboard metrics
- Captain demo seed + full integration matrix
- `CAPTAIN_TEST_RESULTS.md` expansion after demo validation
