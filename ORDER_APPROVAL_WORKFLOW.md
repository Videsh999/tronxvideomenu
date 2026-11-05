# Order Approval Workflow

## QR customer

1. Scan table QR → place order.
2. Order saved as **Pending captain approval** (no KOT).
3. Assigned captain sees it under **Approvals**.
4. Captain reviews items / variants / notes / totals.
5. **Approve & send to kitchen** → authorization + KOT + KDS.
6. Or **Request correction** / **Reject** with reason → no kitchen.

## Captain walk-in

1. My Tables → table → Take Order (or New Order).
2. Build cart → **Confirm & authorize order**.
3. Shared `createPosOrder` with `CAPTAIN_APPROVED` → kitchen handoff.

## Duplicate protect

Re-approve returns 409. Same idempotency key is safe to retry.
