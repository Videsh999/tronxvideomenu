# TRONX PRO MAX architecture

Audit date: 2026-11-07. This run is verification only. Application code was not modified. `main` was not committed to. No production database was opened and the public site was not called.

Honesty labels used below: **PASS**, **FAIL**, **BLOCKED**, **NOT TESTED**, **ENVIRONMENT-DEPENDENT**.

## Repository verification

This repository is the Restaurant OS, not a video-menu-only app. The npm package name is still `tronx-video-menu` (`package.json`) and the README title is "TRONX Restaurant" with a narrower first paragraph (public menu plus admin menu management). The tree itself includes admin, super admin, captain, POS, kitchen, inventory, procurement, CRM, reservations, billing, multi-outlet, AI, and a Windows device connector. Treat the README opening as stale. Treat the code as the product.

| Fact | Value |
| --- | --- |
| GitHub | `Videsh999/tronxvideomenu` |
| Default branch | `main` (`origin/HEAD` -> `origin/main`) |
| `main` HEAD | `fcc89586190e2dd40673c7cb04f6baa358dd7969` |
| HEAD date | `2026-11-07 12:19:52 +0530` |
| HEAD subject | Speed up floor screens: bounded order queries, request dedupe, instant UI. |
| Local branches | `main` only, at the same commit, tracking `origin/main` |
| Remote branches | `origin/main` only |
| Open pull requests | none. `gh pr list --state all --limit 50` returned an empty list |
| Working tree at audit start | clean, even with `origin/main` |

`git log --oneline` shows 30 commits from `072eb94` ("Initial commit from Create Next App") through `fcc8958`. History is a single line on `main`. There is no release branch and no `pro-max` branch until this audit branch.

### Deployment configuration

| Mechanism | Present |
| --- | --- |
| `vercel.json` | No |
| Render, Fly, Netlify, Docker, docker-compose | No |
| `.github/workflows` | No |
| `next.config.ts` | Yes. Image hosts are `images.unsplash.com` and `res.cloudinary.com`. `typescript.ignoreBuildErrors` is `true`. A LAN address is set as `allowedDevOrigins`. |
| Deploy notes in repo | `PRODUCTION_DEPLOYMENT_CHECKLIST.md` names Vercel. `next.config.ts` comments say a hanging typecheck was blocking Vercel production deploys. |

How the live site at `https://tronxvideomenu.vercel.app` is configured (project id, env, domain) is **NOT TESTED**. This audit did not HTTP-call that host.

### CI

**FAIL** as "checks exist". There is no workflow file. There is nothing for GitHub Actions to run. The checklist in `PRODUCTION_DEPLOYMENT_CHECKLIST.md` asks a human to run `tsc`, `npm test`, integration tests, and `npm run build` before deploy. The build itself skips TypeScript.

### Environment variable names

Values are not recorded. Names come from `.env.example` and from `process.env` references.

| Name | Required? |
| --- | --- |
| `MONGODB_URI` | Required for any database call. `lib/db/mongodb.ts` throws if it is missing. |
| `AUTH_SECRET` | Required for sessions. Login returns 503 "Authentication is not configured" when it is missing (`app/api/auth/login/route.ts`). |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Required to sign in as super admin. Not required to boot the server. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required for media upload and delete. Passed into the SDK at import time (`lib/cloudinary.ts`). The process still starts if they are empty; uploads fail later. |
| `CREDENTIALS_ENCRYPTION_KEY` | Required to encrypt or decrypt recoverable staff passwords. Must be canonical Base64 of 32 bytes (README). |
| `WIFI_ENCRYPTION_KEY` | Required to encrypt or decrypt guest Wi-Fi passwords (`lib/security/wifi-crypto.ts`). |
| `MOAI_KITCHEN_ADMIN_RESTAURANT_SLUG`, `MOAI_KITCHEN_ADMIN_EMAIL`, `MOAI_KITCHEN_ADMIN_PASSWORD` | Optional legacy login. Slug defaults to `moai-kitchen`. |
| `NATIVE_SOUTH_ADMIN_RESTAURANT_SLUG`, `NATIVE_SOUTH_ADMIN_EMAIL`, `NATIVE_SOUTH_ADMIN_PASSWORD` | Optional legacy login. Slug defaults to `native-south`. |
| `GOOGLE_TRANSLATE_API_KEY` | Optional. Without it, translation uses MyMemory (`lib/services/translation.service.ts`). |
| `TRANSLATION_CONTACT_EMAIL` | Optional quota hint for MyMemory. |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Optional. No `AI_API_KEY` selects the heuristic provider (`lib/ai/provider.ts`). Defaults in `.env.example`: provider `openai`, model `gpt-4o-mini`. |
| `DEMO_SEED_TOKEN` | Optional. If set, `POST /api/dev/seed-demo-kitchen` requires header `x-tronx-demo-seed`. |
| `ALLOW_PRODUCTION_SEED` | Optional and dangerous. Value `true` lifts the production seed refusal. |
| `RUN_INTEGRATION` | Test harness only. |
| `NODE_ENV` | Runtime. Seed routes treat `production` as the locked mode. |
| `TRONX_CLOUD_BASE_URL`, `TRONX_CONNECTOR_DATA_DIR`, `PROGRAMDATA` | Device connector process only (`device-connector/src/config/index.ts`). Not read by the Next app. |

No `NEXT_PUBLIC_` secret was found. `.gitignore` ignores `.env*` except `.env.example`.

### Secrets in git

No `.env` file is tracked. No cloud key or database URI with a password was found in application source. Two committed demo login literals are a finding (see `TRONX_PRO_MAX_FINDINGS.md` F-06):

- `lib/demo/seed-demo-kitchen.ts` constant `DEMO_KITCHEN.adminPassword`
- `scripts/verify-demo-reupload-import.mjs` object field `password`

`npm audit` (2026-11-07): 12 advisories, critical 1 (`next`), high 3 (`xlsx`, `zod`, `source-map-js`), moderate 8, low 0. Detail and what is actually reachable is in finding F-08.

### Database

| Item | What the code does |
| --- | --- |
| Provider | MongoDB via Mongoose `9.10.2` |
| ORM | Mongoose only. No Prisma, no Drizzle, no SQL migrations. |
| Schema | One file, `lib/db/models.ts` (1591 lines), `strict: true`, explicit collection names. Extra models in `lib/db/import-job-model.ts`, `lib/db/rate-limit-model.ts`, `lib/db/translation-model.ts`. |
| Migrations | None. Schema changes are applied by Mongoose on write. |
| Connection | `lib/db/mongodb.ts` reads `MONGODB_URI`, caches the connection on `globalThis`, pool size 10, server selection timeout 8000 ms. |
| Transactions | `lib/db/mongo-tx.ts` uses a transaction when the server allows it, otherwise runs the callback with no session. |

### Existing docs

Root markdown (historical write-ups, not re-verified as true in this audit): `README.md`, `AI_FINANCIAL_VALIDATION.md`, `AI_FORECAST_BACKTEST.md`, `AI_METRICS_DICTIONARY.md`, `AI_QUALITY_EVALUATION.md`, `AI_SECURITY.md`, `BILLING_CALCULATION_SPEC.md`, `BILLING_REGRESSION_TEST_REPORT.md`, `CAPTAIN_AUTHORIZATION_ARCHITECTURE.md`, `CAPTAIN_E2E_TEST_REPORT.md`, `CAPTAIN_ORDER_WORKFLOW.md`, `CAPTAIN_PERMISSION_MATRIX.md`, `CAPTAIN_PORTAL_2_0_PLAN.md`, `CAPTAIN_PORTAL_2_0_REPORT.md`, `CAPTAIN_PORTAL_3_0_REPORT.md`, `CAPTAIN_PORTAL_GAP_ANALYSIS.md`, `CAPTAIN_POS_E2E_TEST_REPORT.md`, `CAPTAIN_POS_IMPLEMENTATION_REPORT.md`, `CAPTAIN_POS_WORKFLOW.md`, `CAPTAIN_TABLE_ASSIGNMENT_GUIDE.md`, `CONNECTOR_DIAGNOSTICS.md`, `CONNECTOR_OPERATIONS_GUIDE.md`, `CONNECTOR_SECURITY.md`, `DEMO_RESTAURANT_GUIDE.md`, `DEVICE_ADAPTER_GUIDE.md`, `DEVICE_ARCHITECTURE.md`, `DEVICE_ROUTING_GUIDE.md`, `ESC_POS_COMPATIBILITY.md`, `EXCEL_IMPORT_BUGFIX_REPORT.md`, `EXCEL_IMPORT_EXPORT_REPORT.md`, `GST_CONFIGURATION_GUIDE.md`, `HARDWARE_COMPATIBILITY.md`, `HARDWARE_PILOT_CHECKLIST.md`, `KOT_AUTHORIZATION_RULES.md`, `LOCAL_CONNECTOR_ARCHITECTURE.md`, `MASTER_AUDIT_PLAN.md`, `MASTER_AUDIT_REPORT.md`, `MASTER_TEST_RESULTS.md`, `MEDIA_AND_IMPORT_GUIDE.md`, `MENU_IMPORT_ENGINE.md`, `MULTI_CONNECTOR_ARCHITECTURE.md`, `MULTI_PRINTER_SETUP_GUIDE.md`, `ORDER_APPROVAL_WORKFLOW.md`, `PERFORMANCE_BENCHMARK_REPORT.md`, `PHASE_4_1_CHECKLIST.md`, `PHASE_4_1_CLOSURE_REPORT.md`, `PHASE_4_1_REPORT.md`, `PHASE_4_REPORT.md`, `PHASE_5_1_PLAN.md`, `PHASE_5_1_REPORT.md`, `PHASE_5_PLAN.md`, `PHASE_5_REPORT.md`, `PHASE_6_1_PLAN.md`, `PHASE_6_1_REPORT.md`, `PHASE_6_2_PLAN.md`, `PHASE_6_2_REPORT.md`, `PHASE_6_3_PLAN.md`, `PHASE_6_3_REPORT.md`, `PHASE_6_PLAN.md`, `PHASE_6_SIMULATOR_REPORT.md`, `POS_KDS.md`, `POS_LAYOUT_FIX_REPORT.md`, `POS_ORDER_CREATION_BUGFIX_REPORT.md`, `PRINTER_ROUTING_GUIDE.md`, `PRINTER_SETUP_GUIDE.md`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `PROJECT_AUDIT.md`, `RESPONSIVE_AUDIT_REPORT.md`, `RESTAURANT_BILLING_SETTINGS_REPORT.md`, `SECURITY_AUDIT_REPORT.md`, `UI_UX_AUDIT_REPORT.md`, `WINDOWS_CONNECTOR_INSTALLATION.md`.

Under `docs/`: `LOYALTY_AND_TABLE_ANALYTICS.md`, `MONGO_REPLICA_SET_TESTING.md`, `screenshots/captain-pos-live.png`.

`AGENTS.md` and `CLAUDE.md` are Next.js agent-rule stubs, not product docs. Prior phase reports describe work the authors believed shipped. This audit does not treat those PASS claims as results. Where a behavior mattered, it was re-read in source or re-run.

## Stack

| Layer | Version resolved in this environment |
| --- | --- |
| Node | `v22.23.4` |
| npm | `10.9.9` |
| Next.js | `16.3.6` (App Router, Turbopack build) |
| React / React DOM | `19.2.8` |
| TypeScript | `5.9.3` |
| Tailwind CSS | `4.3.3` via `@tailwindcss/postcss` |
| Mongoose | `9.10.2` |
| Zod | `4.6.5` |
| xlsx | `0.18.5` |
| ESLint | `9.39.5` with `eslint-config-next` `16.3.6` |
| Test runner | `node:test` through `tsx` `4.23.15` |
| Other runtime libs | `cloudinary` `2.11.0`, `hls.js` `1.7.3`, `qrcode` `1.5.4`, `react-hook-form` `^7.89.0`, `lucide-react` `^1.48.0` |

`device-connector` is a second package (`@tronx/device-connector` `0.1.0`) with its own `package.json`. It is excluded from the root `tsconfig.json`.

## Folder structure

- `app/` — App Router pages and route handlers. Surfaces: customer menu, admin, super admin, captain, `api/`.
- `components/` — UI by role: `admin`, `captain`, `customer`, `kitchen`, `super-admin`, `shared`, `auth`.
- `lib/` — domain. `services/` (use cases), `repositories/` (Mongo), `db/models.ts`, `billing/`, `menu-import/`, `menu-export/`, `inventory/`, `devices/`, `ai/`, `analytics/`, `crm/`, `security/`, `org-rbac.ts`, `api-authz.ts`.
- `types/` — shared TypeScript types.
- `tests/` — 48 `*.test.ts` files at the top of `tests/`, plus `tests/integration/` (2 files).
- `scripts/` — seeds, workbook generators, one restaurant-specific table assignment script (`scripts/assign-triparna-captain-tables.ts`, slug `triparna-kitchen`).
- `fixtures/` — demo menu workbook.
- `device-connector/` — local connector.
- `public/`, `videos/` — static assets. `videos/` is gitignored.
- `docs/` — short operational notes. This audit adds `docs/pro-max/`.

`lib/services/order.service.ts` is 1655 lines and is the order pipeline. `components/admin/PosTerminal.tsx` is 976 lines. `components/captain/CaptainOrderPad.tsx` is 841 lines.

## Data model

Tenant key on almost every operational document is `restaurantId` (the outlet). `organizationId` is optional and used for multi-outlet. There is no separate `tenantId`. Identifiers are string ids generated in services (`order-…`, `tdk-…`), not Mongo `_id`, though Mongoose still stores `_id`.

Orders snapshot dish name, variant, add-on name, and unit price (`lib/db/models.ts:309-333`). Payments are a summary plus `auditTrail` and `ledger` (`:396-423`). Captain authorization is embedded on the order (`:459-476`). Inventory movements carry an idempotency key (`:895`). Coupons and loyalty transactions do too.

Unique indexes that matter: restaurant slug; table number per restaurant; order number per restaurant; order idempotency key per restaurant; one admin account per restaurant; coupon code per restaurant; customer phone per restaurant; recipe per dish per restaurant; print job dedupe key per restaurant.

## API surface

173 handlers were counted by scanning `export async function GET|POST|PUT|PATCH|DELETE` under `app/api`. The proxy class is what `classifyApiRequest` returns for that method and path. It is the edge gate. Handlers often check again and are stricter.

Proxy classes (`lib/api-authz.ts`):

- `public` — no cookie required.
- `captain` — captain cookie.
- `restaurant_admin` — restaurant-admin cookie.
- `super_admin` — super-admin cookie.
- `staff` — restaurant-admin or super-admin cookie. A captain cookie is not enough.
- `floor` — restaurant-admin, super-admin, or captain cookie.

The edge does not check tenant. Tenant checks are inside handlers, and they are not uniform. Menu list routes compare the query `restaurantId` to the session (`app/api/dishes/route.ts`). Organization and AI routes use `requireOutletPermission` (`app/api/ai/assistant/route.ts`). A route that forgets the handler check is only protected by "some staff cookie exists".

Mismatches that matter are findings F-01 and F-07. Loyalty and connector routes are `staff` even though their handlers do not expect a staff cookie. The demo seed route is `public`. Do not close F-01 by adding one `customer` proxy class over `/api/public/loyalty/*`. Login, register, and reset must remain reachable with no session at all.

### Intended handler contracts

Current proxy class is what the code does today. The contract is what the handler is written to enforce. Stream A changes only `proxy.ts` and `lib/api-authz.ts` so the edge matches this table. It does not invent a session requirement the handler does not have.

| Handler | Current proxy class | Intended contract |
| --- | --- | --- |
| `POST /api/public/loyalty/login` | `staff` | No session. Body is restaurant slug, phone or email, and password (`app/api/public/loyalty/login/route.ts`). On success the handler sets the customer cookie. |
| `POST /api/public/loyalty/register` | `staff` | No session. Body creates the account (`register/route.ts`). On success the handler sets the customer cookie. |
| `POST /api/public/loyalty/forgot-password` | `staff` | No session. Body is restaurant slug and email. Starts a reset. Must stay anonymous so a locked-out guest can request it. |
| `POST /api/public/loyalty/reset-password` | `staff` | No session. Body is restaurant slug, reset token, and new password (`reset-password/route.ts`). The token is the credential. A customer cookie is not required and must not be required by the proxy. |
| `POST /api/public/loyalty/logout` | `staff` | No session required. Clears the customer cookie and returns success (`logout/route.ts`). An already-expired cookie must still be able to call it. |
| `GET /api/public/loyalty/me` | `staff` | No staff cookie. The handler reads the customer cookie if present and returns `data: null` when it is absent (`me/route.ts:10-12`). The proxy must let the anonymous call through. The handler decides what a missing cookie means. |
| `POST /api/connector/pair` | `staff` | No staff cookie and no connector secret. Body is a one-time pairing `code` plus optional hostname, name, and version (`app/api/connector/pair/route.ts:6-20`). The code record, created earlier by an authorized admin, binds restaurant and outlet. This route is not `requireConnectorAuth`. |
| `POST /api/connector/heartbeat` | `staff` | No staff cookie. `x-connector-id` and `x-connector-secret` (`heartbeat/route.ts` calls `requireConnectorAuth`). Not a pairing code. |
| `GET /api/connector/jobs` | `staff` | Same secret headers as heartbeat (`jobs/route.ts:8`). Returns jobs and devices for that connector's outlet only. |
| `POST /api/connector/jobs/[jobId]/ack` | `staff` | Same secret headers. Body is a terminal job status. The connector must already be paired. |

`GET /api/orders/[orderId]/status` stays proxy-public and keeps its bearer-token check in the handler. `GET /api/restaurants/[restaurantId]?fullMenu=true` stays the public catalog. `POST /api/dev/seed-demo-kitchen` stays a separate seed contract owned by Stream D, not a loyalty or connector exception.

`GET /api/restaurants` is classified `public` but the handler returns 401 without an admin (`app/api/restaurants/route.ts:13`). `GET /api/restaurants/[restaurantId]` is `public` and, when `fullMenu=true`, returns the menu with no session (`app/api/restaurants/[restaurantId]/route.ts:25-33`). That is how `lib/api.ts` loads a customer menu. `PATCH` and `DELETE` on the same path are `staff`, and delete also calls `requireSuperAdmin`.

The full table is the appendix at the end of this file. Purpose in that table is the resource the path names, confirmed by the handler file, not a runtime trace.

## Auth, session, RBAC

Three cookies: `tronx_super_admin_session`, `tronx_restaurant_admin_session`, `tronx_captain_session`. HMAC-SHA256 over a base64url JSON payload (`lib/auth-core.ts`). `Secure` follows `x-forwarded-proto` or the request URL (`lib/auth-core.ts:13-16`). SameSite is set at the login handlers (loyalty login uses `lax`).

Restaurant-admin sessions that carry an account id are invalidated when `updatedAt` changes (`lib/auth-server.ts:44-50`). Captain sessions are invalidated when the captain row's `updatedAt` changes (`lib/auth-server.ts:70`). `authenticate` deliberately does not bump `updatedAt` for that reason (`lib/services/captain.service.ts:20-21`); it updates `lastActiveAt` instead.

Passwords for captains and restaurant admins are hashed and, when "retrievable", also encrypted with `CREDENTIALS_ENCRYPTION_KEY`. Super admin is an environment string comparison, not a database user.

RBAC layers:

1. Proxy class (role cookie present).
2. Handler session loader (role, active flag, slug match).
3. Feature flag (`lib/features.ts`) for the restaurant plan.
4. Org permission for back-office routes (`lib/org-rbac.ts`).
5. Captain permission flags and assigned tables for payments, discounts, and coupons.

There is no per-request policy object shared by proxy and handlers. The two layers drift (F-01).

## Tenancy

An outlet is a `restaurants` document. An organization is a group of outlets. A restaurant admin without `orgRole` can only touch `sessionRestaurantId` (`lib/org-rbac.ts:139-144`). Org owner and org admin can touch every outlet in their organization. Outlet manager and staff need `outletIds`, or they fall back to their home restaurant.

Captains are always one outlet (`lib/org-rbac.ts:88`). Isolation is application-level filters, not separate databases and not Mongo row-level security. A bug that queries by id alone crosses tenants. The repositories that were read for orders use `restaurantId` and id together (`orderRepository.findByRestaurantAndId`). That pattern was not re-audited line by line for every repository.

Subscription state is a field on the outlet, not a billing-system tenant. There is no TRONX subscription invoice in this repo. `subscriptionPlan` only gates features.

## Real-time

**Polling.** No WebSocket server and no SSE route were found. Intervals seen in UI: kitchen 5s, customer order status 8s, captain approvals 8s, orders and captain orders 10s, tables 15s. The device connector polls `GET /api/connector/jobs`. The home page copy says "instantly" and "real time" (finding F-19).

## Billing and tax

One function is documented as authoritative: `calculateRestaurantBill` in `lib/billing/calculate-bill.ts`. It handles exclusive and inclusive prices, packaging (per order, per item, per quantity, percent), service charge (fixed or percent), and splits tax into CGST+SGST or IGST, never both. Line rate resolution is dish, then category, then outlet (`lib/billing/resolve-tax-rate.ts`).

A second function, `computeBillTotals` in `lib/order-pricing.ts`, still runs in three places: POS preview, captain preview, and line cancel. Create, append, and admin preview use the authoritative function. Details: findings F-02 and F-03.

There is no hardcoded 5% or 18% in the calculator. The demo seed writes `taxRatePercent: 5` onto the demo restaurant (`lib/demo/seed-demo-kitchen.ts:64`). Tests use 5% as a fixture. Outlet settings are the runtime source when the authoritative function is the one that runs.

### Money integrity

Stream B owns this policy and the code that has to obey it (`lib/billing/**`, `lib/order-pricing.ts`, `lib/services/order.service.ts`, `lib/repositories/order.repository.ts`). Stream C displays the result. C does not edit the billing modules.

**Historical snapshot.** When a line is created, freeze `unitPriceSnapshot`, add-on unit prices, `itemTotal`, and the GST rate applied to that line. Store the rate on the line (or inside the line's slice of `billSnapshot`) so a later read does not need the live menu. Freeze the outlet billing settings used for that order inside `billSnapshot` (price mode, packaging rule, service-charge rule, supply type, outlet default rate). `appendItemsToOrder` today does the opposite for tax: it re-resolves every merged line, including lines already on the order, from the live dish, category, and outlet (`lib/services/order.service.ts:750-770`). That is a re-price of history. The required behavior is:

- Existing lines keep their frozen unit prices, line totals, and line GST rates.
- New lines are priced from the current menu and the current line-tax resolution.
- Order-level packaging, service charge, and supply type come from the frozen `billSnapshot` settings, applied to the new subtotal. A manager can run an explicit audited "reprice open check" later. Append is not that action.
- Discount amounts already stored on the order stay unless the same request changes them.
- `total`, `taxAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `packagingCharge`, `serviceCharge`, and `billSnapshot` are written in one update. Cancel today updates only some of them (finding F-02).

**Lost updates.** `replaceItemsAndTotals` matches `restaurantId` and `id` and a status exclusion (`lib/repositories/order.repository.ts:399-406`). It has no `updatedAt` or version precondition. The repository must compare-and-swap on a version or on `updatedAt`, and the caller must retry by re-reading. Two appends, or an append and a cancel, that read the same version must not both succeed.

**Crash retry.** `cancelOrderLines` writes the new totals and only then inserts the parent idempotency row (`lib/services/order.service.ts:1543` then `:1610-1626`). The marker has to be in the same transaction as the money write, and the money write must not commit if the marker does not. A retry after a crash must return the already-cancelled order and must not cancel the quantity again.

**Tests Stream B must add before the finding is closed.** These do not exist yet.

- Lost update: two concurrent `replaceItemsAndTotals` or appends on one order; exactly one wins the version; the loser re-reads and applies on top of the winner.
- Crash retry: fail after the total write and before the parent cancellation marker; the retry is a no-op on quantities and on tax components.
- Snapshot: change the live dish GST rate after the order exists; append a new line; the old line's tax rate and line total stay at the frozen values.

## Order pipelines

There is one order collection and three create entrances, all in `order.service.ts`:

| Entrance | Route | Authorization | Pricing |
| --- | --- | --- | --- |
| `createPublic` | `POST /api/public/orders` | `PENDING_CAPTAIN_APPROVAL` | `calculateRestaurantBill`, no variants, no coupons |
| `createPosOrder` from admin or captain cookie | `POST /api/pos/orders` | POS actor: `NOT_REQUIRED`. Captain actor: `CAPTAIN_APPROVED` | `calculateRestaurantBill`, variants, coupons, loyalty |
| `createPosOrder` from captain route | `POST /api/captain/orders` | `CAPTAIN_APPROVED` | same function, plus captain discount and coupon permission checks in the route |

`appendItemsToOrder` adds lines and reprices with `calculateRestaurantBill`. Captain decision is `decideCaptainAuthorization` (single approve wins, idempotency key on the decision). Kitchen transition is `acceptToKitchen`, which refuses pending QR orders.

KOT print is a side effect after create or accept, not a second order document. Print jobs have their own dedupe key.

This is one pipeline with three doors, not three order systems. The doors do not share one pricing call (QR omits variants; cancel uses the other formula). Idempotency is stronger on POS (return existing) than on QR (409 after a duplicate key).

## Testing setup and coverage

| Command | Result |
| --- | --- |
| Unit | `npm test` → `tsx --test tests/*.test.ts`. Does not include `tests/integration`. |
| Integration | `npm run test:integration` → `tsx --test tests/integration/*.test.ts`. Skips unless `RUN_INTEGRATION=1` and `MONGODB_URI` are set. |
| Coverage | No `c8`, `nyc`, or Istanbul script. Coverage percentage: **NOT TESTED**. |
| E2E | No Playwright or Cypress dependency. Browser: **NOT TESTED**. |
| Load | `scripts/load-benchmark-menu.mjs` exists. It was not run. |

`npm test` in this environment: **FAIL**. TAP summary: `tests 210`, `pass 209`, `fail 1`, `skipped 0`, `duration_ms 9989.924491`. The failure is `tests/captain-credential-access.test.ts:36` (`touchLastActiveAt is not a function`). The other 209 include billing, captain authorization, menu import/export, inventory rules, org RBAC, AI redaction, financial reconciliation, and device simulators. Those are pure or in-memory. They do not prove Mongo behavior.

`device-connector`: `npm ci` then `npm test` → **PASS**, `tests 8`, `pass 8`, `fail 0`.

## Commands run in this audit

Environment: Linux, Node `v22.23.4`, npm `10.9.9`. Dependencies were not present at start. `npm ci --no-audit --no-fund` installed 435 packages and exited 0. No `.env.local` was created. `MONGODB_URI` was not set.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 0 | **PASS**. 435 packages added. |
| `npm test` | 1 | **FAIL**. 210 tests, 209 pass, 1 fail. |
| `npm run lint` | 1 | **FAIL**. 15 errors, 26 warnings (ESLint JSON count). |
| `npm run typecheck` (`tsc --noEmit`) | 2 | **FAIL**. Two errors, both in `components/admin/TablesManager.tsx` lines 22 and 23. Finished in about 10 seconds. It did not hang in this run. |
| `npm run build` | 0 | **PASS**, with the log line `Skipping validation of types`. Next.js `16.3.6` (Turbopack). Compiled in 9.5s. 53 static pages generated. The build lists `ƒ Proxy (Middleware)`. |
| `npm run test:integration` | 0 | **NOT TESTED** for the assertions. 8 tests, 0 pass, 0 fail, 8 skipped. |
| `npm test` inside `device-connector` after `npm ci` | 0 | **PASS**. 8 tests, 8 pass. |
| `npm audit --json` | 0 (audit tool) | 12 advisories: critical 1, high 3, moderate 8. See F-08. |
| Browser walk-through | — | **NOT TESTED**. The app needs MongoDB to render outlet data. No local database was available, and production was out of scope. |
| Seed / demo scripts | — | **NOT TESTED**. They write to `MONGODB_URI`. |
| `npm run bench:menu` | — | **NOT TESTED**. |

Integration reason: this machine has neither `mongod` nor Docker. The suite is written to skip rather than mock. Starting a replica set would have meant downloading a database server. That was not done. No remote URI was used.

`tsconfig.errors.json` is a narrower project used historically when the Next plugin hung. It was not the command this audit reports as typecheck. The official script was run instead, and it failed on the table status maps.

## Recommendation

**Evolve this codebase. Restructure the seams. Do not rewrite the product.**

The domain is already here: outlets, orders with snapshots, a real GST calculator, captain approval, inventory movements with idempotency keys, org RBAC, feature plans, and a device job model. A greenfield POS would throw away that behavior and the passing unit tests. The production risks are concentrated:

- The edge auth matrix does not match the handlers (`proxy.ts`, `lib/api-authz.ts`).
- Two bill formulas, and cancel does not update GST components (`lib/order-pricing.ts` vs `lib/billing/calculate-bill.ts`, called from `lib/services/order.service.ts`).
- `lib/services/order.service.ts` (1655 lines) is the only safe place to change order writes, so it must have one owner.
- `lib/db/models.ts` and `types/index.ts` are the schema. Parallel edits there will conflict and drift.
- Mongo is optional-transaction. Production multi-tenant money needs a replica set as a hard requirement.
- One admin account per outlet cannot staff a real floor.
- CI does not exist, and `ignoreBuildErrors` ships type errors.

### Target architecture

Keep a modular monolith on Next.js and MongoDB until the seams below are stable. Split deployables only for the device connector, which is already a separate process.

1. **Tenant root.** Organization is the customer. Outlet is the restaurant document. Every query takes an outlet id that has already been authorized. Add a repository helper that refuses a query without `restaurantId` rather than relying on each service to remember.
2. **One policy module, per handler.** `classifyApiRequest` and the handler guards read the same table. Do not add a blanket customer-auth class. Loyalty login, register, forgot-password, and reset-password stay anonymous. Logout stays anonymous. `GET /me` is anonymous at the edge and interpreted by the handler. Pairing is a code claim. Heartbeat, job poll, and ack are connector-secret calls. Proxy and handler tests must list all 173 handlers and the ten contracts in "Intended handler contracts".
3. **One order writer.** `order.service.ts` stays the aggregate. QR, POS, and captain are adapters. They all call the same price, tax, idempotency, and KOT functions. Cancel and append use the frozen snapshot policy and write every money field together with the idempotency marker.
4. **One bill module, owned by Stream B.** `lib/billing/**` and `lib/order-pricing.ts` are B's contract. C imports that contract and does not edit it. Delete `computeBillTotals` from UI and from cancel once B has published the snapshot-safe function. Keep `lineItemTotal` and `roundMoney`.
5. **Staff identities.** Replace the unique-per-outlet admin account with many memberships: manager, cashier, kitchen, captain. Captains can remain a floor role with table assignments. Kitchen and cashier get their own sessions and a smaller permission set.
6. **Money.** Recorded tenders stay for cash. Add a `PaymentAdapter` interface with a mock implementation for tests. Do not call a live gateway from the demo. Refunds and cash close go through the adapter and the shift, and they require the cashier or manager role.
7. **Realtime later.** Keep polling until an SSE channel exists for kitchen and captain. Do not introduce a second order state in the client.
8. **Data.** Require a Mongo replica set in every deployed environment. Fail startup if a transaction probe fails, instead of silently using the compensating path for payments, stock, and coupon redemption.
9. **CI.** GitHub Actions on pull requests: lint, `tsc --noEmit`, unit tests, and, on a service container, the integration suite against a local replica set. Turn `ignoreBuildErrors` off once `tsc` is clean. Secret scanning stays on; do not print env values.

### Workstreams

Path ownership is `docs/pro-max/PATH_OWNERS.md`. That manifest is the list. This section is the rules. A stream edits only its paths. A change to a path it does not own is a queued patch: the owner reviews it and lands it alone, one patch at a time, on that owner's branch sequence. Two patches to the same shared file are not merged together.

**Wave 0 — validation contracts.** Owner: Backend, reviewed by CTO. Merge this before every other stream.

- Split `lib/validations/index.ts` into domain modules. The barrel only re-exports and is then stewarded by H.
- No feature changes. Contracts for orders, loyalty, pairing, and billing inputs land here so later streams do not edit one schema file.

**Stream A — Authz matrix.** Owner: Backend. Reviewer: CTO.

- Files: `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts` only.
- Acceptance: the ten handler contracts above. Login, register, forgot-password, and reset-password are reachable with no customer cookie and no staff cookie. Logout and `GET /me` are reachable with no staff cookie. `POST /api/connector/pair` is reachable with a pairing code and without a connector secret or a staff cookie. Heartbeat, job poll, and ack reach `requireConnectorAuth` without a staff cookie. There is no proxy class that requires a customer session for every loyalty path. A test enumerates every `app/api/**/route.ts` method so a new route cannot fall through to `staff` by accident.

**Stream B — Order aggregate and billing contract.** Owner: Backend.

- Files include `lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `lib/billing/**`, `lib/order-pricing.ts`, and the order route tests named in the manifest. B is the only editor of `lib/billing/**` and `lib/order-pricing.ts`.
- Acceptance: the money-integrity policy in this doc. QR variants. Cancel and append use the frozen snapshot and write every tax component with the total. `replaceItemsAndTotals` compare-and-swaps. The cancellation marker commits with the money write. Lost-update and crash-retry tests exist and pass. Public idempotency returns the existing order. C consumes the exported functions and does not patch these files.

**Stream C — Bill UI.** Owner: Frontend. Starts only after B's billing contract is merged.

- Files: `components/admin/PosTerminal.tsx`, `app/admin/[slug]/pos/page.tsx`, `components/captain/CaptainOrderPad.tsx`, `components/admin/BillingSettingsForm.tsx`, `app/admin/[slug]/settings/billing/**`, `app/api/admin/billing/**`, plus the captain billing callers E hands off (below).
- C does not edit `lib/billing/**`, `lib/order-pricing.ts`, or `lib/services/order.service.ts`.
- Acceptance: the amount on screen equals B's snapshot-safe function for packaging, service charge, inclusive mode, and IGST, including on `app/admin/[slug]/pos/page.tsx`.

**Stream D — Identities and the legacy demo seed.** Owner: Backend.

- Also owns `app/api/dev/seed-demo-kitchen/route.ts`, `lib/demo/**`, `scripts/seed-tronx-demo-kitchen.ts`, and `scripts/verify-demo-reupload-import.mjs`.
- Membership schema changes are queued to H. D's membership consumers merge only after H's compatible schema and index change for that collection.
- Acceptance: the failing credential test passes. Two managers can exist once H's collection is in. Credential rotation and reset follow the policy under Security and operations. The legacy seed reads passwords from the environment and does not keep a password literal. The verify script does not embed a password.

**Stream E — Floor UI.** Owner: Frontend.

- Owns `components/customer/ReservationPanel.tsx` and no other file under `components/customer/`. G does not edit that panel.
- Owns `app/captain/**` except the billing callers it hands to C: `app/captain/[slug]/take-order/page.tsx` (passes `taxRatePercent` into `CaptainOrderPad`) and `app/captain/[slug]/bills/page.tsx` (renders payable totals). `app/captain/[slug]/pos/page.tsx` only redirects to take-order and stays with E. The handoff is a queued patch from E to C, landed by C after B's contract, one file at a time.
- Acceptance: `tsc` is clean for table statuses `BILL_REQUESTED`, `PAYMENT_PENDING`, and `CLEANING`. No edits to `order.service.ts` or to C's billing files.

**Stream F — Menu and catalog.** Owner: Frontend plus Backend for import.

- Dependency changes, including a replacement for `xlsx`, are a request to L. F does not edit the root `package.json` or lockfile.
- Acceptance: existing import/export tests pass. Untrusted workbooks are not parsed by the vulnerable `xlsx` package once L has landed the dependency F requested.

**Stream G — Customer menu and loyalty UX.** Owner: Frontend.

- `components/customer/**` except `ReservationPanel.tsx` (E).
- Loyalty acceptance (guest can register, log in, and reset without already holding a session) merges only after A. G does not edit `proxy.ts`.

**Stream H — Schema steward.** Owner: Backend. CTO reviews every change.

- Owns `lib/db/models.ts`, `types/**`, `lib/db/mongo-mappers.ts`, `lib/repositories/types.ts`, and the barrels `lib/repositories/index.ts`, `lib/services/index.ts`, and `lib/validations/index.ts`.
- Nobody else edits these. Other streams queue a patch. H lands one patch at a time.
- Acceptance: versioned backfill, staged indexes, and rollback notes for every schema change (see Schema changes). New membership indexes exist before D's consumers merge.

**Streams I1–I5 — former Stream I, separate owners and queues.** Each has its own Backend owner and its own merge queue. They do not share a branch or a review slot. Paths do not overlap. Customer loyalty UI stays in G.

- **I1 Inventory.** `lib/inventory/**`, `lib/services/inventory.service.ts`, inventory screens and `app/api/inventory/**`, inventory tests.
- **I2 Procurement.** `lib/services/procurement.service.ts`, procurement screen and `app/api/procurement/**`.
- **I3 CRM admin.** `lib/crm/**`, `lib/services/crm.service.ts`, CRM screen and `app/api/crm/**`, `tests/loyalty-coupons.test.ts`.
- **I4 Multi-outlet.** `lib/org-rbac.ts`, organization and menu-sync services, organization screen and `app/api/organization/**`, org boundary tests.
- **I5 Reports.** `lib/services/reporting.service.ts`, `lib/analytics/**` (read models; AI provider stays in J), reports screen and `app/api/reports/**`, financial and sales tests.

**Stream J — AI.** Owner: Backend. Unchanged path set in the manifest. No live provider call in unit tests.

**Stream K — Hardware.** Owner: Backend.

- Owns `device-connector/package.json` and `device-connector/package-lock.json`. Root `package.json` and the root lockfile stay with L. K files a dependency request to L when the Next app needs a new package.
- Connector route handlers stay here. Proxy classification stays in A. K's acceptance that pair, heartbeat, poll, and ack work without a staff cookie merges only after A. Pair acceptance is the pairing-code contract. Heartbeat, poll, and ack acceptance is the secret contract. USB stays labeled unsupported until a driver exists.

**Stream L — DevOps.** Owner: DevOps.

- Sole owner of the root `package.json`, `package-lock.json`, `.github/**`, `next.config.ts`, `tsconfig.json`, `tsconfig.errors.json`, `eslint.config.mjs`, and `postcss.config.mjs`.
- F and M submit dependency requests. They do not commit those files. K does not edit them.
- The workflow file may open early. The commit that turns the checks into required gates and removes `ignoreBuildErrors` merges last, after B and E leave `tsc` clean.

**Stream M — Demo and QA.** Owner: QA.

- New `scripts/seed-pro-max-demo.ts`, `scripts/cleanup-pro-max-demo.ts`, `fixtures/pro-max/**`, `tests/e2e/**` only. The legacy seed route, `lib/demo/**`, and `scripts/verify-demo-reupload-import.mjs` are D's.
- Phase A (one admin, 10 captains, 50 tables, 100+ items) can run on today's schema. Full-role QA (2 managers, 2 cashiers, 3 kitchen) merges only after D and H. Dependency additions go to L.

**Stream N — UI shell.** Owner: UI/UX, implemented by Frontend. Shell files only, as in the manifest. Feature streams do not edit the sidebar. They queue a one-line nav patch to N.

### Merge order

There is no "C through N in any order."

1. Wave 0 validation contracts.
2. H's compatible schema and index changes, including barrels, before any consumer of those shapes. D's membership consumers wait for this step.
3. B's billing contract (`lib/billing/**`, `lib/order-pricing.ts`, snapshot-safe order writes) before C, and before E's handoff of captain billing callers is integrated by C.
4. A before K's connector acceptance and before G's loyalty acceptance.
5. D and H both merged before M's full-role demo QA.
6. L's final gates last: required CI, typecheck on, lockfile closed, `ignoreBuildErrors` removed.

I1–I5, F, J, and N merge when their own paths are ready and any shared-file patch has been queued and landed by the owner. They do not skip steps 1–3 for a file they do not own.

### Security and operations deliverables

These are required for the production wave. Owners are named so the work has a queue.

| Deliverable | Owner | Acceptance |
| --- | --- | --- |
| IDOR and tenant-boundary checks | A writes the matrix test; each API owner adds the case for their routes; M runs them on the demo seed | Restaurant A session requesting restaurant B's order, dish, customer, print job, and loyalty profile receives 404 or 403. Outlet id is never taken from the body to expand access. |
| Origin and CSRF | A for cookie-authenticated mutations | State-changing routes that trust a cookie reject a cross-site `Origin` when `Origin` is present. `SameSite=lax` stays. Pairing and connector calls do not use the staff cookie, so they are not covered by the cookie CSRF check; they keep the code and secret contracts. |
| Rate limits | A for login, public order create, Wi-Fi reveal, loyalty register/login/reset, and pairing claims; L for the shared store | A burst returns 429. The limiter fails closed when its store is down, replacing the fail-open path in `lib/security/login-rate-limiter.ts:40-44`. |
| Credential rotation and reset | D | Staff and customer resets invalidate existing sessions. `CREDENTIALS_ENCRYPTION_KEY` and `WIFI_ENCRYPTION_KEY` rotation has a re-encryption step and a documented rollback. Revealing a stored staff password is an audited action with a reason, or the reveal path is removed. Reset tokens are not returned in production API bodies. Super-admin bootstrap passwords stay in the environment and are rotatable without a code change. |
| Structured redacted logs | L provides the logger; every stream uses it | Logs are JSON. Phone, email, password, cookie, connector secret, pairing code, and payment account fields are redacted. `lib/ai/redact.ts` is the pattern, not a second redactor. |
| Correlation ids | B on order and payment writes; K on print jobs; L on the request boundary | A request id is accepted or generated at the edge and stored on the order event, payment ledger entry, and print job. `correlationId` in `lib/db/mongo-tx.ts:40` is the existing helper to reuse, not a new format. |
| KOT failure alerts and retries | B enqueues; K delivers | A failed or missing KOT after accept or append raises an outlet alert (the AI alert collection or a dedicated ops alert, chosen in the ADR). Retries use the existing print-job attempt counter and dedupe key. The order API still succeeds. The alert is visible to the outlet. Swallowing the error with only a returned warning is not enough (finding F-15). |
| Backup, restore, RPO, RTO | L | A written drill against a copy of a synthetic database, not production. Restore steps are executed once and the result recorded. Target to declare in the drill record: RPO of 15 minutes and RTO of 1 hour for the order and payment collections. Those numbers are targets for the drill design, not measurements from a drill that has not been run. |

### Schema changes

Mongoose applies validators on write. It does not rewrite existing documents, and it does not drop an index that was removed from the schema. H's acceptance for every model change:

- A version field or `schemaVersion` on the collection, and a backfill script that is safe to run twice.
- Staged indexes: add the new index in a release that still accepts the old shape; backfill; switch readers; drop the old index in a later release. Do not drop a unique index in the same release that starts writing the new key.
- Rollback compatibility: the new app reads documents written by the previous app. The previous app keeps working against documents written before the backfill, so an app rollback does not require an immediate database rollback.
- Restore: take a backup of the affected collections before the backfill and before an index build. The backfill PR names the restore command and the point-in-time the backup must cover. L's drill uses that procedure on the synthetic copy.

### ADR plan

Proposed decisions live in `docs/adr/`. They are not accepted until the CTO marks them accepted. The set for this wave:

- `docs/adr/0001-tenancy.md`
- `docs/adr/0002-identity.md`
- `docs/adr/0003-billing-snapshots.md`
- `docs/adr/0004-transaction-requirements.md`
- `docs/adr/0005-polling.md`

CTO acceptance for a production deploy: Wave 0, H's schema for any collection that deploy writes, A, and B are merged. A deploy without A leaves loyalty and both connector contracts blocked. A deploy without B leaves cancel, append, and lost-update behavior as in F-02. L's required gates are the last merge on the release branch, not the first.

### TRONX PRO MAX DEMO RESTAURANT

The current seed is not this demo. `lib/demo/seed-demo-kitchen.ts` upserts one restaurant, 8 tables, and dishes from `fixtures/tronx-demo-kitchen-menu.xlsx`. That workbook has 80 menu rows, 12 categories, and 16 items with Half or Full. It does not create captains, ingredients, recipes, suppliers, purchase orders, coupons, or shifts. It also embeds an admin password in source. Stream D owns that route, `lib/demo/**`, and `scripts/verify-demo-reupload-import.mjs`, and removes the literal. Do not point the seed at a shared database.

Build a new pair of scripts. Do not run them in production.

`scripts/seed-pro-max-demo.ts`

- Refuse unless `MONGODB_URI` contains `localhost` or `127.0.0.1`, and refuse when `NODE_ENV` is `production`. Do not honor `ALLOW_PRODUCTION_SEED`.
- Read staff passwords from the environment (`PRO_MAX_DEMO_ADMIN_PASSWORD` and similar). Fail if they are missing. Never print them.
- Fixed id prefix `pro-max-demo-` on every document so cleanup is exact.
- One organization and one outlet named `TRONX PRO MAX DEMO RESTAURANT`, plan ENTERPRISE, currency INR, GST enabled, intra-state supply, packaging and service charge set to non-zero values so the bill UI can be checked, loyalty enabled.
- 50 tables, capacities mixed, all `OPEN`.
- 100 or more dishes across categories, with variants on a subset, add-on groups, SKUs, kitchen stations, and a few dish-level tax overrides (5% and 12% beside the outlet 5% or 18%, whichever the seed config sets).
- Ingredients, recipes for a subset of dishes, two suppliers, two purchase orders (one received, one open), three coupons (percent, fixed, expired).
- 10 captains. Each has one or more tables. At least two captains share no tables. At least one captain has several tables. One captain has payment permission off, so QA can see a 403.
- Shifts: one closed historical shift and no open shift, so QA can open a shift in the UI.
- Phase A uses today's roles: one restaurant admin and 10 captains. Two managers, two cashiers, and three kitchen users are **blocked** until Stream D and Stream H land a membership collection. Phase B of the same script creates those users only when the collection exists, and skips them with a printed reason when it does not.

`scripts/cleanup-pro-max-demo.ts`

- Same loopback refusal.
- Deletes by id prefix and by `restaurantId` equal to the demo outlet id, including orders, print jobs, and loyalty rows.
- Refuses to run if the outlet id is anything other than the constant demo id.
- A dry-run flag prints counts only.

QA acceptance: after seed, a captain with no phone on the guest can place an order on an assigned table; a second assigned table is visible; an unassigned table is rejected; a QR order sits in approvals until a captain approves it; the kitchen poll shows it after approval; the stored total matches `calculateRestaurantBill`; cleanup leaves zero `pro-max-demo-` documents.

### Test strategy

**Unit.** Keep `node:test`. Fix the captain credential double. Add one test that a partial cancel's stored CGST, SGST, IGST, packaging, and total match `calculateRestaurantBill`. Add one test that every route file is classified. Do not claim a coverage percentage until a coverage tool is wired. Target, once wired: the bill module, authz table, and order transitions at 100% of their branches. That number is a goal, not a measurement.

**API.** Against the local replica set only. Hit public order, captain approve, POS pay, refund, coupon redeem, and a cross-outlet read that must 403. Use synthetic ids from the demo prefix.

**E2E.** Playwright against `next start` on localhost with the demo seed. Cover guest QR, captain multi-table order without a phone, POS cash close, and kitchen column move. Do not point Playwright at `tronxvideomenu.vercel.app`.

**Concurrency and load.** Re-enable `tests/integration/*.test.ts` on a replica set (coupon limit, loyalty overdraw, stock, print lease). Add the lost-update and crash-retry tests from the money-integrity section. Add a load script that starts 100 synthetic users against localhost: a mix of QR creates with distinct idempotency keys, captain polls, and kitchen polls. Payment calls use a mock adapter that records tenders in memory and never contacts a bank. Pass condition to write down when it is actually run: zero duplicate orders for one idempotency key, zero negative stock, zero coupon redemptions above `maxRedemptions`, zero double cancels on retry, and p95 of the poll endpoints recorded from that run. Do not invent those latencies now.

**Security.** CI runs `npm audit` and a secret scan that fails on `mongodb+srv://` with credentials and on private-key blocks. Authz matrix test from Stream A, including the ten handler contracts. IDOR fixtures: restaurant A cookie requesting restaurant B's order, dish, customer, and print job. Pairing accepts a valid unused code and rejects a connector secret presented as a code. Heartbeat, job poll, and ack require the connector secret and reject a staff cookie used alone. Rate limits and CSRF checks are the deliverables in Security and operations. Login limiter must fail closed when its store is down.

## Appendix — route handlers

Generated from `app/api/**/route.ts` and `classifyApiRequest`. 173 handlers. Proxy class is the edge gate. Handler files may require a narrower role.

| Method | Path | Proxy class | Handler |
| --- | --- | --- | --- |
| GET | `/api/addon-groups` | staff | `app/api/addon-groups/route.ts` |
| POST | `/api/addon-groups` | staff | `app/api/addon-groups/route.ts` |
| GET | `/api/addon-groups/[addonGroupId]` | staff | `app/api/addon-groups/[addonGroupId]/route.ts` |
| PATCH | `/api/addon-groups/[addonGroupId]` | staff | `app/api/addon-groups/[addonGroupId]/route.ts` |
| DELETE | `/api/addon-groups/[addonGroupId]` | staff | `app/api/addon-groups/[addonGroupId]/route.ts` |
| GET | `/api/addons` | staff | `app/api/addons/route.ts` |
| POST | `/api/addons` | staff | `app/api/addons/route.ts` |
| GET | `/api/addons/[addonId]` | staff | `app/api/addons/[addonId]/route.ts` |
| PATCH | `/api/addons/[addonId]` | staff | `app/api/addons/[addonId]/route.ts` |
| DELETE | `/api/addons/[addonId]` | staff | `app/api/addons/[addonId]/route.ts` |
| GET | `/api/admin/billing` | restaurant_admin | `app/api/admin/billing/route.ts` |
| PUT | `/api/admin/billing` | restaurant_admin | `app/api/admin/billing/route.ts` |
| POST | `/api/admin/billing/bulk-tax` | restaurant_admin | `app/api/admin/billing/bulk-tax/route.ts` |
| POST | `/api/admin/billing/preview` | restaurant_admin | `app/api/admin/billing/preview/route.ts` |
| GET | `/api/admin/captains` | restaurant_admin | `app/api/admin/captains/route.ts` |
| POST | `/api/admin/captains` | restaurant_admin | `app/api/admin/captains/route.ts` |
| PATCH | `/api/admin/captains/[captainId]` | restaurant_admin | `app/api/admin/captains/[captainId]/route.ts` |
| POST | `/api/admin/captains/[captainId]/credentials` | restaurant_admin | `app/api/admin/captains/[captainId]/credentials/route.ts` |
| POST | `/api/admin/captains/[captainId]/password` | restaurant_admin | `app/api/admin/captains/[captainId]/password/route.ts` |
| PUT | `/api/admin/captains/[captainId]/tables` | restaurant_admin | `app/api/admin/captains/[captainId]/tables/route.ts` |
| GET | `/api/admin/menu-export` | restaurant_admin | `app/api/admin/menu-export/route.ts` |
| GET | `/api/admin/menu-import` | restaurant_admin | `app/api/admin/menu-import/route.ts` |
| POST | `/api/admin/menu-import` | restaurant_admin | `app/api/admin/menu-import/route.ts` |
| GET | `/api/admin/menu-import/template` | restaurant_admin | `app/api/admin/menu-import/template/route.ts` |
| GET | `/api/admin/menu-import/[jobId]` | restaurant_admin | `app/api/admin/menu-import/[jobId]/route.ts` |
| POST | `/api/admin/menu-import/[jobId]/analyze` | restaurant_admin | `app/api/admin/menu-import/[jobId]/analyze/route.ts` |
| POST | `/api/admin/menu-import/[jobId]/cancel` | restaurant_admin | `app/api/admin/menu-import/[jobId]/cancel/route.ts` |
| POST | `/api/admin/menu-import/[jobId]/commit` | restaurant_admin | `app/api/admin/menu-import/[jobId]/commit/route.ts` |
| PATCH | `/api/admin/menu-import/[jobId]/mapping` | restaurant_admin | `app/api/admin/menu-import/[jobId]/mapping/route.ts` |
| PATCH | `/api/admin/menu-import/[jobId]/preview` | restaurant_admin | `app/api/admin/menu-import/[jobId]/preview/route.ts` |
| GET | `/api/admin/restaurant/wifi` | restaurant_admin | `app/api/admin/restaurant/wifi/route.ts` |
| PATCH | `/api/admin/restaurant/wifi` | restaurant_admin | `app/api/admin/restaurant/wifi/route.ts` |
| GET | `/api/ai/alerts` | staff | `app/api/ai/alerts/route.ts` |
| POST | `/api/ai/alerts` | staff | `app/api/ai/alerts/route.ts` |
| POST | `/api/ai/assistant` | staff | `app/api/ai/assistant/route.ts` |
| GET | `/api/ai/evaluation` | staff | `app/api/ai/evaluation/route.ts` |
| GET | `/api/ai/forecast` | staff | `app/api/ai/forecast/route.ts` |
| GET | `/api/ai/inventory` | staff | `app/api/ai/inventory/route.ts` |
| GET | `/api/ai/menu` | staff | `app/api/ai/menu/route.ts` |
| GET | `/api/ai/overview` | staff | `app/api/ai/overview/route.ts` |
| GET | `/api/ai/usage` | staff | `app/api/ai/usage/route.ts` |
| POST | `/api/auth/login` | public | `app/api/auth/login/route.ts` |
| GET | `/api/auth/logout` | public | `app/api/auth/logout/route.ts` |
| POST | `/api/auth/logout` | public | `app/api/auth/logout/route.ts` |
| GET | `/api/captain/approvals` | captain | `app/api/captain/approvals/route.ts` |
| GET | `/api/captain/kitchen` | captain | `app/api/captain/kitchen/route.ts` |
| POST | `/api/captain/login` | public | `app/api/captain/login/route.ts` |
| POST | `/api/captain/logout` | public | `app/api/captain/logout/route.ts` |
| GET | `/api/captain/orders` | captain | `app/api/captain/orders/route.ts` |
| POST | `/api/captain/orders` | captain | `app/api/captain/orders/route.ts` |
| GET | `/api/captain/orders/[orderId]` | captain | `app/api/captain/orders/[orderId]/route.ts` |
| PATCH | `/api/captain/orders/[orderId]` | captain | `app/api/captain/orders/[orderId]/route.ts` |
| POST | `/api/captain/orders/[orderId]/authorize` | captain | `app/api/captain/orders/[orderId]/authorize/route.ts` |
| GET | `/api/captain/requests` | captain | `app/api/captain/requests/route.ts` |
| POST | `/api/captain/requests` | captain | `app/api/captain/requests/route.ts` |
| PATCH | `/api/captain/requests/[requestId]` | captain | `app/api/captain/requests/[requestId]/route.ts` |
| GET | `/api/captain/table-stats` | captain | `app/api/captain/table-stats/route.ts` |
| GET | `/api/captain/tables` | captain | `app/api/captain/tables/route.ts` |
| GET | `/api/captain/tables/[tableId]` | captain | `app/api/captain/tables/[tableId]/route.ts` |
| PATCH | `/api/captain/tables/[tableId]` | captain | `app/api/captain/tables/[tableId]/route.ts` |
| GET | `/api/categories` | staff | `app/api/categories/route.ts` |
| POST | `/api/categories` | staff | `app/api/categories/route.ts` |
| GET | `/api/categories/[categoryId]` | staff | `app/api/categories/[categoryId]/route.ts` |
| PATCH | `/api/categories/[categoryId]` | staff | `app/api/categories/[categoryId]/route.ts` |
| DELETE | `/api/categories/[categoryId]` | staff | `app/api/categories/[categoryId]/route.ts` |
| POST | `/api/connector/heartbeat` | staff | `app/api/connector/heartbeat/route.ts` |
| GET | `/api/connector/jobs` | staff | `app/api/connector/jobs/route.ts` |
| POST | `/api/connector/jobs/[jobId]/ack` | staff | `app/api/connector/jobs/[jobId]/ack/route.ts` |
| POST | `/api/connector/pair` | staff | `app/api/connector/pair/route.ts` |
| GET | `/api/crm/coupons` | staff | `app/api/crm/coupons/route.ts` |
| POST | `/api/crm/coupons` | staff | `app/api/crm/coupons/route.ts` |
| GET | `/api/crm/customers` | staff | `app/api/crm/customers/route.ts` |
| POST | `/api/crm/customers` | staff | `app/api/crm/customers/route.ts` |
| GET | `/api/crm/feedback` | staff | `app/api/crm/feedback/route.ts` |
| POST | `/api/crm/feedback` | staff | `app/api/crm/feedback/route.ts` |
| POST | `/api/dev/seed-demo-kitchen` | public | `app/api/dev/seed-demo-kitchen/route.ts` |
| GET | `/api/devices` | staff | `app/api/devices/route.ts` |
| POST | `/api/devices` | staff | `app/api/devices/route.ts` |
| GET | `/api/devices/[deviceId]` | staff | `app/api/devices/[deviceId]/route.ts` |
| PATCH | `/api/devices/[deviceId]` | staff | `app/api/devices/[deviceId]/route.ts` |
| DELETE | `/api/devices/[deviceId]` | staff | `app/api/devices/[deviceId]/route.ts` |
| POST | `/api/devices/[deviceId]/assign` | staff | `app/api/devices/[deviceId]/assign/route.ts` |
| DELETE | `/api/devices/[deviceId]/assign` | staff | `app/api/devices/[deviceId]/assign/route.ts` |
| POST | `/api/devices/[deviceId]/command` | staff | `app/api/devices/[deviceId]/command/route.ts` |
| POST | `/api/devices/[deviceId]/preview` | staff | `app/api/devices/[deviceId]/preview/route.ts` |
| POST | `/api/devices/[deviceId]/reconnect` | staff | `app/api/devices/[deviceId]/reconnect/route.ts` |
| GET | `/api/devices/compatibility` | staff | `app/api/devices/compatibility/route.ts` |
| GET | `/api/devices/connectors` | staff | `app/api/devices/connectors/route.ts` |
| POST | `/api/devices/connectors/pairing` | staff | `app/api/devices/connectors/pairing/route.ts` |
| POST | `/api/devices/connectors/[connectorId]/revoke` | staff | `app/api/devices/connectors/[connectorId]/revoke/route.ts` |
| POST | `/api/devices/connectors/[connectorId]/rotate` | staff | `app/api/devices/connectors/[connectorId]/rotate/route.ts` |
| GET | `/api/devices/diagnostics` | staff | `app/api/devices/diagnostics/route.ts` |
| GET | `/api/devices/events` | staff | `app/api/devices/events/route.ts` |
| GET | `/api/devices/fleet` | staff | `app/api/devices/fleet/route.ts` |
| GET | `/api/devices/jobs` | staff | `app/api/devices/jobs/route.ts` |
| POST | `/api/devices/jobs/[jobId]/fallback` | staff | `app/api/devices/jobs/[jobId]/fallback/route.ts` |
| POST | `/api/devices/jobs/[jobId]/retry` | staff | `app/api/devices/jobs/[jobId]/retry/route.ts` |
| GET | `/api/devices/pilot` | staff | `app/api/devices/pilot/route.ts` |
| POST | `/api/devices/pilot` | staff | `app/api/devices/pilot/route.ts` |
| POST | `/api/devices/sample` | staff | `app/api/devices/sample/route.ts` |
| GET | `/api/dishes` | staff | `app/api/dishes/route.ts` |
| POST | `/api/dishes` | staff | `app/api/dishes/route.ts` |
| GET | `/api/dishes/[dishId]` | staff | `app/api/dishes/[dishId]/route.ts` |
| PATCH | `/api/dishes/[dishId]` | staff | `app/api/dishes/[dishId]/route.ts` |
| DELETE | `/api/dishes/[dishId]` | staff | `app/api/dishes/[dishId]/route.ts` |
| GET | `/api/inventory/adjustments` | staff | `app/api/inventory/adjustments/route.ts` |
| POST | `/api/inventory/adjustments` | staff | `app/api/inventory/adjustments/route.ts` |
| GET | `/api/inventory/ingredients` | staff | `app/api/inventory/ingredients/route.ts` |
| POST | `/api/inventory/ingredients` | staff | `app/api/inventory/ingredients/route.ts` |
| PATCH | `/api/inventory/ingredients/[ingredientId]` | staff | `app/api/inventory/ingredients/[ingredientId]/route.ts` |
| DELETE | `/api/inventory/ingredients/[ingredientId]` | staff | `app/api/inventory/ingredients/[ingredientId]/route.ts` |
| GET | `/api/inventory/profitability/[dishId]` | staff | `app/api/inventory/profitability/[dishId]/route.ts` |
| GET | `/api/inventory/recipes` | staff | `app/api/inventory/recipes/route.ts` |
| POST | `/api/inventory/recipes` | staff | `app/api/inventory/recipes/route.ts` |
| GET | `/api/kitchen/orders` | staff | `app/api/kitchen/orders/route.ts` |
| PATCH | `/api/kitchen/orders/[orderId]/items` | staff | `app/api/kitchen/orders/[orderId]/items/route.ts` |
| GET | `/api/media` | staff | `app/api/media/route.ts` |
| POST | `/api/media/upload` | staff | `app/api/media/upload/route.ts` |
| DELETE | `/api/media/[mediaId]` | staff | `app/api/media/[mediaId]/route.ts` |
| GET | `/api/orders` | staff | `app/api/orders/route.ts` |
| GET | `/api/orders/[orderId]` | staff | `app/api/orders/[orderId]/route.ts` |
| PATCH | `/api/orders/[orderId]` | staff | `app/api/orders/[orderId]/route.ts` |
| GET | `/api/orders/[orderId]/cancel-lines` | staff | `app/api/orders/[orderId]/cancel-lines/route.ts` |
| POST | `/api/orders/[orderId]/cancel-lines` | floor | `app/api/orders/[orderId]/cancel-lines/route.ts` |
| POST | `/api/orders/[orderId]/payment` | floor | `app/api/orders/[orderId]/payment/route.ts` |
| GET | `/api/orders/[orderId]/status` | public | `app/api/orders/[orderId]/status/route.ts` |
| GET | `/api/organization` | staff | `app/api/organization/route.ts` |
| POST | `/api/organization` | staff | `app/api/organization/route.ts` |
| GET | `/api/organization/menu-sync` | staff | `app/api/organization/menu-sync/route.ts` |
| POST | `/api/organization/menu-sync` | staff | `app/api/organization/menu-sync/route.ts` |
| POST | `/api/pos/orders` | floor | `app/api/pos/orders/route.ts` |
| POST | `/api/pos/orders/[orderId]/refund` | staff | `app/api/pos/orders/[orderId]/refund/route.ts` |
| POST | `/api/pos/orders/[orderId]/reprint` | staff | `app/api/pos/orders/[orderId]/reprint/route.ts` |
| GET | `/api/pos/shifts` | staff | `app/api/pos/shifts/route.ts` |
| POST | `/api/pos/shifts` | staff | `app/api/pos/shifts/route.ts` |
| GET | `/api/procurement/purchase-orders` | staff | `app/api/procurement/purchase-orders/route.ts` |
| POST | `/api/procurement/purchase-orders` | staff | `app/api/procurement/purchase-orders/route.ts` |
| POST | `/api/procurement/purchase-orders/[poId]/receive` | staff | `app/api/procurement/purchase-orders/[poId]/receive/route.ts` |
| GET | `/api/procurement/suppliers` | staff | `app/api/procurement/suppliers/route.ts` |
| POST | `/api/procurement/suppliers` | staff | `app/api/procurement/suppliers/route.ts` |
| POST | `/api/public/loyalty/forgot-password` | staff | `app/api/public/loyalty/forgot-password/route.ts` |
| POST | `/api/public/loyalty/login` | staff | `app/api/public/loyalty/login/route.ts` |
| POST | `/api/public/loyalty/logout` | staff | `app/api/public/loyalty/logout/route.ts` |
| GET | `/api/public/loyalty/me` | staff | `app/api/public/loyalty/me/route.ts` |
| POST | `/api/public/loyalty/register` | staff | `app/api/public/loyalty/register/route.ts` |
| POST | `/api/public/loyalty/reset-password` | staff | `app/api/public/loyalty/reset-password/route.ts` |
| POST | `/api/public/orders` | public | `app/api/public/orders/route.ts` |
| POST | `/api/public/reservations` | public | `app/api/public/reservations/route.ts` |
| POST | `/api/public/reservations/availability` | public | `app/api/public/reservations/availability/route.ts` |
| GET | `/api/public/restaurants/[slug]/translations` | public | `app/api/public/restaurants/[slug]/translations/route.ts` |
| GET | `/api/public/restaurants/[slug]/wifi` | public | `app/api/public/restaurants/[slug]/wifi/route.ts` |
| GET | `/api/reports/dashboard` | staff | `app/api/reports/dashboard/route.ts` |
| GET | `/api/reports/tables` | staff | `app/api/reports/tables/route.ts` |
| GET | `/api/reservations` | staff | `app/api/reservations/route.ts` |
| GET | `/api/reservations/[reservationId]` | staff | `app/api/reservations/[reservationId]/route.ts` |
| PATCH | `/api/reservations/[reservationId]` | staff | `app/api/reservations/[reservationId]/route.ts` |
| GET | `/api/restaurants` | public | `app/api/restaurants/route.ts` |
| POST | `/api/restaurants` | staff | `app/api/restaurants/route.ts` |
| GET | `/api/restaurants/[restaurantId]` | public | `app/api/restaurants/[restaurantId]/route.ts` |
| PATCH | `/api/restaurants/[restaurantId]` | staff | `app/api/restaurants/[restaurantId]/route.ts` |
| DELETE | `/api/restaurants/[restaurantId]` | staff | `app/api/restaurants/[restaurantId]/route.ts` |
| GET | `/api/super-admin/access-assignments` | super_admin | `app/api/super-admin/access-assignments/route.ts` |
| PUT | `/api/super-admin/access-assignments` | super_admin | `app/api/super-admin/access-assignments/route.ts` |
| GET | `/api/super-admin/restaurant-admins` | super_admin | `app/api/super-admin/restaurant-admins/route.ts` |
| PUT | `/api/super-admin/restaurant-admins/[restaurantId]` | super_admin | `app/api/super-admin/restaurant-admins/[restaurantId]/route.ts` |
| PATCH | `/api/super-admin/restaurant-admins/[restaurantId]` | super_admin | `app/api/super-admin/restaurant-admins/[restaurantId]/route.ts` |
| POST | `/api/super-admin/restaurant-admins/[restaurantId]/migrate` | super_admin | `app/api/super-admin/restaurant-admins/[restaurantId]/migrate/route.ts` |
| POST | `/api/super-admin/restaurant-admins/[restaurantId]/password` | super_admin | `app/api/super-admin/restaurant-admins/[restaurantId]/password/route.ts` |
| POST | `/api/super-admin/restaurant-admins/[restaurantId]/verify` | super_admin | `app/api/super-admin/restaurant-admins/[restaurantId]/verify/route.ts` |
| GET | `/api/tables` | staff | `app/api/tables/route.ts` |
| POST | `/api/tables` | staff | `app/api/tables/route.ts` |
| PATCH | `/api/tables/[tableId]` | staff | `app/api/tables/[tableId]/route.ts` |
| DELETE | `/api/tables/[tableId]` | staff | `app/api/tables/[tableId]/route.ts` |

Handler purpose, by prefix:

| Prefix | Purpose |
| --- | --- |
| `/api/addon-groups`, `/api/addons`, `/api/categories`, `/api/dishes` | Outlet catalog CRUD. Handlers require a restaurant admin and force `restaurantId` from the session. |
| `/api/admin/billing` | Read and save GST, packaging, and service charge. Preview uses `calculateRestaurantBill`. Bulk tax writes dish overrides. |
| `/api/admin/captains` | Create captains, set permissions, assign tables, reset or reveal passwords. |
| `/api/admin/menu-import`, `/api/admin/menu-export` | Excel template, upload, column mapping, preview, commit, cancel, and workbook download. |
| `/api/admin/restaurant/wifi` | Admin view of SSID and whether a password is stored. Does not return the password. |
| `/api/ai/*` | Forecast, menu and inventory intelligence, alerts, assistant, evaluation, usage. Feature-gated. Heuristic provider when no API key. |
| `/api/auth` | Restaurant admin and super admin login and logout. |
| `/api/captain/*` | Captain session, assigned tables, walk-in orders, QR approval, kitchen poll, service requests. |
| `/api/categories`, `/api/dishes` | See catalog. |
| `/api/connector/pair` | Claim a one-time pairing code. No connector secret and no staff session. Proxy currently requires a staff cookie. |
| `/api/connector/heartbeat`, `/api/connector/jobs` | Secret-authenticated heartbeat, poll, and ack. Not a pairing code. Proxy currently requires a staff cookie. |
| `/api/crm/*` | Customers, coupons, feedback for the signed-in outlet. |
| `/api/dev/seed-demo-kitchen` | Upsert the small demo kitchen. Public at the proxy. Blocked when `NODE_ENV` is `production` unless `ALLOW_PRODUCTION_SEED=true`. |
| `/api/devices/*` | Register, assign, command, and diagnose printers and simulators. Pairing codes for connectors. |
| `/api/inventory/*` | Ingredients, recipes, adjustments, dish profitability. |
| `/api/kitchen/orders` | Kitchen board and per-line prep status. |
| `/api/media` | List, upload, and delete Cloudinary assets for the outlet. |
| `/api/orders` | Staff order list, read, patch, line cancel, payment record. `GET .../status` is the guest poll and requires a bearer token in the handler. |
| `/api/organization` | Create an organization, attach outlets, stock transfers, menu sync. |
| `/api/pos/orders` | Create a POS or captain-priced order. Refund and reprint are staff-only. |
| `/api/pos/shifts` | Open and close the cash shift. Staff cookie only. |
| `/api/procurement/*` | Suppliers, purchase orders, goods receipt. |
| `/api/public/loyalty/login`, `register`, `forgot-password`, `reset-password` | Anonymous. Must not require a customer session. Proxy class is `staff` today. |
| `/api/public/loyalty/logout`, `/api/public/loyalty/me` | No staff cookie. Logout clears the customer cookie. `me` returns null without one. |
| `/api/public/orders` | Guest QR order. |
| `/api/public/reservations` | Guest availability and create. |
| `/api/public/restaurants/[slug]/translations` | Public translated strings. |
| `/api/public/restaurants/[slug]/wifi` | Public SSID and decrypted password when the feature is on. |
| `/api/reports/*` | Dashboard sales and table analytics. |
| `/api/reservations` | Staff list and status updates. |
| `/api/restaurants` | List and create for admins. `GET /[id]?fullMenu=true` is the public catalog. |
| `/api/super-admin/*` | Admin account migrate, verify, password, and org access assignment. |
| `/api/tables` | Create, update, and delete outlet tables. |
