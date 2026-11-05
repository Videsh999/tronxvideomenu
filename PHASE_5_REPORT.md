# Phase 5 Report — AI Restaurant Intelligence

**Date:** 2026-11-05  
**Status:** Implemented per `PHASE_5_PLAN.md`

---

## What shipped

| Module | Status |
|--------|--------|
| Trusted analytics ops (`lib/analytics/*`, `analytics.service`) | Done |
| Metric dictionary | `AI_METRICS_DICTIONARY.md` |
| AI security model | `AI_SECURITY.md` |
| Provider abstraction (OpenAI-compatible + heuristic fallback) | Done |
| Usage / rate limits (`aiUsageEvents`) | Done |
| Business Assistant API + UI | Done |
| Sales forecast `weekday-ma-v1` + persistence | Done |
| Inventory intelligence (no auto-PO) | Done |
| Menu Stars/Plowhorses/Puzzles/Dogs | Done |
| Operational alerts + dedupe + ack/resolve | Done |
| AI dashboard `/admin/[slug]/ai/*` | Done |
| Feature flags (ENTERPRISE) | Done |

## Architecture summary

- LLM (optional) selects from a fixed Zod tool allowlist; server executes analytics.
- Without `AI_API_KEY`, `HeuristicAiProvider` maps questions to tools deterministically.
- Outlet scope via `requireOutletPermission`; forged outlet/org IDs rejected.
- No AI path mutates stock, payments, prices, or POs.

## APIs

| Route | Feature |
|-------|---------|
| `POST /api/ai/assistant` | `AI_BUSINESS_ASSISTANT` |
| `GET /api/ai/forecast` | `AI_SALES_FORECAST` |
| `GET /api/ai/inventory` | `AI_INVENTORY_INTELLIGENCE` |
| `GET /api/ai/menu` | `AI_MENU_INTELLIGENCE` |
| `GET/POST /api/ai/alerts` | `AI_OPERATIONAL_ALERTS` |
| `GET /api/ai/overview` | any AI flag |

## Test results (this run)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **pass** |
| `npm test` | **112/112 pass** |
| `npm run build` | **pass** |

New coverage: `tests/analytics-sales.test.ts`, `tests/ai-security.test.ts`. Existing suites retained.

## Deployment

1. Deploy additive schemas (`aiForecastRuns`, `aiAlerts`, `aiUsageEvents`, `aiAssistantThreads`, supplier `leadTimeDays`, order/movement indexes).
2. Optional: set `AI_API_KEY`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`.
3. ENTERPRISE plan (or feature overrides) required for AI nav/APIs.

## Known limitations (honest)

- Forecast v1 is weekday moving average only — no holiday calendar.
- CRM inactive customers use order `customerId` history (`lastOrderAt` may still lag).
- Heuristic assistant without an API key returns tool JSON explanations, not polished NL.
- Inventory demand needs recipes + recent dish sales; otherwise `INSUFFICIENT_DATA`.
- Estimated gross margin is **not** accounting profit.
- Overview/assistant panels use explicit Load/Ask actions (no auto-fetch on mount) to avoid effect lint debt.
- Full live LLM integration tests are env-dependent (key required).

## Non-goals preserved

QR / POS / KDS / inventory / procurement architecture unchanged as sources of truth. No warehouse. No LLM-driven mutations.
