# ADR 0002 — Identity and per-handler auth contracts

- Status: Proposed
- Date: 2026-11-07

## Context

Session roles today are super admin, restaurant admin, and captain. One restaurant-admin account is unique per outlet. Customer loyalty uses a separate cookie. The device connector uses either a pairing code or a connector secret, depending on the route. The proxy currently classifies loyalty and all connector routes as staff, so none of those contracts run.

## Decision

Do not add a proxy class that requires a customer session for `/api/public/loyalty/*`.

| Handler | Edge | Credential |
| --- | --- | --- |
| Loyalty login, register, forgot-password, reset-password | Anonymous | Body credentials or reset token. No existing session. |
| Loyalty logout | Anonymous | Clears the customer cookie even when it is missing or expired. |
| Loyalty `GET /me` | Anonymous at the edge | Handler returns `data: null` without a customer cookie. |
| `POST /api/connector/pair` | Anonymous at the edge | One-time pairing code. No connector secret. Outlet comes from the code record. |
| Connector heartbeat, job poll, job ack | Anonymous at the edge | `x-connector-id` and `x-connector-secret`. Not a pairing code. |

Staff identity for the floor becomes many memberships per outlet: manager, cashier, kitchen, captain. That collection is H's schema, then D's consumers. Two managers, two cashiers, and three kitchen logins are not representable before that lands.

Credential policy, owned by D:

- Reset of a staff or customer password invalidates sessions for that account.
- Rotation of `CREDENTIALS_ENCRYPTION_KEY` and `WIFI_ENCRYPTION_KEY` includes re-encryption and a rollback that still decrypts the previous ciphertext until the cutover finishes.
- Showing a stored staff password is an audited action with a reason, or the reveal API is removed.
- Password-reset tokens are not returned in production response bodies.
- Super-admin passwords stay in the environment and rotate without a code change.

## Consequences

Stream A's tests name each handler. A single `customer` or `connector` class that treats every path under the prefix the same way fails those tests. Full-role demo QA waits for D and H.
