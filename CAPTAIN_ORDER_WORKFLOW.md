# Captain order workflow

## Walk-in (no phone)

1. Captain signs in → **Take order**.
2. Select an **assigned** table.
3. Browse / search menu → variants & add-ons → cart.
4. Optional guest name / phone / note (never required).
5. **Confirm & send to kitchen**.
6. Server creates the order via **`orderService.createPosOrder`** (same validation & pricing as POS).
7. Status advances to **PREPARING** (KOT enqueue via existing device pipeline).
8. Captain tracks progress under **Orders**.

## Authorization
- Table must be in the captain’s `assignedTableIds`.
- Outlet isolation via captain session restaurant id.
- Idempotency key prevents double submit on retries.

## What captains cannot do here
- Change unit prices.
- Bypass unavailable dishes.
- Refund / close cash without POS permissions (payment via existing shared payment API only when authorized).

## POS parity
POS staff continue to use `/admin/.../pos`. Both paths share `createPosOrder`.
