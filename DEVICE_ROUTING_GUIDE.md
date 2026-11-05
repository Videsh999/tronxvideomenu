# Device Routing Guide (Phase 6.3)

## Receipt routing

`routeReceiptPrinter(devices)`:

1. Candidates: `RECEIPT_PRINTER` with role `RECEIPT`, `SECONDARY_RECEIPT`, `OTHER`, or legacy unset.
2. Primary pool excludes `SECONDARY_RECEIPT`.
3. Prefer physical CONNECTOR adapters, then `configuration.isDefault`, then first enabled.
4. Fallback (not auto-printed): `isFallback` or `SECONDARY_RECEIPT`.

POS helper `tryEnqueueReceiptForOrder` enqueues **primary only** and may warn that a fallback exists.

## Kitchen / station routing

`routeKotPrinter(devices, station)`:

1. Match `KITCHEN_PRINTER` whose station equals the item station (case-insensitive).
2. For `BAR`, also accept `printerRole === BAR`.
3. If no dedicated station printer, fall back to MAIN, then any kitchen printer (with warning).
4. Fallback flag is returned for authorized retry only.

`tryEnqueueKotForOrder` loops **unique stations** and enqueues one job per station.

## Connector delivery

Jobs for `adapterType === CONNECTOR` stay `QUEUED` until an authenticated connector assigned to that device claims them.

## Authorized fallback

`POST /api/devices/jobs/:jobId/fallback` with `{ fallbackDeviceId }`:

- Requires `OUTLET_DEVICES_MANAGE`.
- Target must be marked fallback or `SECONDARY_RECEIPT`.
- Same outlet as original job.
- Blocked for `UNKNOWN` / `MANUAL_REVIEW` (manual review first).
- Creates a distinct reprint job (new dedupe key) — never mutates the original into a dual-print.

## Idempotency

Dedupe key: `print:{restaurant}:{order}:{jobType}:{station}`. Reprints use a unique nonce. Concurrent connectors cannot claim the same `QUEUED` row twice.
