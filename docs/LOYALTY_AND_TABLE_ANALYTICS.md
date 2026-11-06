# Optional loyalty + table analytics

## Privacy rules

- QR ordering never asks for name, phone, or password.
- Loyalty signup/login is optional (Rewards button on the guest menu).
- Table analytics never include guest PII — only table number, order counts, sales, and top dishes.

## Loyalty (opt-in)

1. Guest opens **Rewards** on `/menu/[slug]` (plan must include `CRM_LOYALTY`).
2. Register with name, phone, email, password — or sign in later.
3. Forgot password issues a one-hour reset token; until SMTP is wired, the API may return `resetPath` once.
4. Reset page: `/menu/[slug]/loyalty/reset?token=…`
5. While signed in, new QR orders attach `customerId`. Points earn on **full payment** via `crmService.earnForOrder` (idempotent).

APIs under `/api/public/loyalty/*` (register, login, logout, me, forgot-password, reset-password).

## Table analytics

- Admin Reports dashboard: busiest table + performance table (no guest fields).
- Captain **My Tables**: assigned-table stats from `/api/captain/table-stats`.
- Shared math: `lib/analytics/tables.ts` → `reportingService.tablePerformance`.
