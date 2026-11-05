# Captain Portal — Gap Analysis (vs deployed experience)

**Inspected:** `/captain/[slug]/tables`, `/captain/[slug]/orders`, `/captain/[slug]`, prior Stage A–C APIs  
**Date:** 2026-11-05

## What the user still sees (problem)

| Screen | Current UX | Required UX |
|--------|------------|-------------|
| Tables | Explicit **“Table availability and status are read-only.”** cards with status only | Interactive floor: open workspace, take order, bill request, cleaning |
| Orders | Incoming queue: Accept / Record payment / Cancel | Table-centric ops + kitchen tracking + add items |
| Dashboard | 2–3 stat cards + links to Orders/Tables | Assigned/occupied/ready/delayed/requests + quick actions |
| Navigation | Dashboard · Take order · Orders · Tables | Dashboard · My Tables · New Order · Active Orders · Kitchen · Requests · Shift |
| Take order | Standalone pad exists but not table-workspace-first | Open from table → New Order / Add items |

## Why previous work felt incomplete

1. **Backend/API ahead of UI** — assignment + `POST /api/captain/orders` shipped, but Tables page still marketed as read-only.
2. **Take-order was a side route** — not the primary table workflow.
3. **No table workspace** — no single screen for session, order, KOT, bill, requests.
4. **Orders page unchanged** — still a restaurant-wide queue, not “my tables / active service”.
5. **Dashboard not rebuilt** — still the old greeting + 3 cards.
6. **No billing settings** — tax still a single `taxRatePercent` field.

## This milestone corrects that by

- Replacing Tables/Orders/Dashboard UI surfaces.
- Adding `/captain/[slug]/tables/[tableId]` workspace.
- Making New Order open from the table (and from nav).
- Adding Admin `/settings/billing` + shared billing calculator.
- Keeping shared `createPosOrder` / order state machine (no second pipeline).

## Status after implementation

| Gap | Status |
|-----|--------|
| Read-only tables copy | Removed — interactive My Tables |
| No table workspace | Added `/tables/[tableId]` |
| Orders-only queue UX | Active orders scoped + workspace primary |
| Dashboard rebuild | Live assigned-table metrics |
| Nav ops structure | Dashboard / My Tables / New Order / Active / Kitchen / Requests / Shift |
| Billing settings | `/admin/[slug]/settings/billing` |
| Shared calculator | POS + Captain + QR |
