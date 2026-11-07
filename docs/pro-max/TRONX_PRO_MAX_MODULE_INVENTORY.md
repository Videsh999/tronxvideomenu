# TRONX PRO MAX module inventory

Audit date: 2026-11-07. Source of truth is the tree at `main` `fcc89586190e2dd40673c7cb04f6baa358dd7969`. Status is from reading code and from the commands in `TRONX_PRO_MAX_ARCHITECTURE.md`. Nothing was clicked in a browser. Nothing was executed against MongoDB.

Status words:

- **EXISTS-WORKING** — the path is implemented and a test that this audit actually ran passed for that behavior.
- **EXISTS-PARTIAL** — code and screens exist; a required slice is missing, divergent, or only proven without a database.
- **EXISTS-BROKEN** — the path is implemented and a defect in this tree stops it.
- **MISSING** — no implementation.
- **NOT VERIFIABLE** — needs a database, hardware, or a running browser session this audit did not have.

End-to-end restaurant flows are **NOT VERIFIABLE** as a whole. The statuses below are about the code that exists, not a live outlet.

## Summary

| Module | Status |
| --- | --- |
| Auth and access | EXISTS-PARTIAL |
| Restaurant onboarding | EXISTS-PARTIAL |
| Admin dashboard | EXISTS-PARTIAL |
| Menu management, including Excel | EXISTS-PARTIAL |
| QR ordering and captain approval | EXISTS-PARTIAL |
| Captain / waiter portal | EXISTS-PARTIAL |
| POS | EXISTS-PARTIAL |
| Kitchen / KDS / KOT | EXISTS-PARTIAL |
| Reservations and tables | EXISTS-PARTIAL |
| Billing, GST, coupons, refunds, cash close | EXISTS-PARTIAL |
| Inventory and procurement | EXISTS-PARTIAL |
| CRM | EXISTS-PARTIAL |
| Customer loyalty self-service | EXISTS-BROKEN |
| Multi-outlet | EXISTS-PARTIAL |
| AI intelligence | EXISTS-PARTIAL |
| Hardware and printers | EXISTS-PARTIAL |
| Cloud device connector | EXISTS-BROKEN |
| Reports | EXISTS-PARTIAL |
| Payment gateway | MISSING |
| Dedicated cashier and kitchen logins | MISSING |

## Auth and access

**Status:** EXISTS-PARTIAL

Signed httpOnly cookies for three roles (`lib/auth-core.ts:1-9`), 8-hour TTL (`lib/auth-core.ts:10`). Proxy protects `/admin`, `/super-admin`, `/captain`, and `/api` (`proxy.ts:103-105`). Handlers re-check the session (`lib/auth-server.ts:80-156`). Login rate limit exists and its pure cases passed (`tests/safeguards-and-rate-limiter.test.ts`). Credential encryption tests passed except the captain reset/login case, which throws because the fake repository has no `touchLastActiveAt` (finding F-16).

Org permissions are a matrix in `lib/org-rbac.ts` and `tests/org-rbac.test.ts` passed. Feature flags by plan are in `lib/features.ts`. STARTER, PRO, and ENTERPRISE differ. Default plan is PRO (`lib/features.ts:58`), which does not include procurement, multi-outlet, AI, or hardware.

**Not in this module:** a fourth staff role, SSO, or step-up auth for refunds.

## Restaurant onboarding

**Status:** EXISTS-PARTIAL

Super admin creates and edits restaurants (`app/super-admin/restaurants/new/page.tsx`, `app/super-admin/restaurants/[restaurantId]/edit/page.tsx`, `POST /api/restaurants`). Per-restaurant admin credentials can be migrated and verified (`app/api/super-admin/restaurant-admins/`). Legacy env logins remain for two slugs (`lib/legacy-restaurant-admin-config.ts`). Plans and feature overrides live on the restaurant document (`lib/db/models.ts:60-75`).

The admin account collection is unique per `restaurantId` (`lib/db/models.ts:627`). Onboarding cannot create two manager logins for one outlet. Not run against a database.

## Admin dashboard

**Status:** EXISTS-PARTIAL

Outlet home is `app/admin/[slug]/page.tsx` with sidebar groups for menu, operations, back office, and restaurant (`components/admin/AdminSidebar.tsx:78-137`). The shell hides links the plan does not include. Older unscoped pages still exist (`app/admin/menu/`, `app/admin/media/`, `app/admin/profile/`, `app/admin/availability/`). Layout forces the session slug (`app/admin/[slug]/layout.tsx:18-26`). Not opened in a browser.

## Menu management, including Excel

**Status:** EXISTS-PARTIAL

Categories, dishes, add-ons, variants, SKU, kitchen station, and per-dish tax are on the schemas (`lib/db/models.ts:140-251`). Admin screens: `app/admin/[slug]/menu/`, `dishes`, `categories`, `addons`, `import`. Export: `GET /api/admin/menu-export` and `lib/menu-export/build-workbook.ts`. Import is a job pipeline: upload, analyze, mapping, preview, commit, cancel (`app/api/admin/menu-import/`). `tests/menu-import.test.ts` and `tests/menu-export.test.ts` passed in `npm test`.

Media upload goes to Cloudinary (`lib/cloudinary.ts`, `app/api/media/upload/route.ts`) and was not exercised. Customer video playback uses `hls.js` (`components/customer/VideoPlayer.tsx`).

## QR ordering and captain approval

**Status:** EXISTS-PARTIAL

Public menu page: `app/menu/[slug]/page.tsx` loads `restaurantService.getFullMenu`. Guest cart posts `POST /api/public/orders`, which is proxy-public. `createPublic` reprices from the database, snapshots add-ons, and sets captain authorization to `PENDING_CAPTAIN_APPROVAL` (`lib/services/order.service.ts:139-304`, `lib/order-authorization.ts:6-7`). Kitchen eligibility requires approval (`lib/order-authorization.ts:34-38`). `tests/captain-authorization.test.ts` passed.

Variants are not on the QR schema or the customer components (finding F-04). Guest status polling uses a bearer token (`app/api/orders/[orderId]/status/route.ts`). Service requests (water, bill, assistance) exist (`lib/db/models.ts:746-778`, `app/api/captain/requests`). No rate limit on public order create (finding F-12).

## Captain / waiter portal

**Status:** EXISTS-PARTIAL

Login: `app/captain/login`, `POST /api/captain/login`. Floor: `app/captain/[slug]/` plus tables, `tables/[tableId]`, take-order, orders, approvals, kitchen, bills, requests, shift, pos. Proxy pins the captain to their slug (`proxy.ts:27-37`).

Walk-in without a phone is allowed by schema and covered by a passing test (`tests/captain-order-schema.test.ts`, case "captain order allows walk-in without phone"). `customerPhone` is optional (`lib/validations/index.ts:516`). Multiple assigned tables are an array (`lib/db/models.ts:565`) with an exclusive reassignment in `lib/services/captain.service.ts:77-79`. `tests/captain-assignment.test.ts` passed, including a large table-set case. Permissions cover view bill, payments by method, coupon, discount caps, and print (`lib/db/models.ts:566-577`). `tests/captain-permissions.test.ts` passed.

The order pad posts to `POST /api/captain/orders` (`components/captain/CaptainOrderPad.tsx:234`), which calls the same `createPosOrder` path. The bill preview on that screen uses the legacy calculator (finding F-03). Browser walk-through: NOT VERIFIABLE.

## POS

**Status:** EXISTS-PARTIAL

Screen: `app/admin/[slug]/pos/page.tsx` and `components/admin/PosTerminal.tsx` (976 lines). Channels `POS_DINE_IN`, `POS_TAKEAWAY`, `POS_DELIVERY` (`lib/db/models.ts:451-454`). Create: `POST /api/pos/orders` (proxy class `floor`, so a captain cookie is allowed). Server reprices variants and add-ons (`lib/services/order.service.ts:345-365`). Idempotency returns the existing POS order (`:317-321`). Shift open/close is on the admin terminal via `/api/pos/shifts`. `tests/pos-order-schema.test.ts` passed. Display totals disagree with the server (finding F-03). No card-network capture (finding F-20).

## Kitchen / KDS / KOT

**Status:** EXISTS-PARTIAL

Admin kitchen: `app/admin/[slug]/kitchen/page.tsx`, `components/admin/KitchenDisplay.tsx`, `components/kitchen/KitchenKanban.tsx` polling `GET /api/kitchen/orders` every 5 seconds. Item prep: `PATCH /api/kitchen/orders/[orderId]/items`. Captain kitchen polls `/api/captain/kitchen`. Orders reach the kitchen only after captain approval or when authorization is `NOT_REQUIRED` (POS). KOT enqueue is best-effort (`lib/services/order.service.ts:1312-1325`). Print dedupe keys are tested (`tests/device-fleet.test.ts` cases that passed). There is no separate kitchen login (finding F-09). The admin kitchen route's captain branch is unreachable through the proxy (finding F-01).

## Reservations and tables

**Status:** EXISTS-PARTIAL

Tables: `app/admin/[slug]/tables/page.tsx`, `components/admin/TablesManager.tsx`, `app/api/tables`. QR generation is local (`tests/local-qr-generation.test.ts` passed). Status labels are incomplete and fail `tsc` (finding F-05). Reservations: `app/admin/[slug]/reservations/page.tsx`, `components/customer/ReservationPanel.tsx`, public availability and create under `/api/public/reservations`. Timezone is only `Asia/Kolkata` (`lib/db/models.ts:643`). Overlap logic was not executed against a database.

## Billing, GST, coupons, refunds, cash close

**Status:** EXISTS-PARTIAL

Settings UI: `app/admin/[slug]/settings/billing/page.tsx`, `components/admin/BillingSettingsForm.tsx`. Persistence and preview: `app/api/admin/billing`, `preview`, `bulk-tax`. Audit rows: `billingAudits` (`lib/db/models.ts:786-806`). `calculateRestaurantBill` tests passed for intra-state CGST+SGST, inter-state IGST, inclusive prices, packaging modes, disabled GST, and mixed rates (`tests/billing-calculator.test.ts`). `resolveLineTaxRate` priority is dish, then category, then outlet (`lib/billing/resolve-tax-rate.ts:7-24`) and that test passed.

Coupons and loyalty points are applied inside `createPosOrder` (`lib/services/order.service.ts:435-463`) when the CRM feature is on. Coupon idempotency keys are stable (`tests/coupon-redeem-key.test.ts` passed). Refunds: `POST /api/pos/orders/[orderId]/refund` (staff only). Payment recording and ledger: `lib/services/order.service.ts` `recordPayment` / `refundPayment`, `tests/order-payment-recording.test.ts` passed. Cash close: one open shift per restaurant, expected cash from that shift's cash ledger (`lib/services/pos-shift.service.ts`). Captains cannot call the shift API (finding F-09).

The cancel path does not use this calculator (finding F-02). There is no e-invoice, no HSN column required on every line, and no payment gateway.

## Inventory and procurement

**Status:** EXISTS-PARTIAL

Ingredients, recipes, movements, consumptions (`lib/db/models.ts:822-938`). Screens: `app/admin/[slug]/inventory/page.tsx`, `inventory/recipes/page.tsx`. APIs under `app/api/inventory/`. Consumption point is configurable (`lib/db/models.ts:119-124`). Unit conversion, recipe cost, consumption idempotency, and restore rules passed (`tests/inventory-units.test.ts`, `tests/recipe-cost.test.ts`, `tests/inventory-consumption.test.ts`, `tests/inventory-line-restore.test.ts`). The concurrent "last unit wins once" test was skipped.

Suppliers, purchase orders, goods receipts (`lib/db/models.ts:941-1023`). Screen: `app/admin/[slug]/procurement/page.tsx`. APIs: `app/api/procurement/`. Feature `PROCUREMENT` is ENTERPRISE-only (`lib/features.ts:40`). Stock transfers between outlets are on the organization API, not a separate screen. Receipt idempotency under concurrency was not run.

## CRM

**Status:** EXISTS-PARTIAL

Admin CRM: `app/admin/[slug]/crm/page.tsx`, `components/admin/CrmManager.tsx`. Customers, coupons, feedback (`app/api/crm/`). Profiles are unique per restaurant phone (`lib/db/models.ts:1050`). Segments, points, and opt-in flags are on the schema. `tests/loyalty-coupons.test.ts` passed. Linking a QR order to a loyalty customer is optional and feature-gated (`lib/services/order.service.ts:153-162`).

## Customer loyalty self-service

**Status:** EXISTS-BROKEN

Handlers and UI exist (`app/api/public/loyalty/`, `components/customer/CustomerLoyaltyPanel.tsx`, `app/menu/[slug]/loyalty/reset/page.tsx`, `lib/customer-auth.ts`). The proxy classifies every one of those routes as `staff` (finding F-01), so a guest cannot register, log in, or reset a password. The repair is an allow-list per handler. Login, register, forgot-password, and reset-password stay reachable with no customer session. A proxy class that requires a customer cookie on the whole prefix would keep this path broken.

## Multi-outlet

**Status:** EXISTS-PARTIAL

`organizations` collection (`lib/db/models.ts:810-820`). Outlet link is `restaurant.organizationId`. Screen: `app/admin/[slug]/organization/page.tsx`. API creates an organization, attaches an outlet, lists transfers, and compares outlets (`app/api/organization/route.ts`). Menu sync jobs: `app/api/organization/menu-sync/route.ts`, schema `lib/db/models.ts:1245-1277`. RBAC tests passed (`tests/org-rbac.test.ts`, `tests/multi-outlet-boundaries.test.ts`, `tests/access-assignment.test.ts`). Feature `MULTI_OUTLET` is ENTERPRISE-only. Not verified with two real databases or two sessions.

## AI intelligence

**Status:** EXISTS-PARTIAL

Screens under `app/admin/[slug]/ai/`: overview, assistant, forecast, inventory, menu, alerts, evaluation. APIs under `app/api/ai/`. Without `AI_API_KEY`, `createAiProvider` returns `HeuristicAiProvider` (`lib/ai/provider.ts:149-151`). With a key it calls an OpenAI-compatible chat endpoint. Tool names are allow-listed. `tests/ai-evaluation.test.ts` and `tests/ai-security.test.ts` passed (injection detection, redaction, no invented tools). No live model was called. Forecast is a weekday moving average over stored orders, not a trained model (`lib/analytics/forecast.ts`, tests passed). Flags are ENTERPRISE-only.

## Hardware and printers

**Status:** EXISTS-PARTIAL

Device registry, simulator adapters for receipt, kitchen, cash drawer, barcode, customer display, and payment terminal (`lib/devices/adapters/simulator/`). Admin screen: `app/admin/[slug]/devices/page.tsx`. APIs under `app/api/devices/`. ESC/POS layout tests passed in the app suite and again in `device-connector` (8 passed). Compatibility labels do not claim physical verification (passing test). Barcode wedge does not change stock (passing test). USB adapter tells the truth that it is unsupported (passing connector test).

Physical printers, drawers, and terminals: **NOT VERIFIABLE**. No device was attached.

## Cloud device connector

**Status:** EXISTS-BROKEN

`device-connector/` is a separate Node program that pairs, heartbeats, polls jobs, and acks with connector headers. Those four routes are proxy class `staff` (finding F-01), so the connector cannot authenticate as itself. Simulator printing inside the Next process does not need this channel. Cloud-to-Windows printing does.

## Reports

**Status:** EXISTS-PARTIAL

`app/admin/[slug]/reports/page.tsx`, `components/admin/ReportsDashboard.tsx`, `GET /api/reports/dashboard`, `GET /api/reports/tables`. Sales math that excludes cancelled orders and reconciles the ledger passed (`tests/analytics-sales.test.ts`, `tests/financial-reconciliation.test.ts`). Table analytics doc: `docs/LOYALTY_AND_TABLE_ANALYTICS.md`. Figures against a live ledger: NOT VERIFIABLE.

## Modules found beyond the requested list

| Area | Status | Where |
| --- | --- | --- |
| Video menu and Cloudinary media | EXISTS-PARTIAL | `components/customer/VideoPlayer.tsx`, `app/api/media/` |
| Guest Wi-Fi reveal | EXISTS-PARTIAL | `app/api/public/restaurants/[slug]/wifi/route.ts`. Works as designed and is unauthenticated once the slug is known (finding F-14). |
| Menu translations | EXISTS-PARTIAL | `lib/services/translation.service.ts`, `app/api/public/restaurants/[slug]/translations/route.ts`. Google key optional; MyMemory is the fallback. Not called in this audit. |
| Service requests | EXISTS-PARTIAL | `app/api/captain/requests`, captain requests page |
| Subscription feature gates | EXISTS-WORKING as a pure function | `lib/features.ts`, asserted by AI and hardware tests |
| Theme protection | EXISTS-WORKING as a schema rule | `tests/restaurant-theme-protection.test.ts` passed. Restaurant admins cannot change theme. |
| Print job lease | EXISTS-PARTIAL | Pure claim tests passed. Mongo lease tests skipped. |
| Demo kitchen seed | EXISTS-PARTIAL | `lib/demo/seed-demo-kitchen.ts` writes 8 tables and the 80-row fixture menu. It does not create captains, recipes, suppliers, or shifts. Seed was not executed. |
| Windows connector installer notes | NOT VERIFIABLE | `WINDOWS_CONNECTOR_INSTALLATION.md`, `device-connector/src/installer/` |

## Screens

Customer: `/`, `/menu/[slug]`, `/menu/[slug]/loyalty/reset`, `/menu/[slug]/admin`, `/menu/[slug]/captain`.

Captain: `/captain/login`, `/captain/[slug]`, `tables`, `tables/[tableId]`, `take-order`, `orders`, `approvals`, `kitchen`, `bills`, `requests`, `shift`, `pos`.

Admin outlet: `/admin/[slug]` and `menu`, `menu/categories`, `menu/dishes`, `menu/addons`, `menu/import`, `orders`, `pos`, `kitchen`, `devices`, `tables`, `reservations`, `captains`, `inventory`, `inventory/recipes`, `procurement`, `crm`, `organization`, `reports`, `ai` plus `ai/assistant`, `ai/forecast`, `ai/inventory`, `ai/menu`, `ai/alerts`, `ai/evaluation`, `profile`, `settings/billing`, `availability`, `media`.

Super admin: `/super-admin/login`, `/super-admin`, `/super-admin/restaurants`, `restaurants/new`, `restaurants/[restaurantId]/edit`.

Legacy admin paths without a slug remain: `/admin/menu`, `/admin/menu/categories`, `/admin/menu/dishes`, `/admin/menu/addons`, `/admin/media`, `/admin/profile`, `/admin/availability`.

## Data collections

Defined in `lib/db/models.ts`. There is no Prisma schema and no migration folder. Mongoose `strict: true` schemas are the schema.

`restaurants`, `categories`, `dishes`, `addonGroups`, `addons`, `media`, `tables`, `orders`, `orderCounters`, `captains`, `captainTableAssignmentEvents`, `restaurantAdminAccounts`, `reservations`, `posShifts`, `receiptReprintLogs`, `serviceRequests`, `billingAudits`, `organizations`, `ingredients`, `recipes`, `inventoryMovements`, `inventoryConsumptions`, `suppliers`, `purchaseOrders`, `goodsReceipts`, `customerProfiles`, `loyaltyTransactions`, `coupons`, `couponRedemptions`, `accessAssignmentAudits`, `orderLineCancellations`, `customerFeedback`, `stockTransfers`, `menuSyncJobs`, `aiForecastRuns`, `aiAlerts`, `aiUsageEvents`, `aiAssistantThreads`, `hardwareDevices`, `printJobs`, `deviceEvents`, `deviceConnectors`, `connectorPairingCodes`, `hardwarePilotRuns`.

Login attempts use `lib/db/rate-limit-model.ts`. Import jobs use `lib/db/import-job-model.ts`. Translations use `lib/db/translation-model.ts`.
