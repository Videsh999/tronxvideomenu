# Multiple Order Workflow

1. Resolve restaurant and service location by immutable ID.
2. Atomically find or open the active table session.
3. Create a new order with its own ID, order number, item snapshots, authorization gate and `tableSessionId`.
4. Keep the order under New until accepted.
5. Accepting runs the existing KOT/inventory path and moves only that order to Cooking.
6. Later QR or Captain submissions create additional orders; they never overwrite or append to the earlier database order.
7. Captain table workspace shows the session timeline, running total, paid amount and remaining balance.
8. Closing a fully paid session allows the same table to receive a new session for the next party.

Legacy `appendItemsToOrder` remains for explicit add-to-order operations, but Captain order submission no longer invokes it implicitly.
