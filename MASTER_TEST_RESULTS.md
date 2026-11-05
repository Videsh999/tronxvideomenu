# Master Test Results

**Date:** 2026-11-05

## Unit tests

```
Command: node --import tsx --test tests/*.test.ts
# tests 174
# pass 174
# fail 0
# duration_ms ~39909
```

Includes new coverage:

- `tests/menu-export.test.ts`
- `tests/admin-layout.test.ts`
- `tests/theme-contrast.test.ts` (prior)
- Existing `tests/menu-import.test.ts` (empty optional cells)

## Typecheck

```
npx tsc --noEmit → exit 0
```

## API smoke

| Check | Result |
| --- | --- |
| `GET /menu/lilles` | 200 |
| `GET /api/admin/menu-export` (no session) | 401 |
| Fixture workbook → import drafts | 80 drafts from Menu sheet |

## Local concurrency (menu HTML only)

| Concurrency | OK | Failed |
| ---: | ---: | ---: |
| 25 | 25 | 0 |
| 100 | 100 | 0 |

See `PERFORMANCE_BENCHMARK_REPORT.md` — **local only**.

## Not executed in this agent session

| Item | Reason |
| --- | --- |
| `npm run demo:seed` against Atlas | Agent shell SRV DNS `ECONNREFUSED` to Mongo cluster |
| Authenticated POS screenshot after fix | Browser session not logged in (redirect to login) |
| Full Playwright E2E suite | Not present as a first-class package script in repo |
| Integration Mongo replica-set suite | Requires dedicated integration env (`npm run test:integration`) |
| 100× critical workflow loop | Deferred until authenticated staging credentials available |

## Honesty rule

Anything not listed above as executed was **not** claimed as passed.
