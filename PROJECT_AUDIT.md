# TRONX Restaurant OS — Project Audit (Phase 0)

**Date:** 2026-11-05 (Phase 0) · **Updated:** 2026-11-05 (Phase 4.1 hardening)  
**Production URL:** https://menu.tronx.co.in (also previously deployed as https://tronxvideomenu.vercel.app)  
**Codebase:** `/Users/nareshbonam/Desktop/tronxvideomenu`  
**Status:** Phase 0–4.1. See `PHASE_4_REPORT.md`, `PHASE_4_1_REPORT.md`, `POS_KDS.md`, `MENU_IMPORT_ENGINE.md`.

---

## 1. Executive summary

TRONX today is a **strong video-first digital menu + table QR ordering platform**, not yet a full Restaurant Operating System.

| Area | Maturity |
|------|----------|
| Customer QR video menu | **Production-ready** (i18n, Surprise Me, Wi‑Fi, reservations, cart, live status) |
| Restaurant admin console | **Strong** (menu, tables/QR, orders, captains, media, profile, availability) |
| Captain floor ops | **Good** (accept → kitchen + KOT print, payments, tables) |
| Super Admin | **Good** (restaurants, plans/features, credential management) |
| POS / billing / KDS / inventory / CRM / Excel import / multi-outlet / AI BI | **Missing** (flags or stubs only) |

**Strategic recommendation:** Preserve the current ordering and menu stack. Grow into Restaurant OS **incrementally** on the existing Next.js + MongoDB architecture. Highest-value next build: **AI-assisted Excel menu import** (Phase 2), then deepen **order/POS/KDS** (Phase 3), then inventory/CRM/analytics (Phases 4–5).

---

## 2. Stack and architecture (as implemented)

| Layer | Choice |
|-------|--------|
| Framework | Next.js **16.3.6** App Router, React **19.2** |
| Language / UI | TypeScript, Tailwind CSS **v4** |
| Database | MongoDB via **Mongoose 9** |
| Media | Cloudinary |
| Validation | Zod + React Hook Form |
| Auth | Signed httpOnly session cookies (`AUTH_SECRET`); roles: `SUPER_ADMIN`, `RESTAURANT_ADMIN`, `CAPTAIN` |
| Edge auth | Root `proxy.ts` (Next 16; **no** `middleware.ts`) |
| Tests | `npm test` → `tsx --test tests/**/*.test.ts` (do **not** use `node --import tsx --test`) |
| Hosting | Vercel (env-driven) |

**Pattern:** Repository → Service → API route / RSC page. Feature gating via `subscriptionPlan` + `featureOverrides` (`lib/features.ts`).

**Tenant model:** Restaurant documents keyed by `restaurantId` / `slug`. Optional `organizationId` + org RBAC (`orgRole` / `outletIds`) for multi-outlet (Phase 4.1).

---

## 3. What is already working

### 3.1 Customer experience (`/menu/[slug]`)
- Video-first menu, categories, search, filters (veg / video / available / price)
- Dish detail with add-ons, gallery, cart, table-scoped ordering (`?table=`)
- Order placement with idempotency + customer status token
- Live-ish order tracking UI
- Reservations (when feature enabled)
- Encrypted Wi‑Fi reveal panel (Enterprise + WIFI feature)
- i18n + translations API, Surprise Me meal builder, speak button

### 3.2 Restaurant admin (`/admin/[slug]`, login via `/menu/[slug]/admin`)
- Dashboard, orders board, tables + QR, menu hub (categories / dishes / add-ons)
- Availability, media library, reservations, captains, profile (+ Wi‑Fi)
- Plan/feature-aware sidebar

### 3.3 Captain (`/captain/[slug]`, login via `/menu/[slug]/captain`)
- Orders + tables; Accept → PREPARING + browser KOT print
- Payment recording (CASH / UPI / CARD)

### 3.4 Super Admin
- Restaurant CRUD, theme/plan/feature overrides
- Restaurant admin credential migrate / verify / show password (encrypted at rest)

### 3.5 Security foundations present
- Password hashing + optional recoverable encryption (`CREDENTIALS_ENCRYPTION_KEY`)
- Wi‑Fi encryption (`WIFI_ENCRYPTION_KEY`)
- Login rate limiting (`loginAttempts` collection)
- Zod validation on many forms/APIs
- Order payment audit trail
- Theme protection for restaurant admins (cannot freely change some theme fields)

### 3.6 Order state machine (implemented)
`PENDING → ACCEPTED → PREPARING → READY → SERVED → COMPLETED` (+ cancel/reject; `COMPLETED → REFUNDED`).  
UI board collapses ACCEPTED+PREPARING into **Kitchen**. Payment: `UNPAID` / `PARTIAL` / `PAID` / `REFUNDED` with ledger + staff audit.

### 3.7 POS + KDS (Phase 3)
- Shared order model for QR and POS (`channel` / `source`, immutable snapshots, tax/discounts).
- Admin POS terminal + shifts; kitchen display with stations and live poll — see `POS_KDS.md`.

---

## 4. Inventory of surfaces

### Pages (~34)
Public: `/`, `/menu/[slug]`, portal logins under `/menu/[slug]/admin|captain`  
Admin: dashboard, orders, tables, menu/*, availability, media, reservations, captains, profile  
Captain: dashboard, orders, tables  
Super-admin: home, restaurants list/new/edit  
Legacy redirects under `/admin/menu`, `/admin/media`, etc.

### API routes (~43)
Auth, public orders/reservations/wifi/translations, restaurants, orders (+ payment + customer status), tables, reservations, categories/dishes/addons, media, admin wifi/captains, captain orders/tables, super-admin restaurant-admins.

### MongoDB collections
`restaurants`, `categories`, `dishes`, `addonGroups`, `addons`, `media`, `tables`, `orders`, `orderCounters`, `captains`, `restaurantAdminAccounts`, `reservations`, `translationCache`, `loginAttempts`.

---

## 5. Gap analysis vs Restaurant OS vision

Legend: **Done** | **Partial** | **Missing**

| Module (brief §2) | Status | Notes |
|-------------------|--------|-------|
| A. Restaurant Administration | **Partial** | Strong ops console; no granular RBAC beyond 3 roles |
| B. Intelligent Menu Management | **Partial** | CRUD + addons + Excel import + optional dish variants/SKU; outlet prices still future |
| C. POS and Billing | **Partial** | POS UI, tax, discounts, partial pay, refunds, shifts, receipts; split-bill UX still thin |
| D. Order Management | **Partial** | QR + POS dine-in/takeaway/delivery; phone channel still future |
| E. Kitchen Display System | **Partial** | Station KDS + poll/sound/fullscreen; not WebSocket yet |
| F. QR Menu / Self Ordering | **Done** | Core product strength |
| G. Table Management | **Done** | CRUD, QR, occupancy coupling |
| H. Inventory | **Partial** | Ingredients, recipes, ledger, auto-consume/restore rules; recipe UI thin — see `PHASE_4_REPORT.md` |
| I. Purchase / Suppliers | **Partial** | Suppliers, POs, goods receipt, reorder suggestions; PO UI API-first |
| J. CRM | **Partial** | Profiles, loyalty ledger, coupons, feedback |
| K. Offers / Loyalty | **Partial** | Coupons + points ledger; POS coupon redeem not wired |
| L. AI Restaurant Assistant | **Missing** | Translation + Surprise Me only (not ops AI) |
| M. Analytics / BI | **Partial** | Reports dashboard + sales/inventory/CRM aggregates; deep BI deferred |
| N. Employee / Roles | **Partial** | Super Admin / Restaurant Admin / Captain only |
| O. Multi-Branch | **Partial** | Organizations + outlet attach + stock transfers; central menu sync deferred |
| P. Payment / Financial | **Partial** | Manual CASH/UPI/CARD + partial/refund ledger; no payment gateway yet |
| Q. Notifications | **Missing** | — |
| R. Reports / Exports | **Missing** | — |
| S. Platform Super Admin | **Done** | — |
| T. Security / Audit / Monitoring | **Partial** | Auth + rate limit + payment audit; no central audit log / APM product |

**Priority features:** Excel Menu Import — **Done** (`MENU_IMPORT_ENGINE.md`). POS/KDS — **Delivered** (`POS_KDS.md`); deepen split bills + gateway in later phases.

---

## 6. Risks and defects observed

| Risk | Severity | Detail |
|------|----------|--------|
| Coarse API proxy auth | Medium | Non-captain `/api/*` accepts any of 3 session types at edge; **handlers** must enforce role — inconsistent checks would leak |
| Public full menu GET | Low–Med | `GET /api/restaurants/...` can expose full menu without login (may be intentional) |
| Dual login entry points | Low | Global `/admin/login` vs `/menu/{slug}/admin` — document as intentional |
| No dish variants | High for import/POS | Half/Full must today be modeled as addons or separate dishes — import engine must introduce Variant schema carefully |
| Orders: no tax/discount | High for POS | `subtotal === total`; pricing model must extend without breaking snapshots |
| ANALYTICS flag without product | Low | Misleading entitlement |
| Test runner fragility | Medium | No `npm test`; some tests (e.g. wifi + Zod under tsx) can fail/hang; no Playwright E2E |
| Theme contrast (historical) | Fixed pattern | Customer sheets using `--restaurant-text` on white cards broke Wi‑Fi UX for light text themes — prefer neutral sheets for critical panels |
| Production data safety | Critical | Never point seed at prod; never rotate encryption keys without migration |
| Scope explosion | Critical | Implementing all §2–§20 in one pass will break production — phase strictly |

---

## 7. Tests executed (Phase 0)

| Suite | Result |
|-------|--------|
| `dish-media`, `local-qr-generation`, `meal-builder`, `order-board` | **Pass** (12 assertions) |
| `wifi-configuration.test.ts` | **Fail** under `node --import tsx` (Zod v4 `util.derived` load error) |
| Remaining tests (auth, payments, crypto, etc.) | **Not fully run** in this session (prior full-suite run hung / env-sensitive) |
| `npm run build` / production E2E against menu.tronx.co.in | **Not run** in Phase 0 |

**Action:** Add `npm test` script; fix Zod/tsx loading; add CI; introduce Playwright for critical journeys later.

---

## 8. What must not be broken while expanding

1. Public place-order + customer status token flow  
2. Captain accept → PREPARING + KOT print + payment record  
3. Table QR generation and table identity validation server-side  
4. Feature entitlement checks  
5. Credential encryption / Wi‑Fi encryption key stability  
6. Existing dish/addon/media Cloudinary URLs  
7. Super Admin restaurant provisioning  

Any schema change must be **additive** (new fields/collections), with dual-read where needed. **Never delete production menu/order documents** during migrations.

---

## 9. Recommended phased plan (aligned to brief §21)

### Phase 0 — Discovery ✅
- This document + checklist below

### Phase 1 — Foundation ✅ (2026-11-05)

#### Original failure
- Suite reported **21 pass / 7 fail** when run as `node --import tsx --test tests/*.test.ts`.
- Failing files: `captain-credential-access`, `category-deletion-protection`, `order-payment-recording`, `restaurant-admin-auth`, `restaurant-theme-protection`, `safeguards-and-rate-limiter`, `wifi-configuration`.

#### Actual root causes
1. **Wrong test invocation:** `node --import tsx` registers a global transform that breaks Zod v4 CJS (`util.derived is not a function`) and can rewrite `mongodb` TypeScript sources.
2. **Corrupted / inconsistent `node_modules`:** `require('mongoose')` failed with `BSON.onDemand` undefined / related driver load errors until a clean `npm ci`.
3. **Not application logic bugs** — the same test bodies pass under `tsx --test` after a clean install.

#### Fix implemented
| Change | Detail |
|--------|--------|
| Clean install | `rm -rf node_modules && npm ci` |
| `package.json` scripts | Added `test`, `test:unit` (`tsx --test tests/**/*.test.ts`), `typecheck` |
| Proxy authz | `lib/api-authz.ts` + hardened `proxy.ts` so captains cannot pass edge gate for staff/admin/super-admin APIs |
| Regression tests | `tests/api-proxy-authz.test.ts` |
| Lint blocker | Removed `setState` in `useEffect` for Wi‑Fi seed sync in `RestaurantProfileForm.tsx` |

#### Dependency changes
- **No package version pins changed.** Only reinstall + scripts.

#### Validation results (Phase 1 acceptance)
| Check | Result |
|-------|--------|
| `npm test` | **56 pass / 0 fail** (expanded individual cases; includes original suite + new authz tests) |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **0 errors** (17 pre-existing warnings remain) |
| `npm run build` | **Pass** |

#### Remaining Phase 1 limitations / follow-ups
- Lint warnings (unused vars, `window.location.assign` in portal login) not treated as blockers.
- Additive schemas for ImportJob / dish variants deferred to **Phase 2** (implement with the import engine).
- Handler-level auth was already largely correct; proxy now matches that intent at the edge.
- Do not run tests via `node --import tsx --test`.

### Phase 2 — Menu Intelligence ✅ (2026-11-05)
Delivered end-to-end Excel/CSV import integrated into existing admin menu (not a parallel catalog).

| Piece | Location |
|-------|----------|
| Parse / map / infer / match / commit | `lib/menu-import/*` |
| Jobs collection | `menuImportJobs` via `lib/db/import-job-model.ts` |
| APIs | `/api/admin/menu-import/**` |
| UI | `/admin/[slug]/menu/import` + `MenuImportWizard` |
| Feature | `MENU_IMPORT` on PRO + ENTERPRISE |
| Additive dish field | `sku` |
| Docs | `MENU_IMPORT_ENGINE.md` |

**Variants:** Half/Full/etc. become required **Size** addon groups (works with current QR cart).  
**Validation:** `npm test` **62/62**, `tsc` pass (build verified in Phase 2 session).

### Phase 3 — Core operations
- POS surface (reuse order + payment model; add tax/discount carefully)  
- True KDS page (stations, timers) on top of order statuses  
- Channel types (dine-in / takeaway / delivery) on Order  

### Phase 4 — Business management
- Inventory + recipes + stock movements  
- CRM / loyalty / coupons  
- Reports CSV/XLSX  
- Organization + outlets (multi-branch) — **largest schema risk; last among Phase 4**

### Phase 5 — AI / automation
- Ops summaries from real order aggregates (deterministic first)  
- Human-approved recommendations only  

### Phase 6 — Hardware
- Print agent / device config (build on existing browser KOT)  

### Phase 7 — Full QA + docs pack
- Remaining deliverables: SYSTEM_ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, SECURITY_AUDIT, PERFORMANCE_REPORT, TESTING_REPORT, DEPLOYMENT_GUIDE, FINAL_QA_REPORT  

---

## 10. Prioritized implementation checklist

### Now (Phase 1) ✅
- [x] Add `npm test` and fix Zod/tsx test loading  
- [x] Proxy role gates + authz regression tests  
- [x] Typecheck + production build green  
- [ ] Design additive schemas for ImportJob + Dish variants/SKU (starts with Phase 2)  
- [ ] Confirm production env vars on menu.tronx.co.in match `.env.example` required set  

### Next (Phase 2 — Menu Import)
- [ ] Feature flag `MENU_IMPORT` (ENTERPRISE or PRO+)  
- [ ] Upload + template download UI under admin menu hub  
- [ ] Parser service (xlsx/csv) — choose safe library; never execute formulas  
- [ ] AI mapping adapter (Gateway/OpenAI) returning schema-validated mapping  
- [ ] Preview + approve + commit job  
- [ ] Import history page  
- [ ] Tests: formats A–E samples, duplicates, rollback  

### Later
- [ ] POS, KDS, inventory, CRM, multi-outlet, AI BI, hardware (Phases 3–6)  
- [ ] Full documentation pack (Phase 7)  

---

## 11. Session report (Phase 0)

| Item | Detail |
|------|--------|
| Inspected | App routes, APIs, `proxy.ts`, models, features, order/payment/reservation/wifi services, customer/admin/captain/super-admin UI, package.json, README, tests |
| Already working | Video QR menu, ordering, admin menu ops, captain board+KOT, reservations, Wi‑Fi, credentials, i18n/Surprise Me |
| Broken / weak | Full OS modules missing; ANALYTICS empty; wifi unit test under tsx; no E2E/CI test script |
| Implemented this phase | **Documentation only** — `PROJECT_AUDIT.md` |
| Migrations | None |
| Tests executed | Subset of unit tests (12 pass, 1 fail wifi/zod) |
| Issues remaining | Entire Restaurant OS backlog; see checklist |

---

## 12. Decision gate before coding

**Do not rebuild the app.** Extend this codebase.

**Next coding session should start Phase 1 item 1–3, then Phase 2 Menu Import** unless product owner reprioritizes POS/KDS ahead of import.

**Owner confirmation requested (optional):** Prefer Phase 2 Excel import immediately after minimal Phase 1 test/auth hardening — yes/no.
