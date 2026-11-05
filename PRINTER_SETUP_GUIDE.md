# Printer Setup Guide

## Supported in Phase 6.1 (verified path)

**Network ESC/POS** printers reachable via TCP (commonly port **9100**).

Configuration on the device record (`configuration`):

| Field | Example | Notes |
|-------|---------|-------|
| `host` | `192.168.1.50` | Required |
| `port` | `9100` | Default 9100 |
| `paperWidth` | `80` | mm hint for layout |
| `encoding` | `utf8` | Best-effort; many printers are ASCII/CP437 |

### Test print

1. Ensure connector is **ONLINE**.
2. Set printer `host`/`port` on the physical device.
3. Enqueue a `TEST_PAGE` job (Devices → Test print on a CONNECTOR printer, or POS receipt after configure).
4. Confirm paper output at the printer.

### Kitchen printers

Bind `kitchenStation` (`MAIN`, `BAR`, …). KOT jobs route by station.

## Cash drawer

Drawer opens via ESC/POS kick through the **associated network printer**.  
Authorization required (`authorized: true`). Physical open is **not verified** unless hardware provides feedback.

## USB printers

USB support is an **adapter contract only** in this release (`UnsupportedUsbPrinterAdapter`).  
Do not claim USB printing works until verified on the target Windows POS with a signed raw-print path.

## Compatibility caveats

- ESC/POS dialects differ; generic init/text/cut/drawer commands are used.
- Cut commands may be ignored on some models.
- After a TCP write timeout, the connector marks `UNKNOWN`/`MANUAL_REVIEW` — check the printer before reprinting receipts.
