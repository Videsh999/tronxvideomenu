# Captain Authorization Architecture

## Model

Authorization is stored on `RestaurantOrder.captainAuthorization` and is **separate** from kitchen `status`.

| `captainAuthorization.status` | Kitchen eligible? |
|-------------------------------|-------------------|
| `PENDING_CAPTAIN_APPROVAL` | No |
| `CORRECTION_REQUESTED` | No |
| `REJECTED` | No (order `status` → `REJECTED`) |
| `CAPTAIN_APPROVED` | Yes |
| `NOT_REQUIRED` | Yes (POS / legacy) |

`entrySource`: `CUSTOMER_QR` | `CAPTAIN_DIRECT` | `POS`

## Flows

### CUSTOMER_QR
1. `createPublic` → `status=PENDING`, `captainAuthorization=PENDING_CAPTAIN_APPROVAL`
2. Appears in assigned captain **Pending Approvals**
3. `POST /api/captain/orders/:id/authorize` APPROVE (atomic) → `CAPTAIN_APPROVED` → `acceptToKitchen` → KOT
4. REJECT / CORRECTION → no KOT

### CAPTAIN_DIRECT
1. Captain Confirm & authorize → `createPosOrder` with `source=CAPTAIN`, `CAPTAIN_APPROVED`
2. Immediate send-to-kitchen → KOT

### POS
1. `NOT_REQUIRED` — cashier policy unchanged; no captain gate unless configured later

## Server enforcement

- `acceptToKitchen` / kitchen-bound `updateStatus` refuse blocked authorization.
- `listKitchen` filters non-eligible orders.
- Authorize API checks table assignment via `assertCaptainMayServeTable`.
- Concurrent approve: Mongo `findOneAndUpdate` on expected authorization statuses → 409 to loser.
- Idempotency: same `decisionIdempotencyKey` returns current order.
