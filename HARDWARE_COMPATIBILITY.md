# Hardware Compatibility

## Verification statuses (Phase 6.3)

| Status | Meaning |
|--------|---------|
| `SIMULATED` | Virtual device / in-process adapter |
| `IMPLEMENTED_NOT_VERIFIED` | Delivery path coded + automated tests; **not** on-site proven |
| `PHYSICALLY_VERIFIED` | Requires documented on-site paper/device evidence |
| `UNSUPPORTED` | Not implemented (stub only) |

Legacy labels `ADAPTER_IMPLEMENTED` / `AUTOMATED_TESTED` normalize to `IMPLEMENTED_NOT_VERIFIED`.

## Phase 6.x status

| Interface | Simulator | Real hardware from cloud browser | Connector path | Status |
|-----------|-----------|----------------------------------|----------------|--------|
| ESC/POS thermal (network) | Yes | Not from browser | TCP :9100 | `IMPLEMENTED_NOT_VERIFIED` |
| USB printer | Simulator only | **Not from browser** | Winspool stub | `UNSUPPORTED` |
| Bluetooth printer | Virtual only | **Not claimed** | Not implemented | `UNSUPPORTED` |
| Cash drawer (printer kick) | Simulator + kick bytes | Via printer pin | ESC/POS kick | `IMPLEMENTED_NOT_VERIFIED` |
| Barcode (keyboard wedge) | Simulator + POS wedge | Browser key events | N/A (host wedge) | `IMPLEMENTED_NOT_VERIFIED` |
| Payment terminal SDK | Virtual non-settling | Not integrated | Future PSP | `UNSUPPORTED` (SDK) |
| Customer display | Virtual | Later | Planned | `SIMULATED` |

## Explicit non-claims

- Registering a **SIMULATOR** device does **not** mean a physical printer/drawer/terminal is attached.
- A **SIMULATED** payment approval is **not** a bank or card settlement.
- This cloud deployment does **not** open USB or Bluetooth devices from the admin browser tab.
- A successful job `COMPLETED` ack without on-site confirmation does **not** authorize `PHYSICALLY_VERIFIED`.
- USB / Bluetooth configuration options do **not** imply full support.

## Feature flags

| Flag | Purpose |
|------|---------|
| `HARDWARE_SIMULATOR` | Virtual devices + dashboard controls |
| `HARDWARE_PRINTING` | Print job APIs / receipt & KOT enqueue |
| `HARDWARE_CASH_DRAWER` | Drawer commands |
| `HARDWARE_BARCODE` | Scanner commands |
| `HARDWARE_PAYMENT_TERMINAL` | Terminal simulation / future SDK |
| `HARDWARE_CUSTOMER_DISPLAY` | Customer-facing display updates |
| `HARDWARE_LOCAL_CONNECTOR` | Pairing, connector APIs, physical job delivery |

Default plan matrix: **ENTERPRISE** (overrides supported).

## Multi-device fleet

Multiple printers and connectors per outlet are supported. See `MULTI_PRINTER_SETUP_GUIDE.md`, `MULTI_CONNECTOR_ARCHITECTURE.md`, and `DEVICE_ROUTING_GUIDE.md`.

## Recommended rollout

1. Enable simulator flags; register sample devices; validate print jobs and alerts.
2. Pilot local connector on one POS PC with one network ESC/POS printer.
3. Add station printers and a second connector only after first pilot paper evidence.
4. Expand drawer + scanner through the same connector.
5. Add payment terminal only with PSP certification and ledger-safe settlement mapping.
