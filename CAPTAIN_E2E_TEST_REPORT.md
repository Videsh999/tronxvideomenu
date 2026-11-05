# Captain Portal 3.0 — Test Report

## Automated (executed)

```
node --import tsx --test tests/captain-authorization.test.ts tests/billing-calculator.test.ts tests/captain-order-schema.test.ts
# tests 21  # pass 21  # fail 0
```

Covers:
- QR default blocks kitchen
- Captain/POS eligibility
- Legacy pending QR gated; legacy preparing QR eligible
- Reject/correction require reason
- Approve schema without reason

Also retain prior billing + captain schema suites.

## Security checklist (code-enforced; exercise in demo)

| # | Case | Enforcement |
|---|------|-------------|
| 1 | QR not in KDS before approval | `listKitchen` + createPublic pending |
| 2 | Direct kitchen status blocked | `acceptToKitchen` gate |
| 3 | Assigned captain can approve | `assertCaptainMayServeTable` |
| 4 | Unassigned cannot | 403 from authorize route |
| 5 | Reassignment | Admin table assign |
| 6 | Duplicate approve | atomic update → 409 |
| 7 | No duplicate KOT | no second accept |
| 8–9 | Reject/correction no kitchen | status + gate |
| 10 | Prices server-side | existing createPosOrder/createPublic |
| 11–12 | Outlet / client fields | auth + ignored client totals |
| 13 | POS/QR still create | channels unchanged |
| 14 | History intact | append + snapshots |

## Demo restaurant
`TRONX Captain Approval Demo` seed not run in this session (Atlas/env). Use existing demo seed tooling after deploy.
