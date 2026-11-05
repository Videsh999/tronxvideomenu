# Captain Table Assignment Guide

## Manager setup (Admin → Captains)

1. Create captain accounts (email + password).
2. Assign table document IDs to each captain (checkbox / bulk).
3. Assignments are **exclusive** — assigning a table to Captain B removes it from Captain A.
4. History is stored in `captainTableAssignmentEvents`.
5. Occupied tables are **not** auto-transferred; reassign only via manager action.

## Captain runtime

- Empty `assignedTableIds` → no floor tables / cannot place dine-in orders.
- `assertCaptainMayServeTable` guards order place + table workspace + requests.
- Dashboard / Active orders / Kitchen / Requests are scoped to assigned tables.

## Conflict prevention

- Repository `pullTableFromOthers` on save.
- UI in `CaptainManagement` shows unassigned tables and conflict warnings.
