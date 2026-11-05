# Multi-Printer Setup Guide (Phase 6.3)

## Goals

Configure multiple printers per outlet with explicit roles and kitchen stations without accidental dual-printing.

## Printer roles

| Role | Device type | Typical use |
|------|-------------|-------------|
| `RECEIPT` | RECEIPT_PRINTER | Primary customer receipt |
| `SECONDARY_RECEIPT` | RECEIPT_PRINTER | Authorized fallback / second counter |
| `KITCHEN` | KITCHEN_PRINTER | Station KOT (MAIN, DESSERT, custom) |
| `BAR` | KITCHEN_PRINTER | BAR station only |
| `OTHER` | Either | Non-default specialty printers |

## Validation rules

- `BAR` role requires `kitchenStation = BAR`.
- `KITCHEN` role must not use station `BAR` (use role `BAR`).
- Receipt roles cannot carry a kitchen station.
- Role must be compatible with `deviceType`.

## Setup steps

1. Pair at least one Windows connector for the outlet.
2. **Devices → Register printer** (or use seed printers from pairing).
3. Set role, station (kitchen), IP, port (`9100`), paper width (`58` / `80`), encoding.
4. Assign the printer to a connector (same outlet only).
5. Mark one receipt printer **Default**; optionally mark another **Fallback**.
6. Test print + preview; confirm paper on site before calling the pilot physically verified.

## Multiple kitchen stations

Register one kitchen printer per station (`MAIN`, `BAR`, `DESSERT`, or custom). Routing sends **one** KOT per station for the items on that station — never fan-out duplicates to all printers.

## Fallback

Fallback is **advertised** in warnings and available via **authorized fallback** API/UI. It is never automatic dual-print on the original enqueue.
