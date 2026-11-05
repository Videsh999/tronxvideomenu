# Multi-Connector Architecture (Phase 6.3)

## Overview

TRONX supports multiple local Windows connectors per organization and outlet. Each connector is an authenticated edge agent that polls for print jobs assigned to its devices and delivers ESC/POS bytes to network printers.

## Identity & tenancy

| Rule | Detail |
|------|--------|
| Binding source | Pairing record only — never client-supplied `restaurantId` / `outletId` |
| Credentials | Connector secret shown once; stored hashed server-side |
| Secrets in browser | Never — rotate returns secret once to authorized admin session |
| Revocation | Status `REVOKED` + credential rotation; poll/heartbeat rejected |

## Lifecycle

1. Admin creates pairing code (`POST /api/devices/connectors/pairing`) — rate limited.
2. Connector claims code → receives `connectorId` + `connectorSecret` + seed printers.
3. Admin configures printer IP/role and may reassign devices to other connectors in the same outlet.
4. Connector heartbeats + polls; jobs claimed atomically with lease TTL.
5. Admin may rotate credentials or revoke.

## States

| Display | Meaning |
|---------|---------|
| ONLINE | Recent heartbeat; assigned devices healthy |
| DEGRADED | Online but one or more assigned devices unhealthy/error |
| OFFLINE | Heartbeat stale |
| REVOKED | Administratively disabled |

## Job claiming

- Only jobs for devices with `configuration.connectorId === this connector` are visible.
- Claim uses `findOneAndUpdate({ status: QUEUED }) → PROCESSING` with `leaseConnectorId` + `leaseExpiresAt`.
- Expired leases are recovered to `QUEUED` before poll.
- Two connectors cannot hold the same job.

## Failure handling

| Outcome | Behavior |
|---------|----------|
| COMPLETED | Lease cleared; `lastSuccessfulJobAt` updated |
| FAILED | Lease cleared; admin may retry or authorized fallback |
| UNKNOWN / MANUAL_REVIEW | No auto-retry; no auto dual-print |
| Connector offline | Jobs remain QUEUED; POS/KDS never blocked |
