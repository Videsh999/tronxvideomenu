# TRONX PRO MAX findings

Audit date: 2026-11-07. Evidence is from source at `main` `fcc89586190e2dd40673c7cb04f6baa358dd7969` and from commands run in this audit environment. No application code was changed. No production database was contacted.

Severity: **S1** breaks money, tenant safety, or a production request path. **S2** wrong behavior or a security weakness that needs a privileged or local condition. **S3** integrity, operability, or test gap. **S4** copy, typing, or polish.

## Top 10

| ID | Sev | Title |
| --- | --- | --- |
| F-01 | S1 | Edge proxy rejects customer loyalty and the device connector before their own auth runs |
| F-02 | S1 | Line cancel recomputes tax with a second formula and leaves GST split, packaging, and service charge stale |
| F-03 | S2 | POS and captain screens show a different bill than the server stores |
| F-04 | S2 | QR ordering cannot select variants and always prices the dish base price |
| F-05 | S2 | Production builds skip TypeScript; `tsc` currently fails |
| F-06 | S2 | Recoverable staff passwords are stored reversibly, and a demo admin password is committed |
| F-07 | S2 | Unauthenticated demo seed is reachable whenever `NODE_ENV` is not `production` and no seed token is set |
| F-08 | S2 | Menu import parses untrusted workbooks with `xlsx@0.18.5`, which `npm audit` rates high |
| F-09 | S3 | One restaurant admin account per outlet; no cashier or kitchen login |
| F-10 | S3 | No CI, and the Mongo concurrency suite was not executed |

## F-01 — Edge proxy mis-classifies loyalty and connector routes

**Severity:** S1

**Where:** `lib/api-authz.ts:14-64`, `proxy.ts:87-98`. Confirmed active by the production build line `ƒ Proxy (Middleware)`.

**What happens:** `classifyApiRequest` marks a route public only for a short allow-list. Anything else that is not under `/api/captain/`, `/api/super-admin/`, `/api/admin/`, or the three floor POS paths becomes `staff`, which `proxy.ts` rejects unless a restaurant-admin or super-admin cookie is present.

Customer loyalty calls are not on that allow-list:

- `POST /api/public/loyalty/login`
- `POST /api/public/loyalty/register`
- `POST /api/public/loyalty/forgot-password`
- `POST /api/public/loyalty/reset-password`
- `POST /api/public/loyalty/logout`
- `GET /api/public/loyalty/me`

The UI calls them with no staff cookie (`components/customer/CustomerLoyaltyPanel.tsx:32`, `:70`, `:91`, `:114`, `:133` and `app/menu/[slug]/loyalty/reset/page.tsx:34`). The handlers themselves implement customer sessions (`app/api/public/loyalty/login/route.ts:22`). The proxy returns 401 before those handlers run.

The Windows connector authenticates with `x-connector-id` and `x-connector-secret` (`device-connector/src/cloud/client.ts:22-27`) against:

- `POST /api/connector/pair`
- `POST /api/connector/heartbeat`
- `GET /api/connector/jobs`
- `POST /api/connector/jobs/[jobId]/ack`

Those paths are also classified `staff`. `requireConnectorAuth` in `app/api/connector/heartbeat/route.ts:26` never runs for a connector that has no admin cookie. Heartbeats, pairing, and print-job polling fail closed.

`GET /api/kitchen/orders` is the same class. The handler allows a captain (`app/api/kitchen/orders/route.ts:16-18`), but a captain cookie alone is rejected by the proxy. The captain UI uses `/api/captain/kitchen` instead, so the captain branch of the admin kitchen route is dead.

**Why it matters:** Loyalty self-service and cloud printing are implemented and then blocked by the only request gate Next.js 16 installs. This is not an auth bypass. It is an authorization matrix that does not match the handlers.

## F-02 — Two bill formulas, and cancel does not refresh GST components

**Severity:** S1

**Where:**

- Authoritative calculator: `lib/billing/calculate-bill.ts:93-181` (CGST/SGST or IGST, packaging, service charge, inclusive vs exclusive).
- Legacy calculator: `lib/order-pricing.ts:41-56` (one exclusive percentage, no packaging, no service charge, no split).
- Create paths call `calculateRestaurantBill`: `lib/services/order.service.ts:241`, `:466`, `:751`.
- Line cancel calls `computeBillTotals`: `lib/services/order.service.ts:1530-1534`.
- `replaceItemsAndTotals` writes CGST/SGST/IGST/packaging/service/bill snapshot only when the caller passes them: `lib/repositories/order.repository.ts:388-394`. The cancel caller does not pass them (`lib/services/order.service.ts:1543-1550`).

**Why it matters:** After a partial cancel, `total` and `taxAmount` can move under the legacy formula while `cgstAmount`, `sgstAmount`, `igstAmount`, `packagingCharge`, `serviceCharge`, and `billSnapshot` stay at the pre-cancel values. A printed bill, a report, and the order total can disagree. Unit tests cover each function separately (`tests/billing-calculator.test.ts`, `tests/order-pricing.test.ts`). They do not assert that cancel uses the restaurant calculator.

## F-03 — Staff screens preview the legacy bill

**Severity:** S2

**Where:** `components/admin/PosTerminal.tsx:13`, `:128-132`, `:820` and `components/captain/CaptainOrderPad.tsx:7`, `:135-140`, `:681`. Both import `computeBillTotals` and a single `taxRatePercent`. The server ignores that preview and runs `calculateRestaurantBill` inside `createPosOrder` (`lib/services/order.service.ts:466-486`).

**Why it matters:** Packaging, service charge, tax-inclusive prices, mixed dish rates, and IGST do not appear in the amount the cashier or captain sees before submit. The stored total can differ from the screen.

## F-04 — QR orders ignore variants

**Severity:** S2

**Where:** `lib/validations/index.ts:298-327` (`placeOrderSchema` has no `variantId`). `lib/services/order.service.ts:219-227` sets `unitPriceSnapshot` to `dish.price` only. `components/customer/` has no variant UI (search for `variants` under `components/customer` returned no matches). POS and captain do require a variant when the dish has one (`lib/services/order.service.ts:355-365` and `:678-688`).

**Why it matters:** The demo workbook seed writes Half/Full variants and sets the dish base price to the Full price (`lib/demo/seed-demo-kitchen.ts:103-131`). A QR guest cannot choose Half and is charged the base price. The same dish on POS requires a variant.

## F-05 — Typecheck is not a deploy gate

**Severity:** S2

**Where:** `next.config.ts:6-11` sets `typescript.ignoreBuildErrors: true`. The comment says a hanging Next TypeScript plugin was blocking Vercel, so the check was turned off.

**Evidence from this run:** `npm run typecheck` exited 2:

```
components/admin/TablesManager.tsx(22,7): error TS2739: Type '{ OPEN: string; OCCUPIED: string; CLOSED: string; }' is missing ... BILL_REQUESTED, PAYMENT_PENDING, CLEANING
components/admin/TablesManager.tsx(23,7): error TS2739: ... same missing keys on statusStyle
```

`npm run build` exited 0 and printed `Skipping validation of types`.

**Why it matters:** Table statuses `BILL_REQUESTED`, `PAYMENT_PENDING`, and `CLEANING` exist on the model (`lib/db/models.ts:285-289`) but the admin table UI has no label or style for them (`components/admin/TablesManager.tsx:22-27`). At runtime those statuses render as missing strings. The build will still ship.

## F-06 — Reversible passwords and a committed demo password

**Severity:** S2

**Where:**

- Captain and restaurant-admin documents store `passwordCiphertext`, `passwordIv`, and `passwordAuthTag` beside the hash (`lib/db/models.ts:559-562` and `:611-614`). Decrypt is an admin feature (`lib/services/captain.service.ts` uses `decryptCredentialPassword`). A restaurant-admin session can recover the captain's current password.
- `lib/demo/seed-demo-kitchen.ts:8-13` exports `DEMO_KITCHEN.adminPassword` as a string literal. `scripts/verify-demo-reupload-import.mjs:50` repeats a password literal for the same demo login. Values are intentionally omitted from this report.
- `.env` files are gitignored. `git ls-files` shows `.env.example` only. No cloud API key or Mongo URI value was found in tracked source. Test files use obvious fixture strings.

**Why it matters:** Recoverable passwords mean a stolen `CREDENTIALS_ENCRYPTION_KEY` plus a database dump yields live staff passwords, not just hashes. The committed demo password becomes a real credential on any database where that seed has been run, including a shared staging cluster.

## F-07 — Demo seed route is public to the proxy

**Severity:** S2

**Where:** `lib/api-authz.ts:25-27` classifies `POST /api/dev/seed-demo-kitchen` as `public`. `app/api/dev/seed-demo-kitchen/route.ts:12-23` blocks `NODE_ENV === "production"` unless `ALLOW_PRODUCTION_SEED=true`. If `DEMO_SEED_TOKEN` is unset, no header is required. `lib/demo/seed-demo-kitchen.ts:35-37` has the same production check, then writes the demo restaurant into whatever `MONGODB_URI` the process uses.

**Why it matters:** A preview, a mis-set `NODE_ENV`, or `ALLOW_PRODUCTION_SEED=true` without a token lets an anonymous caller upsert the demo restaurant into that environment's database. This audit did not call the route.

## F-08 — `xlsx` advisories on the import path

**Severity:** S2

**Where:** `package.json` dependency `xlsx` resolved to `0.18.5`. Menu import reads uploaded workbooks in `lib/menu-import/`. `npm audit --json` on 2026-11-07 reported `high :: xlsx :: Prototype Pollution in sheetJS` and `SheetJS Regular Expression Denial of Service (ReDoS)`.

**Why it matters:** An authenticated restaurant admin can upload a workbook. The parser runs on the server. This is not an anonymous RCE finding; it is a known-bad parser on an authenticated upload. The same audit reported 12 advisories total (critical 1, high 3, moderate 8, low 0, info 0). The critical item is `next` and describes `use cache` / Draft Mode / SSG cache poisoning. This repo has no `use cache` and no `draftMode(` usage, and `app/page.tsx:21` is `force-dynamic`. Do not treat that critical text as a confirmed leak here. The installed Next version is still the one the advisory names (`16.3.6`). `zod@4.6.5` is flagged high for memory use on oversized collections; many schemas set `.max()`, which was not re-checked schema by schema.

## F-09 — Role model cannot represent the requested floor team

**Severity:** S3

**Where:** Session roles are only `SUPER_ADMIN`, `RESTAURANT_ADMIN`, and `CAPTAIN` (`lib/auth-core.ts:4`). `restaurantAdminAccountSchema` has a unique index on `restaurantId` (`lib/db/models.ts:627`). Org roles exist (`ORG_OWNER`, `ORG_ADMIN`, `OUTLET_MANAGER`, `OUTLET_STAFF` at `lib/db/models.ts:617-620`) but they hang off that single admin account. There is no cashier role and no kitchen-staff login. Kitchen is a page under admin and captain. Cash close is an admin POS shift (`lib/services/pos-shift.service.ts:13-36`, `components/admin/PosTerminal.tsx` calls `/api/pos/shifts`). `/api/pos/shifts` is proxy class `staff`, so a captain cookie cannot open or close it. The captain "shift" page is a read-only sales summary (`app/captain/[slug]/shift/page.tsx:17-37`).

**Why it matters:** Two managers, two cashiers, and three kitchen logins on one outlet cannot be seeded until the account model changes. Captains can record payments when permissions allow (`app/api/orders/[orderId]/payment/route.ts:115-144`) but they are not a cash-office role.

## F-10 — No CI, and concurrency tests did not run

**Severity:** S3

**Where:** There is no `.github/` directory, no `vercel.json`, no Dockerfile, and no Render/Fly config. `gh pr list --state all --limit 50` returned no pull requests. `npm run test:integration` exited 0 with 8 skipped tests because `RUN_INTEGRATION` and `MONGODB_URI` were unset (`tests/integration/mongo-concurrency.test.ts:16-29`, `tests/integration/print-job-lease.test.ts:14-27`). This environment has no `mongod` and no Docker. A local replica set was not started. Nothing was pointed at a remote database.

**Why it matters:** Coupon oversell, loyalty overdraw, stock consume races, and print-job lease races are specified and unexecuted. `withOptionalTransaction` falls back to non-transactional work when the server is not a replica set (`lib/db/mongo-tx.ts:22-34`). A standalone MongoDB silently drops the transactional guarantee.

## Additional findings

### F-11 — Order numbers are allocated outside the insert

**Severity:** S3. `lib/repositories/order.repository.ts:12-30` increments `orderCounters` and then inserts the order. A failed insert burns a number (gap, not a duplicate, because `{ restaurantId, orderNumber }` is unique at `lib/db/models.ts:540`). If the counter update returns null, the code uses `1001`, which will collide with an existing number and fail the insert. The counter and the insert are not one transaction.

### F-12 — Public QR create is check-then-insert

**Severity:** S3. `lib/services/order.service.ts:149-151` checks `hasIdempotencyKey` and then inserts. The unique index `{ restaurantId, idempotencyKey }` (`lib/db/models.ts:541`) stops a double document. The public route maps duplicate key `11000` to 409 "already submitted" (`app/api/public/orders/route.ts:54-70`) and does not return the existing order. POS create returns the existing order (`lib/services/order.service.ts:317-321`). A double-tap on QR can look like a failure after the order exists. There is no rate limit on `POST /api/public/orders`.

### F-13 — Login limiter fails open and trusts the first forwarded IP

**Severity:** S3. `lib/security/login-rate-limiter.ts:40-44` returns `allowed: true` when Mongo throws. `app/api/auth/login/route.ts:34-39` uses the first `x-forwarded-for` hop as the client key. On a host that appends rather than overwrites that header, a caller can rotate the key. `matchesSecret` (`app/api/auth/login/route.ts:15-21`) returns before `timingSafeEqual` when lengths differ, so secret length leaks. Super-admin login compares environment strings directly (`app/api/auth/login/route.ts:67-72`).

### F-14 — Guest Wi-Fi password is returned to anyone who knows the slug

**Severity:** S3. `GET /api/public/restaurants/[slug]/wifi` is proxy-public (`lib/api-authz.ts:38-39`) and returns the decrypted password when the WIFI feature is on (`app/api/public/restaurants/[slug]/wifi/route.ts:18-26`, `lib/services/restaurant.service.ts:105-108`). That matches the product ("one-tap Wi-Fi"). There is no rate limit, so the slug is the only secret. `normalizeRestaurant` strips `wifi` ciphertext from other restaurant payloads (`lib/restaurant-normalize.ts:8`) but still returns billing settings, `organizationId`, subscription, and feature overrides on the public full menu (`app/api/restaurants/[restaurantId]/route.ts:25-33`).

### F-15 — KOT print failures are swallowed

**Severity:** S3. `lib/services/order.service.ts:1295-1325` catches device errors and returns a warning. `appendItemsToOrder` fires print with `void` (`:805`). An order can be accepted with no KOT and only a warning, or with an unhandled rejection if the dynamic import throws before the try in a caller that does not await. Physical USB printing reports itself unsupported (`device-connector/src/printers/usb-adapter.ts:43`, covered by the connector unit test that passed).

### F-16 — Stale captain credential test

**Severity:** S3. `npm test` failed one case: `tests/captain-credential-access.test.ts:36` throws `this.repository.touchLastActiveAt is not a function` from `lib/services/captain.service.ts:21`. The production repository implements `touchLastActiveAt` (`lib/repositories/captain.repository.ts:72`). The test double does not. The assertion that a reset password can log in is not actually reached. `void` does not catch a synchronous TypeError, so a missing method would also break login. On the real repository the method exists.

### F-17 — Table admin API cannot express floor statuses

**Severity:** S3. `createTableSchema` / `updateTableSchema` allow only `OPEN`, `OCCUPIED`, `CLOSED` (`lib/validations/index.ts:287-297`). The order flow uses a wider enum. Combined with F-05, the admin tables screen and its write API are behind the floor model.

### F-18 — Reservations are locked to one timezone

**Severity:** S4. `lib/db/models.ts:643` enums reservation `timezone` to `Asia/Kolkata` only.

### F-19 — Marketing copy overstates realtime

**Severity:** S4. `app/page.tsx:26` says orders flow to the kitchen instantly and guests watch every status update in real time. The implementation is HTTP polling (`components/customer/CustomerMenu.tsx` 8s, `components/kitchen/KitchenKanban.tsx` default 5s, `components/admin/OrdersManager.tsx` 10s). QR orders also wait for captain approval before the kitchen (`lib/order-authorization.ts:6-7` and `:34-38`). No WebSocket or SSE server was found.

### F-20 — Payments are recorded tenders, not a gateway

**Severity:** S3 as a product gap, not a stolen-card bug. Methods are `CASH`, `UPI`, `CARD` on the order document (`lib/db/models.ts:353-360`). No Razorpay, Stripe, Cashfree, or PhonePe client exists in the repo. The payment terminal simulator is documented not to settle a ledger (unit test name: "payment terminal never claims ledger settlement", which passed). Refunds exist as ledger entries (`app/api/pos/orders/[orderId]/refund/route.ts`) and are proxy class `staff`, so captains cannot call them.

### F-21 — Lint fails

**Severity:** S3. `npm run lint` exited 1 with 15 errors and 26 warnings. Errors are `react-hooks/purity`, `react-hooks/set-state-in-effect`, `react-hooks/refs`, and one `@next/next/no-html-link-for-pages` at `components/admin/MenuImportWizard.tsx:299`. They are React Compiler rules, not proven runtime crashes. `Date.now()` during render is in captain home, approvals, and the order pad (`app/captain/[slug]/page.tsx:50`, `components/captain/CaptainApprovals.tsx:151`, `components/captain/CaptainOrderPad.tsx:166`).

### F-22 — Dev-only LAN origin is hardcoded

**Severity:** S4. `next.config.ts:5` sets `allowedDevOrigins` to `192.168.46.190`. It does not affect production. It will not match another developer's LAN.

## What was looked for and not found

- No tracked `.env` with live secrets. `.env.example` has empty values.
- No `mongodb+srv://` connection string with credentials in application source. The strings in tests and `docs/MONGO_REPLICA_SET_TESTING.md` are localhost or obvious placeholders.
- Menu, dish, category, and media list routes compare `restaurantId` to the session restaurant (`app/api/dishes/route.ts:18`, `app/api/categories/route.ts:12`, `app/api/media/route.ts:33`). Those particular IDOR checks are present.
- Payment recording for captains checks method permission and table assignment (`app/api/orders/[orderId]/payment/route.ts:115-143`).
- Customer order status requires a bearer token (`app/api/orders/[orderId]/status/route.ts:7-11`), even though the proxy class is `public`.
