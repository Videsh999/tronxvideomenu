# ESC/POS Compatibility

## Evidence classes

| Status | Meaning |
|--------|---------|
| SIMULATED | In-process simulator |
| ADAPTER_IMPLEMENTED | Code path exists |
| AUTOMATED_TESTED | Unit/TCP mock tests passed |
| PHYSICALLY_VERIFIED | On-site pilot with paper confirmation |
| UNSUPPORTED | Not available / stub only |

**No profile is PHYSICALLY_VERIFIED in this release** — no physical printer was available during development.

## Capability flags

Configured per device (`configuration.capabilities`):

- `cut`, `bold`, `align`, `qrCode`, `barcode`, `drawerKick`, `codePage`

Disabled capabilities are skipped and listed in preview `unsupported[]`. QR falls back to a text reference line.

## Paper widths

- **58mm** → 32 characters/line  
- **80mm** → 42 characters/line  

## Encoding

`ascii` (default, safest), `utf8`, `cp437` (best-effort mapping).

## Registry

See `lib/devices/compatibility-registry.ts` and Devices → compatibility API.
