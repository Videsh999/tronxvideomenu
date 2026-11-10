# TRONX PRO MAX QA report

Audit commands and their results stay in `TRONX_PRO_MAX_ARCHITECTURE.md`. This file records Wave 1.

Environment: Linux, Node v22.23.4, npm 10.9.9. No production database was opened. No remote MongoDB URI was used. Integration tests started their own in-memory replica set and overrode `MONGODB_URI` for the test process.

## Wave 1 commands

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` | 0 | **PASS**. `# tests 224`, `# pass 224`, `# fail 0`, `# skipped 0`. |
| `npm run lint` | 0 | **PASS** for errors. `0 errors, 27 warnings`. Warnings are unused variables, `<img>`, and `window.location` notes. They do not fail the script. |
| `npx tsc --noEmit --pretty false --incremental false` | 0 | **PASS**. No errors. |
| `npm run test:integration` | 0 | **PASS**. `# tests 12`, `# pass 12`, `# fail 0`, `# skipped 0`. The runner refused to start the suite until `MongoMemoryReplSet` was up. The child process received only that loopback replica-set URI. |
| `npm run build` | 0 | **PASS**. Next.js 16.3.6 compiled, then `Running TypeScript` / `Finished TypeScript in 14.3s`. The log does not say `Skipping validation of types`. 53 static pages. `ƒ Proxy (Middleware)` is still present. |

The first audit on 16.3.6 named a critical `next` advisory and a high `source-map-js` advisory. Both are addressed below. `xlsx` is gone. The ExcelJS `uuid` finding stays on the allowlist because application code does not call the vulnerable buffered API.

Browser walk-through of POS and captain: **NOT TESTED**. Those screens need a signed-in outlet. Bill parity is covered by `tests/bill-preview-parity.test.ts`, which feeds the same lines to `previewStaffCartBill` and `billFromStoredLines`.

## Tests added

- `tests/api-route-matrix.test.ts` — every route file is classified. Loyalty is `customer` with no staff cookie. Connector routes are `connector`. Seed is `local_dev` and denied to every session. A new path that falls through to `staff` fails unless it is on the staff prefix list. The proxy test checks loyalty, connector, dishes, and the seed host lock.
- `tests/loyalty-connector-auth.test.ts` — login, register, forgot, and reset succeed or fail on their own handlers with no customer session. Login for outlet B does not accept outlet A's customer. Pairing rejects a body `restaurantId`. Heartbeat, jobs, and ack reject a missing secret. A job in another outlet is 404 or 403.
- `tests/order-bill-snapshot.test.ts` — variant price, inclusive tax not added twice, cancel recomputes CGST/SGST, historical GST rate is kept.
- `tests/bill-preview-parity.test.ts` — mixed rates, inclusive IGST, discounts, packaging, service charge, cancelled quantities. Screen helper equals server helper.
- `tests/demo-seed-guard.test.ts` — seed refuses production, a missing confirm flag, a non-loopback URI, and a short password. `DEMO_KITCHEN` has no password field.
- `tests/integration/order-money.test.ts` — QR variant and idempotent resubmit, concurrent append with snapshot hold, concurrent cancel, crash-retry of a `PENDING` marker, concurrent partial payments, payment idempotency key.
- Menu import/export tests generate real `.xlsx` bytes with ExcelJS. A truncated zip and a non-workbook buffer are rejected. A blank name and a bad price are reported, not dropped.
- `tests/captain-credential-access.test.ts` — the repository double implements `touchLastActiveAt` and does not bump `updatedAt`.

## CTO review fixes

Re-run after the review changes, still on Node v22.23.4:

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` | 0 | **PASS**. `# tests 228`, `# pass 228`, `# fail 0`. |
| `npm run lint` | 0 | **PASS**. 0 errors, 28 warnings. |
| `npx tsc --noEmit` | 0 | **PASS**. |
| `npm run test:integration` | 0 | **PASS**. `# tests 14`, `# pass 14`, `# fail 0`, `# skipped 0`. |
| `npm run build` | 0 | **PASS**. Next.js 16.4.5. `Finished TypeScript in 10.5s`. |
| `node scripts/scan-secrets.mjs` | 0 | **PASS**. |
| `node scripts/check-advisories.mjs` | 0 | **PASS**. High and critical findings are empty except the documented ExcelJS `uuid` allowlist. |

`next` and `eslint-config-next` are 16.4.5. `source-map-js` is overridden to 1.2.2. `zod` is 4.6.7.

## Captain tables

Commands after the floor screen, on Node v22.23.4. No production database. The demo screenshots used a local in-memory replica set and the synthetic TRONX Demo Kitchen seed.

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` | 0 | **PASS**. `# tests 231`, `# pass 231`, `# fail 0`, `# skipped 0`. |
| `npm run lint` | 0 | **PASS** for errors. `0 errors, 28 warnings`. |
| `npx tsc --noEmit` | 0 | **PASS**. |
| `npm run test:integration` | 0 | **PASS**. `# tests 16`, `# pass 16`, `# fail 0`, `# skipped 0`. |
| `npm run build` | 0 | **PASS**. Next.js 16.4.5 compiled and finished TypeScript. 53 pages. |

Signed-in browser check of the new captain home, order pad, and KOT sheet: **PASS** against the demo seed only. Hardware printing was not attempted.

## Known remaining issues

- ExcelJS 4.4.0 still depends on `uuid` below 11.1.1. That advisory is accepted in `TRONX_PRO_MAX_ADVISORY_ALLOWLIST.md` because this app does not call `uuid` v3, v5, or v6 with a caller buffer. The audit's fix downgrades ExcelJS.
- ESLint still reports 27 warnings.
- One restaurant admin per outlet, cashier logins, and kitchen logins are not in this wave.
- Guest Wi-Fi reveal, login rate-limit fail-open, and order-number allocation outside the insert are unchanged.
- `.xls` (BIFF) uploads are refused with an explicit error. `.xlsx` and `.csv` still import and export.
- Browser end-to-end of the admin POS was not run. The captain table, order, and KOT screens were checked on the demo seed.
