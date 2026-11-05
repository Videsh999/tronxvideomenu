# Captain table assignment guide

## Goal
Distribute outlet tables among captains without hard-coded limits (e.g. 5 / 10 / 8 is manager choice only).

## Manager steps
1. Open **Admin → Captains**.
2. Create captains (name, email, password).
3. Under each captain, tick tables → **Save table assignment**.
4. Unassigned tables are listed at the top of the Captains page.

## Rules
- One table → one active captain (default exclusive mode).
- Saving assignment A with table T removes T from other captains in the same outlet.
- Occupied table reassignment does **not** cancel or rewrite existing orders.
- Every change is written to `captainTableAssignmentEvents` (who / when / added / removed).
- Captains with **zero** assigned tables cannot place walk-in orders until assigned.

## Captain view
- **My tables** shows only assigned tables.
- **Take order** only lists assigned, non-CLOSED tables.

## API
- `PUT /api/admin/captains/:id/tables` `{ tableIds: string[], note?: string }`
