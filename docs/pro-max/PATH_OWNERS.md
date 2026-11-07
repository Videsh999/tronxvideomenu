# Path owners

This manifest is the file-ownership list for the Pro Max workstreams. The narrative and the merge order are in `TRONX_PRO_MAX_ARCHITECTURE.md`. If a path appears in two streams below, that is a mistake: do not start the work until the duplicate is removed.

## Rules

- A stream edits only the paths in its section.
- A needed change outside those paths is a queued patch. The path owner reviews it and integrates it alone. One shared file, one patch, one integration. Do not land two owners' edits to the same file in one commit.
- Wave 0 (validation contracts) merges before every stream that adds a schema.
- H's compatible schema and index change merges before D's code that reads the new membership shape.
- B's billing contract merges before C, and before C integrates E's captain billing handoff.
- A merges before K's connector acceptance and before G's loyalty acceptance.
- D and H both merge before M's full-role demo QA.
- L merges the required CI gates and the root lockfile last.
- F and M do not edit the root `package.json` or `package-lock.json`. They file a dependency request to L.
- K owns the connector package manifests and does not edit the root manifests.
- A and L do not edit another stream's files to carry out a security or CI duty. They queue a patch. The path owner lands it alone. The duties and the owners are listed under "Queued security and CI patches".

## Wave 0 — validation contracts

Role: Backend. Reviewer: CTO.

- Wave 0 creates the domain modules listed under "Validation modules after Wave 0" and leaves `lib/validations/index.ts` as a re-export barrel.
- After Wave 0 merges, each domain module belongs to the stream named there. H keeps only the barrel. Wave 0 does not keep those modules.

## A — Authz matrix

Role: Backend. Reviewer: CTO.

- `proxy.ts`
- `lib/api-authz.ts`
- `tests/api-proxy-authz.test.ts`

No loyalty route file. No connector route file. The edge allow-list is the only change, and it follows the per-handler contracts in the architecture doc. There is no customer-session class covering `/api/public/loyalty/*`.

## B — Order aggregate and billing contract

Role: Backend. Sole owner of the billing modules.

- `lib/billing/**`
- `lib/order-pricing.ts`
- `lib/services/order.service.ts`
- `lib/repositories/order.repository.ts`
- `lib/order-authorization.ts`
- `lib/order-transitions.ts`
- `lib/order-board.ts`
- `lib/kot-print.ts`
- `app/api/orders/**`
- `app/api/public/orders/**`
- `app/api/pos/orders/**`
- `app/api/captain/orders/**`
- `tests/order-*.ts`
- `tests/order-pricing.test.ts`
- `tests/billing-calculator.test.ts`
- `tests/captain-authorization.test.ts`
- `tests/pos-order-schema.test.ts`
- `tests/captain-order-schema.test.ts`
- `tests/captain-pos-order-schema.test.ts`

C, E, and everyone else consume these modules. They do not edit them.

## C — Bill UI

Role: Frontend. Starts after B's contract is merged.

- `components/admin/PosTerminal.tsx`
- `app/admin/[slug]/pos/page.tsx`
- `components/captain/CaptainOrderPad.tsx`
- `components/admin/BillingSettingsForm.tsx`
- `app/admin/[slug]/settings/billing/**`
- `app/api/admin/billing/**`
- `lib/repositories/billing-audit.repository.ts`
- `app/api/pos/shifts/**`
- `lib/services/pos-shift.service.ts`
- `lib/repositories/pos-shift.repository.ts`

Handoff from E, integrated by C after B, one file at a time:

- `app/captain/[slug]/take-order/page.tsx`
- `app/captain/[slug]/bills/page.tsx`

`app/api/pos/shifts/**` stays with the POS shift behavior. C owns it because the admin POS page is the only caller. E does not edit it.

## D — Identities and legacy seed

Role: Backend.

- `lib/auth-core.ts`
- `lib/auth-server.ts`
- `lib/security/**`
- `lib/customer-auth.ts` is G's. D does not take it.
- `lib/services/captain.service.ts`
- `lib/services/restaurant-admin.service.ts`
- `lib/repositories/captain.repository.ts`
- `lib/repositories/captain-assignment.repository.ts`
- `lib/repositories/restaurant-admin.repository.ts`
- `lib/repositories/restaurant.repository.ts`
- `lib/services/restaurant.service.ts`
- `lib/restaurant-normalize.ts`
- `app/api/restaurants/**`
- `app/api/auth/**`
- `app/api/captain/login/**`
- `app/api/captain/logout/**`
- `app/api/admin/captains/**`
- `app/api/super-admin/**`
- `components/super-admin/**`
- `components/auth/**`
- `components/admin/CaptainManagement.tsx`
- `app/api/dev/seed-demo-kitchen/**`
- `lib/demo/**`
- `scripts/seed-tronx-demo-kitchen.ts`
- `scripts/verify-demo-reupload-import.mjs`
- `tests/credential-crypto.test.ts`
- `tests/captain-credential-access.test.ts`
- `tests/restaurant-admin-auth.test.ts`
- `tests/safeguards-and-rate-limiter.test.ts` for the seed guard only; coordinate with A if the rate-limiter assertion changes

Membership fields in `lib/db/models.ts` and `types/**` are queued to H.

## E — Floor UI

Role: Frontend.

- `components/customer/ReservationPanel.tsx` only, inside `components/customer/`
- `app/captain/**` except the two billing callers handed to C
- `components/captain/**` except `components/captain/CaptainOrderPad.tsx` (C)
- `components/kitchen/**`
- `components/admin/KitchenDisplay.tsx`
- `components/admin/TablesManager.tsx`
- `components/admin/ReservationsManager.tsx`
- `app/admin/[slug]/kitchen/**`
- `app/admin/[slug]/tables/**`
- `app/admin/[slug]/reservations/**`
- `app/api/kitchen/**`
- `app/api/captain/kitchen/**`
- `app/api/captain/tables/**`
- `app/api/captain/approvals/**`
- `app/api/captain/requests/**`
- `app/api/captain/table-stats/**`
- `app/api/tables/**`
- `app/api/reservations/**`
- `app/api/public/reservations/**`
- `lib/services/table.service.ts`
- `lib/repositories/table.repository.ts`
- `lib/services/reservation.service.ts`
- `lib/repositories/reservation.repository.ts`
- `lib/services/service-request.service.ts`
- `lib/repositories/service-request.repository.ts`
- `lib/validations/captain-authorize.ts`
- `lib/captain-floor.ts`
- `lib/captain-permissions.ts`
- `lib/kitchen-board.ts`
- `lib/kot-print.ts` is read by B's order service. E queues print-layout patches to B. E does not edit `lib/services/order.service.ts`.

`app/captain/[slug]/pos/page.tsx` stays with E. It only redirects.

## F — Menu and catalog

Role: Frontend, with Backend on the import engine.

- `components/admin/DishesManager.tsx`
- `components/admin/CategoriesManager.tsx`
- `components/admin/AddonsManager.tsx`
- `components/admin/MenuImportWizard.tsx`
- `components/admin/MediaManager.tsx`
- `components/admin/MediaPicker.tsx`
- `components/admin/AvailabilityManager.tsx`
- `app/admin/[slug]/menu/**`
- `app/admin/menu/**`
- `app/admin/[slug]/media/**`
- `app/admin/media/**`
- `app/admin/[slug]/availability/**`
- `app/admin/availability/**`
- `app/api/dishes/**`
- `app/api/categories/**`
- `app/api/addons/**`
- `app/api/addon-groups/**`
- `app/api/media/**`
- `app/api/admin/menu-import/**`
- `app/api/admin/menu-export/**`
- `lib/menu-import/**`
- `lib/menu-export/**`
- `lib/services/dish.service.ts`
- `lib/repositories/dish.repository.ts`
- `lib/services/category.service.ts`
- `lib/repositories/category.repository.ts`
- `lib/services/addon.service.ts`
- `lib/repositories/addon.repository.ts`
- `lib/repositories/import-job.repository.ts`
- `lib/services/menu-import.service.ts`
- `lib/services/media.service.ts`
- `lib/repositories/media.repository.ts`
- `lib/dish-addons.ts`
- `lib/dish-media.ts`
- `tests/menu-import.test.ts`
- `tests/menu-export.test.ts`
- `tests/dish-media.test.ts`
- `tests/customer-dish-data.test.ts`

Dependency requests, including replacing `xlsx`, go to L.

The unscoped `app/admin/menu/**`, `app/admin/media/**`, and `app/admin/availability/**` pages are the same admin UI as the slug routes (today they only redirect to `/admin`). F owns those pages. Dish, category, add-on, and media APIs stay on the paths already listed here. They do not move.

## FROZEN — no owner yet

No architecture stream owns the restaurant profile screen. Do not edit these paths until an owner is assigned.

- `app/admin/profile/**`
- `app/admin/[slug]/profile/**`
- `components/admin/RestaurantProfileForm.tsx`

`app/api/restaurants/**`, `lib/services/restaurant.service.ts`, and `lib/restaurant-normalize.ts` stay with D. A profile change that needs those files is a queued patch to D, and it still waits until the profile pages have an owner.

## G — Customer menu and loyalty UX

Role: Frontend.

- `app/page.tsx`
- `app/menu/**`
- `components/customer/**` except `components/customer/ReservationPanel.tsx`
- `app/api/public/loyalty/**`
- `app/api/public/restaurants/**`
- `lib/customer-auth.ts`
- `lib/services/customer-loyalty.service.ts`
- `lib/services/translation.service.ts`
- `lib/i18n/**`
- `lib/customer-dish-data.ts`

Loyalty acceptance waits for A. G does not edit `proxy.ts`.

## H — Schema steward

Role: Backend. Reviewer: CTO.

- `lib/db/models.ts`
- `lib/db/mongo-mappers.ts`
- `lib/db/import-job-model.ts`
- `lib/db/rate-limit-model.ts`
- `lib/db/translation-model.ts`
- `lib/db/mongodb.ts`
- `lib/db/mongo-tx.ts`
- `lib/repositories/types.ts`
- `types/**`
- `lib/repositories/index.ts`
- `lib/services/index.ts`
- `lib/validations/index.ts`

Patches are queued and integrated one at a time. Each change includes the backfill, staged index, rollback, and restore note from the architecture doc.

## I1 — Inventory

Role: Backend. Own queue.

- `lib/inventory/**`
- `lib/services/inventory.service.ts`
- `lib/repositories/inventory.repository.ts`
- `tests/integration/mongo-concurrency.test.ts`

I1 owns that integration file. Coupon and loyalty cases are a queued patch from I3. Purchase-receipt cases are a queued patch from I2. I1 lands them one at a time.
- `components/admin/InventoryManager.tsx`
- `components/admin/RecipeEditor.tsx`
- `app/admin/[slug]/inventory/**`
- `app/api/inventory/**`
- `tests/inventory-*.ts`
- `tests/recipe-cost.test.ts`

## I2 — Procurement

Role: Backend. Own queue.

- `lib/services/procurement.service.ts`
- `lib/repositories/procurement.repository.ts`
- `components/admin/ProcurementManager.tsx`
- `app/admin/[slug]/procurement/**`
- `app/api/procurement/**`

## I3 — CRM admin

Role: Backend. Own queue.

- `lib/crm/**`
- `lib/services/crm.service.ts`
- `lib/repositories/crm.repository.ts`
- `components/admin/CrmManager.tsx`
- `app/admin/[slug]/crm/**`
- `app/api/crm/**`
- `tests/loyalty-coupons.test.ts`
- `tests/coupon-redeem-key.test.ts`

## I4 — Multi-outlet

Role: Backend. Own queue.

- `lib/org-rbac.ts`
- `lib/services/organization.service.ts`
- `lib/repositories/organization.repository.ts`
- `lib/services/menu-sync.service.ts`
- `lib/services/access-assignment.service.ts`
- `components/admin/OrganizationDashboard.tsx`
- `app/admin/[slug]/organization/**`
- `app/api/organization/**`
- `tests/org-rbac.test.ts`
- `tests/multi-outlet-boundaries.test.ts`
- `tests/access-assignment.test.ts`

## I5 — Reports

Role: Backend. Own queue.

- `lib/services/reporting.service.ts`
- `lib/analytics/**`
- `components/admin/ReportsDashboard.tsx`
- `app/admin/[slug]/reports/**`
- `app/api/reports/**`
- `tests/financial-reconciliation.test.ts`
- `tests/analytics-sales.test.ts`

`lib/services/forecast.service.ts` and `lib/ai/**` are J, not I5.

## J — AI

Role: Backend.

- `lib/ai/**`
- `lib/services/ai-assistant.service.ts`
- `lib/services/ai-alert.service.ts`
- `lib/services/ai-evaluation.service.ts`
- `lib/services/forecast.service.ts`
- `components/admin/ai/**`
- `app/admin/[slug]/ai/**`
- `app/api/ai/**`
- `tests/ai-*.ts`

## K — Hardware

Role: Backend.

- `lib/devices/**`
- `lib/services/device.service.ts`
- `lib/services/device-fleet.service.ts`
- `lib/services/device-diagnostics.service.ts`
- `lib/services/connector.service.ts`
- `lib/repositories/connector.repository.ts`
- `lib/repositories/device.repository.ts`
- `lib/services/hardware-pilot.service.ts`
- `lib/connector-auth.ts`
- `device-connector/**` including `device-connector/package.json` and `device-connector/package-lock.json`
- `components/admin/DevicesManager.tsx`
- `components/admin/useBarcodeWedge.ts`
- `app/admin/[slug]/devices/**`
- `app/api/devices/**`
- `app/api/connector/**`
- `tests/device-*.ts`
- `tests/connector-pairing.test.ts`
- `tests/escpos-layout.test.ts`
- `tests/barcode-wedge.test.ts`
- `tests/integration/print-job-lease.test.ts`

Acceptance of pair versus heartbeat/jobs/ack waits for A.

## L — DevOps

Role: DevOps. Sole owner of the root toolchain.

- `package.json`
- `package-lock.json`
- `.github/**`
- `next.config.ts`
- `tsconfig.json`
- `tsconfig.errors.json`
- `eslint.config.mjs`
- `postcss.config.mjs`

Final required-check and `ignoreBuildErrors` removal commit is last.

## M — Demo and QA

Role: QA.

- `scripts/seed-pro-max-demo.ts` (new)
- `scripts/cleanup-pro-max-demo.ts` (new)
- `fixtures/pro-max/**` (new)
- `tests/e2e/**` (new)

Not owned here: `lib/demo/**`, `app/api/dev/seed-demo-kitchen/**`, `scripts/verify-demo-reupload-import.mjs`, `scripts/seed-tronx-demo-kitchen.ts` (all D).

Full-role seed waits for D and H. New npm dependencies wait for L.

## N — UI shell

Role: UI/UX, implemented by Frontend.

- `app/globals.css`
- `components/shared/**`
- `components/admin/AdminShell.tsx`
- `components/admin/AdminSidebar.tsx`
- `components/admin/AdminHeader.tsx`
- `components/admin/AdminModal.tsx`
- `lib/admin-layout.ts`
- `lib/theme.ts`

Nav entries from other streams are queued patches, one link per integration.

## O — Payment requests, providers and WhatsApp

This section replaces the earlier proposed Stream O. Source: CTO patch `PATH_OWNERS_STREAM_O_PATCH`, 2026-11-07. Status: Proposed.

O integration depends on Wave 1's single billing writer and ledger and on the crash-retry gates, on Wave 0 validation contracts, and on B's finalized bill, version, and outstanding-balance contract. H's approved staged schema and index changes precede O consumers. A's exact per-handler auth contract precedes route acceptance. D and H capabilities precede full-role acceptance. O is not merge-independent.

Sequence: capability and ADR approval, then B, H, and A queued contract, schema, and auth prerequisites, then O backend and the dedicated Frontend UI, then C, E, G, I5, and K queued caller, report, and kitchen integrations, then M actual-app sandbox QA, then L's final required checks and lockfile. Dependency additions needed earlier still land only through L. Final required-check integration stays last. Each shared file has one owner, one queued patch, one integration at a time. Implementation PRs target `pro-max/release`. No merge or deploy to `main`, no real payment, and no go-live without Founder approval.

Role: Backend Engineer. Reviewer: CTO. The Frontend Engineer alone edits the dedicated UI paths below. Backend is not a second editor of those files.

### Backend Engineer-owned new paths

- `lib/payments/**`: provider interface and adapters, connection and request orchestration, verified-event inbox and outbox, reconciliation, and payment-specific repositories. Dedicated Mongoose files may be `lib/payments/models/**`. H reviews schema, index, and backfill safety. No second ledger, pricing calculator, payment-policy resolver, or direct order writer.
- `lib/messaging/whatsapp/**`: account connections, consent, versioned templates, message outbox and dispatch, delivery verification, and dedicated models and repositories under this namespace. H-reviewed.
- `app/api/payments/**`: role- and capability-gated connection, settings, request, status, refund, and review handlers. A reviews any exact public narrow-token status handler. No blanket anonymous prefix.
- `app/api/messaging/whatsapp/**`: consent, config, template, send, and status handlers with role and outlet checks.
- `app/api/webhooks/payments/**` and `app/api/webhooks/whatsapp/**`: narrowly scoped callbacks with product-specific verification. Do not claim all of `app/api/webhooks/**`.
- `lib/validations/payments.ts` and `lib/validations/whatsapp.ts`: new O modules after Wave 0. H alone re-exports them in the barrel.
- `scripts/payments/**` and `scripts/whatsapp/**`: bounded reconciliation and dispatch entrypoints. Scheduling and deploy configuration remain L.
- `tests/payments/**` and `tests/whatsapp/**`: unit, adapter, signature, tenancy, Mongo integration, and concurrency tests. Do not claim B's order-test glob, I1's integration file, or M's E2E namespace.
- `docs/pro-max/whatsapp-payments/**`: feature architecture, capability, implementation, security, reconciliation, and template docs. The Founder brief and provider research already live at `docs/whatsapp-payments/FOUNDER_BRIEF.md` and `docs/whatsapp-payments/PROVIDER_CAPABILITY_RESEARCH.md`.

ADRs 0006–0011 are in `docs/adr/` with status Proposed. ADR 0005 remains the KOT failure-alert record. No KOT ADR was numbered 0006, so nothing was moved to 0012.

### Frontend Engineer-owned dedicated UI paths

- `components/payments/**`
- `components/messaging/whatsapp/**`
- `app/admin/[slug]/settings/payments-whatsapp/**`

Frontend is the sole editor. These hold Payments and WhatsApp configuration, merchant and WABA status, consent, template and delivery logs, and request-status UI. Existing Billing Preferences remain C's `app/admin/[slug]/settings/billing/**` and `components/admin/BillingSettingsForm.tsx`. No duplicate bill math or settings engine in the new UI. Current POS, captain, and customer tip or bill screens require queued patches to their current owners. Navigation queues to N.

### Queued patches — no ownership transfers

| Change | Existing owner who integrates alone |
| --- | --- |
| Final bill and version, remaining balance, atomic request invalidation and outbox fence, ledger collection and refund component allocation, pure policy resolver, kitchen-release command, tip and GST math | B: `lib/billing/**`, `lib/order-pricing.ts`, `lib/services/order.service.ts`, order repository, transitions, routes, and B-owned tests |
| Existing aggregate schemas, bill and tip fields, org backfill, common types, transaction helper, barrel exports, and migrations | H: `lib/db/models.ts`, `lib/db/mongo-mappers.ts`, `lib/db/mongo-tx.ts`, `lib/repositories/types.ts`, `types/**`, `lib/services/index.ts`, `lib/repositories/index.ts`, `lib/validations/index.ts` |
| New dedicated O Mongoose schema and index rollout | O edits only its namespace. H reviews migration, backup, staged index, rollback, and restore. Existing H files remain H-only |
| Changes to existing billing or order validation | B: `lib/validations/billing.ts`, `lib/validations/orders.ts`. O's new modules do not replace these |
| Exact callback edge exceptions and the auth matrix | A: `proxy.ts`, `lib/api-authz.ts`, `tests/api-proxy-authz.test.ts`. O verifies inside O handlers |
| Shared credential and crypto primitives and role or session consumers | D: `lib/security/**` and auth consumers. H integrates membership schema and types |
| POS and captain billing and tips, Billing Preferences, shift and cash-close guards | C's assigned billing components, pages, settings, and shifts. E's handoff follows the existing C boundary |
| Existing customer bill and tip surfaces | G: `components/customer/**` except E's ReservationPanel, plus `app/menu/**`. Narrow queued patches only |
| Floor and kitchen behavior and release presentation | E's assigned callers, via B's order transitions. Never a direct O aggregate edit |
| Device and print delivery and retry | K's assigned devices and connectors. B owns `lib/kot-print.ts` |
| Financial, tip, and reconciliation report integration | I5: `lib/services/reporting.service.ts`, `lib/analytics/**`, report APIs and UI, and `tests/financial-reconciliation.test.ts` |
| Admin navigation and shell | N |
| Root dependencies, lockfile, toolchain, CI, worker scheduling, and deployment | L |
| Synthetic A, B, and C restaurants, demo cleanup, and actual-app E2E | M: `fixtures/pro-max/**`, `tests/e2e/**`, and M's seed and cleanup scripts. D's existing demo and seed paths remain D |

Do not allocate broad `models/**`, `lib/db/**`, `components/admin/**`, `components/customer/**`, `app/captain/**`, `app/api/admin/billing/**`, `tests/e2e/**`, or `app/api/webhooks/**` to O. `lib/db/models.ts` stays H's. It is not a new O namespace.

Billing policy precedence, recorded for the resolver B owns: order override, then table or session, then channel or order type, then outlet, then organization, then default. Kitchen release is a separate policy and is not forced by the payment policy.

The patch's effort range is an estimate, not a commitment: 35–55 engineering person-days (Backend 23–36, Frontend 12–19), plus 10–15 QA and security person-days, after prerequisite contracts and sandbox accounts. Provider, Meta, merchant, counsel, and Finance waiting time is excluded.

## Observability and release files (pending CTO confirmation)

| Path | Proposed owner |
| --- | --- |
| `lib/observability/logger.ts` | L |
| `lib/observability/request-id.ts` | L proposes it. A lands any change to `proxy.ts`. |
| `lib/rate-limit/store.ts` | L. Not under `lib/security/**`. |
| `docs/ops/BACKUP_RESTORE_DRILL.md` | L |
| `PRODUCTION_DEPLOYMENT_CHECKLIST.md` | L |

ADR 0005 (`docs/adr/0005-polling.md`) covers KOT failure alerts and retries. The v2 board did not create a KOT ADR numbered 0006, so nothing was renumbered to 0012. ADRs 0006–0011 are now in `docs/adr/` as Proposed. Proposed author of ADR 0001 through ADR 0005: TRONX BACKEND ENGINEER. Pending CTO confirmation.

## Validation modules after Wave 0

Wave 0 creates these files. After that merge, the named stream is the only editor. H edits `lib/validations/index.ts` only, and only to re-export.

| Module | Owner after Wave 0 |
| --- | --- |
| `lib/validations/index.ts` | H |
| `lib/validations/auth.ts` | D |
| `lib/validations/orders.ts` | B |
| `lib/validations/billing.ts` | B |
| `lib/validations/captain-authorize.ts` (already in the tree) | E |
| `lib/validations/captain.ts` | E |
| `lib/validations/tables.ts` | E |
| `lib/validations/reservations.ts` | E |
| `lib/validations/catalog.ts` | F |
| `lib/validations/loyalty.ts` | G |
| `lib/validations/inventory.ts` | I1 |
| `lib/validations/procurement.ts` | I2 |
| `lib/validations/crm.ts` | I3 |
| `lib/validations/organization.ts` | I4 |
| `lib/validations/devices.ts` | K |
| `lib/validations/payments.ts` | O, after Wave 0. H re-exports only |
| `lib/validations/whatsapp.ts` | O, after Wave 0. H re-exports only |

## Queued security and CI patches

A and L specify the check. The path owner writes the code.

| Duty | Spec owner | Path owner who lands the patch |
| --- | --- | --- |
| Rate limit on `POST /api/public/orders` | A | B |
| Rate limit on loyalty login, register, and reset | A | G |
| Rate limit on public Wi-Fi reveal | A | G (`app/api/public/restaurants/**`) |
| Rate limit on pairing-code claims | A | K (`app/api/connector/pair`) |
| Origin / CSRF on a cookie-authenticated mutation | A | The stream that owns that route |
| IDOR case for a route | A (matrix test in `tests/api-proxy-authz.test.ts` only) | The stream that owns the route's test file |
| Fail-closed login limiter | A | D (`lib/security/**`) |
| CI fails if integration tests are skipped | L (`.github/**`) | L |
| Payment crash-retry and concurrency tests | L's gate | B |
| Malformed workbook and import/export compatibility tests | L's gate | F |
| UI vs server parity matrix, screen half | L's gate | C |
| UI vs server parity matrix, server half | L's gate | B (`tests/billing-calculator.test.ts`) |
| Migration-safety note when `lib/db/**` changes | L's gate | H |
| Rotation assessment for previously seeded credentials | L's gate | D (`lib/demo/**`, `scripts/verify-demo-reupload-import.mjs`) |
| Dependency add or bump in the root manifests | requesting stream | L |
