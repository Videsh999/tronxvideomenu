# Phase 5 — AI Restaurant Intelligence (implementation plan)

**Status:** Approved for implementation  
**Basis:** Audit of Phase 0–4.1 + closure; existing Mongo/Mongoose services remain the source of truth.

## Audit findings (what we reuse)

- **Analytics today:** `lib/services/reporting.service.ts` loads orders in memory; gross sales = sum of `order.total` excluding CANCELLED/REJECTED; not payment-ledger net. Phase 5 **extends** this into a trusted analytics ops catalog — no second warehouse.
- **Margins:** `lib/inventory/recipe-cost.ts` `estimateDishMargin` already marked estimated. Reuse; never label as net/accounting profit.
- **RBAC:** `lib/org-rbac.ts` + `lib/admin-api.ts` `requireOutletPermission`. Wire on every AI route; never trust model or client outlet IDs.
- **Features:** `lib/features.ts` — five AI flags on ENTERPRISE.
- **AI today:** none (menu-import is synonym/fuzzy only). Provider layer is greenfield.
- **Rate limit:** login-only pattern generalized for AI usage.
- **CRM recency:** `lastOrderAt` may lag — inactive-customer tools query `orders.customerId` + `createdAt`.
- **Holidays / lead times:** Forecast v1 = weekday statistical baseline. Supplier `leadTimeDays` optional (default 2) + pending PO qty.
- **Timezone:** restaurant settings `Asia/Kolkata` for day boundaries.

## Architecture (non-negotiable)

```
UI → AI API → Auth/RBAC/FeatureFlags → AnalyticsToolRegistry → Orders/Inventory/CRM
                         ↓
              AssistantOrchestrator → AiProvider (explain/NLU only)
                         ↓
              Forecast / Inventory / Menu / Alerts → AiForecast / AiAlert / AiUsage
```

Rules:
- LLM selects from a fixed Zod-validated tool allowlist; never generates Mongo/SQL/JS.
- Tools run only after server resolves outlet scope from session + RBAC.
- LLM never mutates stock, prices, payments, or POs.
- Provider failure returns structured tool data without narrative; QR/POS/KDS unaffected.

**Provider:** OpenAI-compatible HTTP via env (`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`).

## Feature flags (ENTERPRISE)

- `AI_BUSINESS_ASSISTANT`
- `AI_SALES_FORECAST`
- `AI_INVENTORY_INTELLIGENCE`
- `AI_MENU_INTELLIGENCE`
- `AI_OPERATIONAL_ALERTS`

## Modules

1. Trusted analytics ops + metrics dictionary  
2. Provider abstraction + security  
3. Business Assistant  
4. Sales Forecasting (`weekday-ma-v1`)  
5. Inventory Intelligence (no auto-PO)  
6. Menu Intelligence (Stars / Plowhorses / Puzzles / Dogs)  
7. Operational Alerts (deterministic first)  
8. AI Dashboard under `/admin/[slug]/ai`

## Out of scope

No Mongo replacement, no warehouse, no LLM-direct mutations, no auto PO/price/refund, no sync AI on QR/POS/KDS paths.

See also: `AI_METRICS_DICTIONARY.md`, `AI_SECURITY.md`, `PHASE_5_REPORT.md`.
