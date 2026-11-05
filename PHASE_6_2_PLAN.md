# Phase 6.2 — Hardware Integration & Device Reliability

**Status:** Executed — see `PHASE_6_2_REPORT.md`  
**Builds on:** Phase 6.0 simulator + Phase 6.1 local connector  
**Constraint:** No rebuild of registry/queue/connector pairing. No physical verification claims.

## Audit — what exists

| Area | Status | Gap for 6.2 |
|------|--------|-------------|
| ESC/POS TCP send + UNKNOWN | Basic ASCII receipt/KOT | Capability flags, 58/80mm layout, encoding, QR optional, branding |
| Printer config UI | Command buttons only | IP/port/width/encoding/capabilities form + preview |
| Routing | Prefer CONNECTOR over sim | Outlet default, station map, fallback, offline warnings |
| Job lifecycle | QUEUED→… MANUAL_REVIEW | Correlation IDs, stronger idempotent claim/ack docs, disk-full handling |
| Cash drawer | Kick + auth | Associate printer, record reasons, simulator path |
| Barcode wedge | Enter-suffix SKU | Configurable suffix, inventory lookup path, help status |
| Diagnostics | Heartbeat fields | Exportable redacted bundle, disk/uptime |
| Compatibility | Docs only | Evidence-based registry (SIMULATED / ADAPTER_IMPLEMENTED / …) |
| Pilot mode | None | Guided checklist workflow (admin-initiated) |
| Windows packaging | Docs + installer notes | Reproducible packaging script; unverified on Windows |

## Sequence

1. Capability-aware ESC/POS builders + automated TCP mock tests  
2. Printer config validation + dashboard editors + preview  
3. Intelligent routing + fallback warnings  
4. Job correlation / recovery hardening (connector local store)  
5. Drawer + barcode harden  
6. Diagnostics export + compatibility registry + pilot workflow  
7. Docs + full verification  

## Evidence classes (mandatory)

- **SIMULATED** — in-process simulator  
- **AUTOMATED_TESTED** — unit/TCP mock  
- **PHYSICALLY_VERIFIED** — only after admin pilot with real hardware (none yet)  
