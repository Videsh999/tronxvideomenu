# Phase 6.1 — Local Device Connector

**Status:** Executed — see `PHASE_6_1_REPORT.md`  
**Builds on:** Phase 6.0 device registry, print queue, simulator adapters, POS/KDS hooks  
**Constraint:** Do not rebuild registry/queue/POS/KDS. Simulator remains available.

## Audit reuse

| Capability | Reuse | 6.1 addition |
|------------|-------|--------------|
| Device registry / RBAC | `device.service`, `OUTLET_DEVICES_MANAGE` | Connector + physical device records (`adapterType: CONNECTOR`) |
| Adapter contract | `DeviceAdapter` | `ConnectorCloudAdapter` (cloud side) + local ESC/POS in `device-connector/` |
| Print jobs | `printJobs` dedupe/retry | Statuses `UNKNOWN`, `MANUAL_REVIEW`; connector ack path |
| POS/KDS enqueue | `tryEnqueueReceipt/Kot` | Prefer CONNECTOR printers when online; still non-blocking |
| Features | `HARDWARE_*` | `HARDWARE_LOCAL_CONNECTOR` |
| Dashboard | `/admin/[slug]/devices` | Pairing, connector health, physical vs simulated |

## Integration model

```
POS/KDS → device.service → printJobs (QUEUED)
                              ↓
                    connector poll (TLS, authenticated)
                              ↓
                 device-connector (Windows) → ESC/POS TCP / drawer kick
                              ↓
                    job ack: COMPLETED | FAILED | UNKNOWN | MANUAL_REVIEW
```

Cloud never opens USB. Browser never talks to printers. Connector only runs predefined operations.

## Sequence

1. Plan (this file)  
2. Cloud pairing + connector credentials + job poll/ack APIs  
3. `device-connector/` foundation (pair, poll, heartbeat, local job store)  
4. Network ESC/POS + cash drawer kick  
5. Offline persistence / uncertain outcomes  
6. Keyboard-wedge barcode (POS hook)  
7. USB adapter contract (honest limitation if unverified)  
8. Dashboard + packaging docs + tests  

## Environment-dependent limitations (expected)

- Real ESC/POS test print requires a reachable network printer — CI uses virtual TCP mock.  
- USB Win32 printing is documented as adapter contract unless verified on Windows hardware.  
- Physical drawer open confirmation requires hardware feedback (usually unavailable).  
