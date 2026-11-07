# ADR 0001 — Tenancy: organization and outlet

- Status: Proposed
- Date: 2026-11-07
- Author: TRONX BACKEND ENGINEER (pending CTO confirmation)

## Context

Operational documents use `restaurantId` as the outlet key. `organizationId` is optional and groups outlets. There is no database-per-tenant and no Mongo row-level security. Authorization is application filters. The proxy checks that some role cookie exists. It does not check the outlet. Handlers that forget the outlet check are an IDOR.

## Decision

The customer of TRONX is the organization. The outlet is the `restaurants` document. Every read and write of outlet data takes an outlet id that the caller has already been allowed to use. The client does not expand that set by sending a different `restaurantId` or `organizationId`.

Cross-outlet reads return 404 or 403. Tests cover order, dish, customer, loyalty profile, and print job. Stream A owns the matrix. Each API owner adds the case for their routes. Stream M runs them on the synthetic demo seed.

Mongoose will not add this isolation by itself. Indexes that include `restaurantId` are part of Stream H's staged index rollout (ADR 0004 and the schema section of the architecture doc).

## Consequences

Repositories grow a required outlet argument. A query helper that refuses a missing `restaurantId` is H and B's shared patch, landed by the owner of `lib/repositories/types.ts` (H) one change at a time. Super admin remains the only role that lists every outlet, and that path stays on `/api/super-admin/**` and super-admin restaurant routes.
