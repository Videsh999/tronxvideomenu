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

`npm audit` after removing `xlsx` and moving `zod` to 4.6.7: critical 1 (`next`, fixed in 16.4.5), high 1 (`source-map-js`, transitive), moderate 10. `xlsx` is gone. The suggested `exceljs@3.4.0` fix is a downgrade and was not taken. Downgrading `eslint-config-next` to 15.5.29 to clear a transitive `minimatch` advisory would leave the Next 16 lint config and was not taken. `next@16.4.5` was not applied in this wave; the build and tests were verified on 16.3.6, which is the version this app is pinned to.

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

## Known remaining issues

- `next@16.3.6` still matches the published critical advisory. The patched release is 16.4.5. This repo does not use `use cache` or Draft Mode. The upgrade was left for a focused follow-up so this wave's build stays on the pinned version.
- `source-map-js` is transitive through the lint toolchain. No direct dependency bump fixes it without replacing the toolchain.
- ExcelJS 4.4.0 pulls `uuid` below 11.1.1 (moderate). The audit's fix is an older ExcelJS.
- ESLint still reports 27 warnings.
- One restaurant admin per outlet, cashier logins, and kitchen logins are not in this wave.
- Guest Wi-Fi reveal, login rate-limit fail-open, and order-number allocation outside the insert are unchanged.
- `.xls` (BIFF) uploads are refused with an explicit error. `.xlsx` and `.csv` still import and export.
- Browser end-to-end against a running outlet was not run.
