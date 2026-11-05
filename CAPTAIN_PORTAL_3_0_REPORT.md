# Captain Portal 3.0 — Delivery Report

## What changed

### Routes
- `/captain/[slug]/approvals` — Pending Approvals queue (new)
- Nav: Dashboard · My Tables · New Order · **Approvals** · Active · Kitchen · Requests · Shift
- Dashboard metrics link into filtered operational pages; includes **Pending approvals**

### Authorization
- `captainAuthorization` on orders (`PENDING_CAPTAIN_APPROVAL` → approve/reject/correction)
- QR `createPublic` always pending approval
- Captain direct → `CAPTAIN_APPROVED` + kitchen
- POS → `NOT_REQUIRED`
- Server gate in `acceptToKitchen` / kitchen list / status transitions

### APIs
- `GET /api/captain/approvals`
- `POST /api/captain/orders/[orderId]/authorize`

### Docs
- `CAPTAIN_AUTHORIZATION_ARCHITECTURE.md`
- `ORDER_APPROVAL_WORKFLOW.md`
- `KOT_AUTHORIZATION_RULES.md`
- `CAPTAIN_E2E_TEST_REPORT.md` (unit coverage; full Atlas demo TBD)

## Tests
See `CAPTAIN_E2E_TEST_REPORT.md` / `tests/captain-authorization.test.ts`.

## Limitations
- Screenshots require local login capture.
- Manager backup captain = table reassignment (existing Captains admin), not a separate backup field.
- Correction flow expects a new/corrected submission; no customer in-app edit loop yet.
- Full `tsc`/`next build` should be re-run in CI/local after pull.
