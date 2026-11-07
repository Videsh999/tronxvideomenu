# ADR 0003 — Billing snapshots

- Status: Proposed
- Date: 2026-11-07
- Author: TRONX BACKEND ENGINEER (pending CTO confirmation)

## Context

`calculateRestaurantBill` is the GST, packaging, and service-charge function. `computeBillTotals` is a second, narrower function still used by the POS screen, the captain order pad, and line cancel. `appendItemsToOrder` re-resolves the GST rate of every existing line from the live menu (`lib/services/order.service.ts:750-770`) even though unit prices on those lines are already snapshotted.

## Decision

Stream B owns `lib/billing/**` and `lib/order-pricing.ts`. Callers, including Stream C, import the contract and do not edit it.

When a line is created, freeze:

- unit price, add-on unit prices, and line total
- the GST rate applied to that line

When an order is created, freeze inside `billSnapshot` the price mode, packaging rule, service-charge rule, supply type, and outlet default rate used for that check.

Append:

- does not re-rate or re-price existing lines
- prices only the new lines from the current menu
- recomputes order-level packaging and service charge from the frozen settings, not from whatever the outlet settings are today
- writes `total`, tax split, packaging, service charge, and `billSnapshot` together

A manager "reprice open check" action may apply current settings later. It is explicit, audited, and separate from append and from cancel.

Cancel uses the same frozen rates and frozen order settings. It does not call `computeBillTotals`.

## Consequences

Screens show the same numbers the server will store. Historical reports stay stable when a dish's tax rate changes. Tests that only call one calculator in isolation are not enough; the append snapshot test in the architecture doc is required.
