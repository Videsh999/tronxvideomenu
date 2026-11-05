# Phase 6.3 — Multi-Device & Multi-Connector Fleet Management

**Status:** Implemented (see `PHASE_6_3_REPORT.md`)  

**Builds on:** 6.0 simulator · 6.1 connector · 6.2 reliability  
**Constraint:** Extend existing registry/queue/routing; no second print pipeline; no POS/KDS rewrite.

## Audit reuse

| Capability | Existing | 6.3 gap |
|------------|----------|---------|
| Multiple devices per outlet | Mongo `hardwareDevices` | Explicit `printerRole`, registration API, filters |
| Station routing | `routeKotPrinter` | Role validation; BAR role ↔ BAR station rules |
| Connectors | Pairing + heartbeat | Multi-connector fleet inventory; device↔connector assign API |
| Job claim | `findOneAndUpdate` QUEUED→PROCESSING | Lease TTL + expired lease recovery; reclaim only assigned devices |
| Fallback | Config flag + warning | Explicit authorized fallback enqueue API |
| UI | DevicesManager | Inventory filters, assignment, health fleet view |
| Compatibility | Registry statuses | Align labels; keep no false PHYSICALLY_VERIFIED |

## Sequence

1. Types/models: `printerRole`, job lease fields, device audit events  
2. Atomic claim with lease expiry + recovery  
3. Assignment/reassignment APIs + RBAC  
4. Routing role validation + authorized fallback endpoint  
5. Fleet dashboard UI  
6. Tests (concurrent claim, revoke, cross-outlet) + docs  

## Non-claims

USB/Bluetooth remain unimplemented/stub. No physical verification without on-site evidence.
