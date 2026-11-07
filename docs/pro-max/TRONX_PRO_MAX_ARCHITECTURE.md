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

Mismatches that matter are findings F-01 and F-07: loyalty and connector routes are `staff` even though their handlers expect a customer session or a connector secret; the demo seed route is `public`.

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
2. **One policy module.** `classifyApiRequest` and the handler guards read the same table: public, customer, connector, captain, outlet staff, org admin, super admin. Add customer and connector as first-class classes. Proxy and handler tests must list all 173 handlers.
3. **One order writer.** `order.service.ts` stays the aggregate. QR, POS, and captain are adapters. They all call the same price, tax, idempotency, and KOT functions. Cancel uses `calculateRestaurantBill` and writes every money field.
4. **One bill module.** Delete `computeBillTotals` from UI and from cancel after the UI imports `calculateRestaurantBill`. Keep `lineItemTotal` and `roundMoney`.
5. **Staff identities.** Replace the unique-per-outlet admin account with many memberships: manager, cashier, kitchen, captain. Captains can remain a floor role with table assignments. Kitchen and cashier get their own sessions and a smaller permission set.
6. **Money.** Recorded tenders stay for cash. Add a `PaymentAdapter` interface with a mock implementation for tests. Do not call a live gateway from the demo. Refunds and cash close go through the adapter and the shift, and they require the cashier or manager role.
7. **Realtime later.** Keep polling until an SSE channel exists for kitchen and captain. Do not introduce a second order state in the client.
8. **Data.** Require a Mongo replica set in every deployed environment. Fail startup if a transaction probe fails, instead of silently using the compensating path for payments, stock, and coupon redemption.
9. **CI.** GitHub Actions on pull requests: lint, `tsc --noEmit`, unit tests, and, on a service container, the integration suite against a local replica set. Turn `ignoreBuildErrors` off once `tsc` is clean. Secret scanning stays on; do not print env values.

### Workstreams

These streams can run at the same time only if they stay inside the paths listed. Shared files are called out so two people do not edit them.

**Wave 0, serial, before the parallel wave.** Owner: Backend, reviewed by CTO.

- Split `lib/validations/index.ts` into domain modules and a barrel that only re-exports. After this, each stream adds schemas in its own file.
- No feature changes.

**Stream A — Authz matrix.** Owner: Backend. Reviewer: CTO.

- Files: `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts` only.
- Acceptance: loyalty routes classify as a new `customer` class (or `public` plus handler-level customer session). Connector routes classify as `connector` and reach `requireConnectorAuth` with no staff cookie. A test enumerates every `app/api/**/route.ts` method so a new route cannot fall through to `staff` by accident. Existing captain-vs-admin tests still pass.

**Stream B — Order aggregate.** Owner: Backend.

- Files: `lib/services/order.service.ts`, `lib/repositories/order.repository.ts`, `lib/order-authorization.ts`, `lib/order-transitions.ts`, `app/api/orders/**`, `app/api/public/orders/**`, `app/api/pos/orders/**`, `app/api/captain/orders/**`, `tests/order-*.ts`, `tests/captain-authorization.test.ts`, `tests/pos-order-schema.test.ts`, `tests/captain-order-schema.test.ts`, `tests/captain-pos-order-schema.test.ts`.
- Acceptance: QR accepts variants the same way POS does. Line cancel calls `calculateRestaurantBill` and persists CGST, SGST, IGST, packaging, service charge, and `billSnapshot` together with `total`. Public idempotency returns the existing order instead of a bare 409. No other stream edits these files in this wave.

**Stream C — Bill UI.** Owner: Frontend. Reviewer: Backend for the import of the calculator.

- Files: `components/admin/PosTerminal.tsx`, `components/captain/CaptainOrderPad.tsx`, `components/admin/BillingSettingsForm.tsx`, `app/admin/[slug]/settings/billing/**`, `app/api/admin/billing/**`, `tests/billing-calculator.test.ts`.
- Do not edit `lib/services/order.service.ts` (Stream B) or `lib/order-pricing.ts` until Stream B has removed the cancel dependency. The UI may import `calculateRestaurantBill` as it exists today.
- Acceptance: the amount on screen equals `calculateRestaurantBill` for packaging, service charge, inclusive mode, and IGST. A unit test feeds the same lines to the screen helper and to the server helper.

**Stream D — Identities.** Owner: Backend. UI by Frontend on the files below only.

- Files: `lib/auth-core.ts`, `lib/auth-server.ts`, `lib/security/**`, `lib/services/captain.service.ts`, `lib/services/restaurant-admin.service.ts`, `lib/repositories/captain.repository.ts`, `lib/repositories/restaurant-admin.repository.ts`, `app/api/auth/**`, `app/api/captain/login/**`, `app/api/captain/logout/**`, `app/api/admin/captains/**`, `app/api/super-admin/**`, `components/super-admin/**`, `components/auth/**`, `components/admin/CaptainManagement.tsx`, `tests/credential-crypto.test.ts`, `tests/captain-credential-access.test.ts`, `tests/restaurant-admin-auth.test.ts`.
- Schema changes go through Stream H, not by editing `lib/db/models.ts` ad hoc.
- Acceptance: the failing credential test passes against a repository double that includes `touchLastActiveAt`. New memberships are specified so two managers can exist. Password recovery is either removed or gated behind an explicit audited reveal with a reason. Demo passwords are not literals in git; the seed reads them from the environment.

**Stream E — Floor UI (captain, kitchen, tables, reservations).** Owner: Frontend. QA writes the cases.

- Files: `app/captain/**`, `components/captain/**` except the order-pad bill math owned by Stream C (`CaptainOrderPad.tsx` stays with Stream C), `components/kitchen/**`, `components/admin/KitchenDisplay.tsx`, `components/admin/TablesManager.tsx`, `components/admin/ReservationsManager.tsx`, `components/customer/ReservationPanel.tsx`, `app/admin/[slug]/kitchen/**`, `app/admin/[slug]/tables/**`, `app/admin/[slug]/reservations/**`, `app/api/kitchen/**`, `app/api/captain/kitchen/**`, `app/api/captain/tables/**`, `app/api/captain/approvals/**`, `app/api/captain/requests/**`, `app/api/tables/**`, `app/api/reservations/**`, `app/api/public/reservations/**`, `lib/services/table.service.ts`, `lib/services/reservation.service.ts`, `lib/captain-floor.ts`, `lib/kitchen-board.ts`.
- Acceptance: `tsc` is clean for table statuses `BILL_REQUESTED`, `PAYMENT_PENDING`, and `CLEANING`. Captain approval and KDS still compile. No edits to `order.service.ts`.

**Stream F — Menu and catalog.** Owner: Frontend plus Backend for import.

- Files: `components/admin/DishesManager.tsx`, `CategoriesManager.tsx`, `AddonsManager.tsx`, `MenuImportWizard.tsx`, `MediaManager.tsx`, `MediaPicker.tsx`, `app/admin/[slug]/menu/**`, `app/admin/[slug]/media/**`, `app/api/dishes/**`, `app/api/categories/**`, `app/api/addons/**`, `app/api/addon-groups/**`, `app/api/media/**`, `app/api/admin/menu-import/**`, `app/api/admin/menu-export/**`, `lib/menu-import/**`, `lib/menu-export/**`, `lib/services/dish.service.ts`, `lib/services/category.service.ts`, `lib/services/addon.service.ts`, `lib/services/menu-import.service.ts`, `lib/services/media.service.ts`, `tests/menu-import.test.ts`, `tests/menu-export.test.ts`.
- Acceptance: existing import/export tests pass. Replace or isolate `xlsx` so untrusted workbooks are not parsed by the vulnerable package (F-08). Customer variant UI is Stream G, not this stream, except the dish admin form.

**Stream G — Customer menu and loyalty UX.** Owner: Frontend.

- Files: `app/menu/**`, `app/page.tsx`, `components/customer/**`, `app/api/public/loyalty/**`, `app/api/public/restaurants/**`, `lib/customer-auth.ts`, `lib/services/customer-loyalty.service.ts`, `lib/services/translation.service.ts`, `lib/i18n/**`.
- Depends on Stream A for loyalty actually getting past the proxy. This stream does not edit `proxy.ts`.
- Acceptance: customer components can submit a variant id. Loyalty pages call the existing handlers. Marketing copy no longer says the kitchen is instant while approval and polling are the implementation.

**Stream H — Schema steward.** Owner: Backend. CTO reviews every change.

- Files: `lib/db/models.ts`, `types/index.ts`, `lib/db/mongo-mappers.ts`. Nobody else edits these during the wave. Other streams send a patch to this owner.
- Acceptance: indexes for any new membership collection; no second source of truth for money fields; a short note of each new collection.

**Stream I — Inventory, procurement, CRM, reports, multi-outlet.** Owner: Backend. Frontend for the matching screens. These four subfolders do not overlap:

- Inventory: `lib/inventory/**`, `lib/services/inventory.service.ts`, `components/admin/InventoryManager.tsx`, `components/admin/RecipeEditor.tsx`, `app/admin/[slug]/inventory/**`, `app/api/inventory/**`, `tests/inventory-*.ts`, `tests/recipe-cost.test.ts`.
- Procurement: `lib/services/procurement.service.ts`, `components/admin/ProcurementManager.tsx`, `app/admin/[slug]/procurement/**`, `app/api/procurement/**`.
- CRM admin: `lib/crm/**`, `lib/services/crm.service.ts`, `components/admin/CrmManager.tsx`, `app/admin/[slug]/crm/**`, `app/api/crm/**`, `tests/loyalty-coupons.test.ts`. Customer loyalty UI stays in Stream G.
- Org and reports: `lib/org-rbac.ts`, `lib/services/organization.service.ts`, `lib/services/menu-sync.service.ts`, `lib/services/reporting.service.ts`, `lib/analytics/**` (read models only; AI provider stays in Stream J), `components/admin/OrganizationDashboard.tsx`, `components/admin/ReportsDashboard.tsx`, `app/admin/[slug]/organization/**`, `app/admin/[slug]/reports/**`, `app/api/organization/**`, `app/api/reports/**`, `tests/org-rbac.test.ts`, `tests/multi-outlet-boundaries.test.ts`, `tests/financial-reconciliation.test.ts`, `tests/analytics-sales.test.ts`.

- Acceptance: each subfolder's current unit tests still pass. Stock transfer and coupon redemption keep their idempotency keys. No change to order create.

**Stream J — AI.** Owner: Backend.

- Files: `lib/ai/**`, `lib/services/ai-assistant.service.ts`, `lib/services/ai-alert.service.ts`, `lib/services/ai-evaluation.service.ts`, `lib/services/forecast.service.ts`, `components/admin/ai/**`, `app/admin/[slug]/ai/**`, `app/api/ai/**`, `tests/ai-*.ts`.
- Acceptance: heuristic mode still refuses unknown tools. No provider call in unit tests. Outlet id still comes from the session, not the model.

**Stream K — Hardware.** Owner: Backend. The connector is a separate package so it does not collide with the Next app except the route files named here.

- Files: `lib/devices/**`, `lib/services/device.service.ts`, `lib/services/device-fleet.service.ts`, `lib/services/device-diagnostics.service.ts`, `lib/services/connector.service.ts`, `lib/connector-auth.ts`, `device-connector/**`, `components/admin/DevicesManager.tsx`, `app/admin/[slug]/devices/**`, `app/api/devices/**`, `app/api/connector/**`, `tests/device-*.ts`, `tests/connector-pairing.test.ts`, `tests/escpos-layout.test.ts`, `tests/barcode-wedge.test.ts`.
- Proxy class for connector routes is Stream A's file. This stream only changes the handlers and the connector client. Acceptance: connector unit tests pass; handlers still require the connector secret; USB stays labeled unsupported until a driver exists.

**Stream L — DevOps.** Owner: DevOps.

- Files: `.github/workflows/**` (new), `next.config.ts` (only this stream may edit it), `tsconfig.json`, `eslint.config.mjs`.
- Acceptance: a pull-request workflow runs lint, typecheck, and unit tests. Integration job uses a Mongo replica-set service container and `RUN_INTEGRATION=1`. `ignoreBuildErrors` is removed only after Stream E and Stream B leave `tsc` clean. Production env template lists required names and does not contain values.

**Stream M — Demo and QA.** Owner: QA. DevOps supplies the database. See the demo plan below.

- Files: new `scripts/seed-pro-max-demo.ts`, new `scripts/cleanup-pro-max-demo.ts`, new `fixtures/pro-max/**`, new `tests/e2e/**`. Do not edit `lib/demo/seed-demo-kitchen.ts` in this wave (it is the old demo and contains the committed password). Do not edit `lib/services/order.service.ts`.
- Acceptance: seed and cleanup refuse any URI that is not loopback. Cleanup deletes only documents whose ids start with the demo prefix. Playwright, when added, points at `localhost`.

**Stream N — UI shell.** Owner: UI/UX, implemented by Frontend.

- Files: `app/globals.css`, `components/shared/**`, `components/admin/AdminShell.tsx`, `components/admin/AdminSidebar.tsx`, `components/admin/AdminHeader.tsx`, `lib/admin-layout.ts`.
- Other streams do not add sidebar entries themselves. They name the route in the PR; Stream N adds the link in a follow-up commit on these files only.
- Acceptance: POS and kitchen stay full-width (`isImmersiveOpsPath`). Mobile nav still closes. No feature logic moves into the shell.

CTO acceptance for the whole wave: Streams A and B are merged before a production deploy. A deploy without them leaves loyalty, printing, and cancel math wrong. Streams C through N can land in any order relative to each other.

### TRONX PRO MAX DEMO RESTAURANT

The current seed is not this demo. `lib/demo/seed-demo-kitchen.ts` upserts one restaurant, 8 tables, and dishes from `fixtures/tronx-demo-kitchen-menu.xlsx`. That workbook has 80 menu rows, 12 categories, and 16 items with Half or Full. It does not create captains, ingredients, recipes, suppliers, purchase orders, coupons, or shifts. It also embeds an admin password in source. Do not point it at a shared database.

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

**Concurrency and load.** Re-enable `tests/integration/*.test.ts` on a replica set (coupon limit, loyalty overdraw, stock, print lease). Add a load script that starts 100 synthetic users against localhost: a mix of QR creates with distinct idempotency keys, captain polls, and kitchen polls. Payment calls use a mock adapter that records tenders in memory and never contacts a bank. Pass condition to write down when it is actually run: zero duplicate orders for one idempotency key, zero negative stock, zero coupon redemptions above `maxRedemptions`, and p95 of the poll endpoints recorded from that run. Do not invent those latencies now.

**Security.** CI runs `npm audit` and a secret scan that fails on `mongodb+srv://` with credentials and on private-key blocks. Authz matrix test from Stream A. IDOR fixtures: restaurant A cookie requesting restaurant B's order, dish, and customer. Connector secret required on `/api/connector/*` with no staff cookie. Rate limit on public order create and on Wi-Fi reveal, tested with a loop that expects 429. Login limiter must fail closed when its store is down, or the test documents the product decision if fail-open stays.

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
| `/api/connector/*` | Pair, heartbeat, poll, and ack for the Windows connector. Handler expects connector headers. Proxy currently requires a staff cookie. |
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
| `/api/public/loyalty/*` | Customer register, login, logout, me, forgot and reset. Handlers exist. Proxy class is `staff`. |
| `/api/public/orders` | Guest QR order. |
| `/api/public/reservations` | Guest availability and create. |
| `/api/public/restaurants/[slug]/translations` | Public translated strings. |
| `/api/public/restaurants/[slug]/wifi` | Public SSID and decrypted password when the feature is on. |
| `/api/reports/*` | Dashboard sales and table analytics. |
| `/api/reservations` | Staff list and status updates. |
| `/api/restaurants` | List and create for admins. `GET /[id]?fullMenu=true` is the public catalog. |
| `/api/super-admin/*` | Admin account migrate, verify, password, and org access assignment. |
| `/api/tables` | Create, update, and delete outlet tables. |
