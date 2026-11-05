# Device Architecture

## Goals

- POS, KDS, inventory, and order services never import simulator (or future physical) implementations.
- All hardware I/O goes through `DeviceAdapter`.
- Cloud browser sessions never claim USB/Bluetooth attachment.
- Simulated devices and payments are unmistakably labelled and do not contaminate financial ledgers.

## Layers

```
Admin / POS / KDS
       │
 device.service  (RBAC, feature flags, persistence)
       │
 device-manager  (timeouts, adapter resolve)
       │
 device-registry → DeviceAdapter
       │
  SIMULATOR | ESC_POS | CONNECTOR | SDK   (future)
```

## Core modules

| Module | Role |
|--------|------|
| `lib/devices/device.types.ts` | Shared contracts |
| `lib/devices/device-registry.ts` | Adapter map |
| `lib/devices/device-manager.ts` | Connect / command / health with timeout |
| `lib/devices/device-jobs.ts` | Print job draft + dedupe keys |
| `lib/devices/device-events.ts` | Auditable device events |
| `lib/devices/device-permissions.ts` | Feature ↔ device type + `OUTLET_DEVICES_MANAGE` |
| `lib/services/device.service.ts` | Registry CRUD, queue, POS/KDS helpers |
| `lib/repositories/device.repository.ts` | Mongo: `hardwareDevices`, `printJobs`, `deviceEvents` |

## Print jobs

Statuses: `QUEUED` → `PROCESSING` → `COMPLETED` | `FAILED` | `CANCELLED`.

- Unique `dedupeKey` per restaurant prevents duplicate prints from retried order events.
- Reprints use a distinct dedupe key (`isReprint` + nonce).
- Failed jobs are retained with `errorMessage`; authorized retry via API.
- Order create / payment **never** fails because a printer is offline.

## POS / KDS hooks

- After full payment: `tryEnqueueReceiptForOrder` (non-blocking).
- After kitchen accept: `tryEnqueueKotForOrder` (station-routed, non-blocking).
- Receipt reprint API still audits; also enqueues `REPRINT_RECEIPT` when a printer exists.
- Browser `lib/kot-print.ts` remains available as a fallback UX path.

## Local connector (Phase 6.1)

A restaurant POS PC runs **TRONX Device Connector** (`device-connector/`), pairs with a short-lived code, authenticates with hashed credentials, and polls `/api/connector/jobs`. Cloud `adapterType: CONNECTOR` devices stay queued until the connector acks. See `LOCAL_CONNECTOR_ARCHITECTURE.md`.
