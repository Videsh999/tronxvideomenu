# Phase 6.0 — Hardware Simulator & Device Connector Foundation

**Status:** Executed — see `PHASE_6_SIMULATOR_REPORT.md`  
**Constraint:** No physical hardware required. Do not rebuild POS/KDS. Business services talk only to device abstraction.

## Audit summary (reuse)

| Area | Existing | Phase 6 extension |
|------|----------|-------------------|
| POS checkout / pay | `order.service`, `PosTerminal`, `/api/pos/*` | Enqueue receipt jobs after pay/reprint; never block on device failure |
| KOT today | Browser `lib/kot-print.ts` | Keep browser path; add server print jobs via kitchen printer adapter |
| KDS stations | `KitchenStation` on lines | Route KOT jobs by station → device assignment |
| Payments | Ledger CHARGE/REFUND | Terminal **simulator events only** — never write ledger as bank settlement |
| RBAC | `requireOutletPermission`, `OrgPermission` | Add `OUTLET_DEVICES_MANAGE`; tenant-isolate devices |
| Features | `FeatureKey` / `PLAN_ENTITLEMENTS` | Add `HARDWARE_*` (ENTERPRISE; overrides allowed) |
| Admin UI | AI shell / Inventory managers | `/admin/[slug]/devices` + Devices panel |
| Persistence | Mongoose models | `devices`, `printJobs`, `deviceEvents` |

## Architecture

```
POS / KDS / Admin UI
        ↓
 device.service (RBAC, feature flags)
        ↓
 device-manager → device-registry → DeviceAdapter (interface)
        ↓
   simulator/*  |  future: printer/cash-drawer/… / local connector
```

Cloud browser sessions **never** claim USB/Bluetooth connection. Real hardware requires a future local **TRONX Device Connector** implementing the same adapter contract.

## Sequence

1. Types, interfaces, registry, manager, health, events, jobs, permissions  
2. Simulator adapters (receipt, kitchen, drawer, barcode, terminal, customer display)  
3. Mongo models + repositories + service + APIs  
4. Feature flags + sidebar  
5. Devices dashboard + test controls  
6. POS receipt + KDS station print hooks (non-blocking)  
7. Tests + docs (`DEVICE_ARCHITECTURE`, `DEVICE_ADAPTER_GUIDE`, `HARDWARE_COMPATIBILITY`, `PHASE_6_SIMULATOR_REPORT`)

## Non-negotiables

- Simulated payments ≠ real financial records  
- Simulated devices labeled `SIMULATED` / adapterType `SIMULATOR`  
- Device failure must not break order create / payment record  
- Replaceable adapters; no POS→simulator imports  
