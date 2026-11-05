# Printer Routing Guide

> Full Phase 6.3 detail: see **`DEVICE_ROUTING_GUIDE.md`**.

## Receipt printers

Selection order (`routeReceiptPrinter`):

1. Enabled CONNECTOR / physical printers with role `RECEIPT` (or legacy unset), preferring `isDefault`
2. Other primary-pool receipt printers (excludes `SECONDARY_RECEIPT`)
3. Simulators only if no physical device exists

Warnings are returned when the primary printer is offline, missing host IP, or unassigned from a connector.

**Fallback** (`configuration.isFallback` or role `SECONDARY_RECEIPT`) is advertised for authorized retry — TRONX does **not** auto-print the same receipt to two printers. Use `POST /api/devices/jobs/:id/fallback`.

## Kitchen (KOT) printers

Selection for station S (`routeKotPrinter`):

1. Enabled printer with `kitchenStation === S` (BAR also matches `printerRole === BAR`)
2. Else MAIN station printer
3. Else any kitchen printer

Duplicate station tickets are not sent unless multiple stations appear on the order (one job per distinct station).

## Order safety

Print enqueue failures never block payment recording or KDS status transitions.
