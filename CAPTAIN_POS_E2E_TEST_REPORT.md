# Captain POS E2E Test Report

## Automated

| Test | Result |
|------|--------|
| `tests/captain-permissions.test.ts` | Pass (unit) |
| `tests/captain-pos-order-schema.test.ts` | Pass (unit) |
| Prior captain auth / order pipeline tests | Retain |

## Manual / production scenarios (Triparna Kitchen)

| Scenario | Expected | Notes |
|----------|----------|-------|
| A Walk-in | POS → table → items → place → kitchen | Captain login `cap1@gmail.com`; tables 1–20 assigned |
| B Multi-table carts | Switch tables; carts isolated | Client state keyed by table # |
| C Additional items | Append + KOT enqueue | `appendItemsToOrder` |
| D Permissions | Block pay/discount when flags off | Admin Captains editor |
| E Regression | Admin POS layout usable; QR Approvals intact | Layout CSS fix |

## Screenshots

Captured from running deployment / local after deploy — see assets attached in chat / `docs/screenshots/` if published with this release.
