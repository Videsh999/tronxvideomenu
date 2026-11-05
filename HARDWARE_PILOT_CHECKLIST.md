# Hardware Pilot Checklist

Use **Devices → Run hardware pilot (guided)** or `POST /api/devices/pilot`.

Automated software checks run immediately. Steps that need paper output stay `PENDING_PHYSICAL` until an administrator confirms. Successful API / queue responses are **not** physical verification.

## Phase 6.3 guided workflow

| # | Step | Automated? | Physical? |
|---|------|------------|-----------|
| 1 | Pair Windows connector | Partial (pairing API) | Confirm connector ONLINE |
| 2 | Register network ESC/POS printer | Yes (registry) | Confirm IP reachable from POS PC |
| 3 | Configure 58mm or 80mm width | Yes (preview) | Optional paper compare |
| 4 | Print test receipt | Yes (queue/ack) | Confirm paper |
| 5 | Print real POS receipt | Yes (enqueue) | Confirm paper |
| 6 | Print KOT to correct kitchen station | Yes (routing) | Confirm correct printer |
| 7 | Connector restart + network interruption | No | Required on site |
| 8 | Uncertain job recovery (`UNKNOWN` / `MANUAL_REVIEW`) | Partial | Confirm no auto-reprint |
| 9 | Export diagnostics + pilot evidence | Yes | Attach to pilot record |

## Legacy / additional checks

| # | Check | Automated? | Physical? |
|---|-------|------------|-----------|
| — | Consecutive queue | Yes | Confirm two tickets |
| — | Paper-out (if supported) | No | Required on site |
| — | Failure + manual / authorized fallback | Partial | Required on site |

## Verification status labels

| Status | Meaning |
|--------|---------|
| `SIMULATED` | In-process simulator only |
| `IMPLEMENTED_NOT_VERIFIED` | Code path exists; no on-site paper proof |
| `PHYSICALLY_VERIFIED` | On-site evidence recorded (do not set without evidence) |
| `UNSUPPORTED` | Stub / not implemented (USB, Bluetooth full path, etc.) |

## Record

- Device model / firmware  
- Windows OS version  
- Connector version  
- Date / admin  
- Pass/fail per step  
- Overall: do **not** mark `PHYSICALLY_VERIFIED` until paper steps pass  

## Current status

No physical printer was available during Phase 6.3 development. Registry entries remain `SIMULATED` / `IMPLEMENTED_NOT_VERIFIED` / `UNSUPPORTED` only.
