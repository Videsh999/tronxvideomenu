# Order history audit

The table-session data path already stores independent orders and queries them by the immutable `tableSessionId`:

- `orderService.createPosOrder` creates a new `order-${randomUUID()}` record for every Captain/POS submission.
- `TableSessionRepository.listOrders` reads every order for the session, ordered by `createdAt`.
- `TableSessionService.overview` returns that complete list to the table workspace.

The observed Chai/Samosa replacement was therefore caused by the Captain table UI presenting only a single `activeOrder` in the main content area. The server also computes `activeOrder` as the latest non-terminal order for workflow actions. That selection is useful for actions, but it is not a history view and made the earlier order appear to disappear. The new Complete order history section renders the full `overview.orders` list, preserves each order's item snapshots, and provides status filters. No previous order is updated when a new order is submitted.

The authoritative session key remains `tableSessionId` plus `serviceLocationId`; table numbers are display snapshots only.
