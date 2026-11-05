# Phase 6.3 Report — Multi-Device & Multi-Connector Fleet Management

**Status:** Complete (software). Physical verification still requires on-site hardware.  
**Date:** 2026-11-05  
**Builds on:** 6.0 simulator · 6.1 connector · 6.2 reliability

## What was implemented

1. **Multi-printer fleet** — `printerRole` (`RECEIPT` / `SECONDARY_RECEIPT` / `KITCHEN` / `BAR` / `OTHER`) with validation against device type and kitchen station.
2. **Multi-connector fleet** — inventory with ONLINE / OFFLINE / DEGRADED / REVOKED; device↔connector assignment limited to same outlet; secrets never returned in list APIs.
3. **Atomic job leases** — `leaseConnectorId` + `leaseExpiresAt`; expired lease recovery before poll; single winner on concurrent claim.
4. **Deterministic routing** — role-aware receipt/KOT routing; no automatic dual-print; authorized fallback endpoint.
5. **Devices dashboard** — fleet summary, search/filters, register printer, assign connector, role/station config, fallback action on failed jobs.
6. **Compatibility honesty** — `IMPLEMENTED_NOT_VERIFIED` status; no fabricated `PHYSICALLY_VERIFIED`.
7. **Tests + docs** — unit fleet suite; integration lease suite (replica-set gated); architecture/ops guides.

## Files & architecture changed

| Area | Paths |
|------|--------|
| Types | `lib/devices/device.types.ts` (`PrinterRole`, lease fields, `PRINT_JOB_LEASE_MS`) |
| Roles / routing | `lib/devices/printer-roles.ts`, `lib/devices/printer-routing.ts` |
| Fleet service | `lib/services/device-fleet.service.ts` |
| Device / connector services | `lib/services/device.service.ts`, `lib/services/connector.service.ts` |
| Repositories | `lib/repositories/connector.repository.ts`, `lib/repositories/device.repository.ts` |
| Models | `lib/db/models.ts` (`printerRole`, `lastSuccessfulJobAt`, lease indexes) |
| APIs | `POST /api/devices`, `GET /api/devices/fleet`, `POST|DELETE /api/devices/[id]/assign`, `POST /api/devices/jobs/[id]/fallback` |
| UI | `components/admin/DevicesManager.tsx` |
| Auth helper | `lib/devices/device-api-auth.ts` |
| Compatibility | `lib/devices/compatibility-registry.ts` |
| Validations | `lib/validations/index.ts` |
| Tests | `tests/device-fleet.test.ts`, `tests/integration/print-job-lease.test.ts` |
| Docs | `PHASE_6_3_PLAN.md`, `PHASE_6_3_REPORT.md`, `MULTI_CONNECTOR_ARCHITECTURE.md`, `MULTI_PRINTER_SETUP_GUIDE.md`, `DEVICE_ROUTING_GUIDE.md`, `CONNECTOR_OPERATIONS_GUIDE.md`, `HARDWARE_PILOT_CHECKLIST.md`, `HARDWARE_COMPATIBILITY.md` |

## Database / model changes

- `hardwareDevices.printerRole` enum + index `(restaurantId, outletId, printerRole)`.
- `hardwareDevices.lastSuccessfulJobAt`.
- `printJobs.leaseConnectorId`, `leaseExpiresAt` + index `(status, leaseExpiresAt)`.
- Backward compatible: missing `printerRole` defaults via `defaultPrinterRole(deviceType)`.

**Migration:** No destructive migration. Existing devices continue to work; set roles via Devices UI when ready.

## API changes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/devices` | Register printer in fleet |
| GET | `/api/devices/fleet` | Device + connector inventory (secrets redacted) |
| POST | `/api/devices/:id/assign` | Assign device → connector (same outlet) |
| DELETE | `/api/devices/:id/assign` | Unassign connector |
| PATCH | `/api/devices/:id` | Now accepts `printerRole`; audits config changes |
| POST | `/api/devices/jobs/:id/fallback` | Authorized fallback reprint |

All require `OUTLET_DEVICES_MANAGE` + hardware feature flags.

## UI changes

`/admin/[slug]/devices`:

- Fleet summary counts and warning badges.
- Search + role/status filters.
- Register printer form (role, station, connector, host).
- Configure/assign editor with printer role + connector binding.
- Explicit **Fallback** on failed jobs (not on UNKNOWN/MANUAL_REVIEW).

## Security & RBAC

- Tenant/outlet checks on assignment and fallback.
- Pairing rate limit preserved.
- Credential hashes omitted from fleet/connector lists.
- Revoked connectors cannot authenticate.
- Audit events: `DEVICE_REGISTERED`, `DEVICE_ASSIGNED_CONNECTOR`, `DEVICE_UNASSIGNED_CONNECTOR`, `DEVICE_CONFIG_UPDATED`, `AUTHORIZED_FALLBACK_PRINT`.

## Test results

| Suite | Result |
|-------|--------|
| `npm run test:unit` | **161 pass / 0 fail** (includes new fleet tests) |
| `npm run test:integration` | **8 skipped** (no `RUN_INTEGRATION=1` / replica set in this environment) |
| `npm run typecheck` | **pass** |
| `npm run build` | **pass** (Next.js 16.3.6) |

Integration lease tests are ready: set `RUN_INTEGRATION=1` and `MONGODB_URI` to a replica set.

## Incomplete / honest limitations

- No on-site `PHYSICALLY_VERIFIED` hardware evidence in this environment.
- USB / Bluetooth remain `UNSUPPORTED` (stubs only).
- Payment terminal SDK unsettled / non-ledger (simulator only).
- Dual assignment of one printer to two connectors is an admin misconfiguration; claims stay atomic but ops should avoid it.

## Deployment steps

1. Deploy cloud app (schema fields are additive).
2. Ensure ENTERPRISE (or overrides) for hardware flags.
3. Pair Windows connector(s); configure IPs; assign roles/stations.
4. Run guided pilot; attach diagnostics; confirm paper before marking physically verified.

## Hardware still required for physical validation

- Windows POS PC with TRONX `device-connector`.
- ≥1 network ESC/POS printer (58mm or 80mm) on LAN port 9100.
- Optional second printer for station / fallback pilot.
- Optional second connector host for multi-connector failover drill.
