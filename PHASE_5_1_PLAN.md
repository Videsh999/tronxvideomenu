# Phase 5.1 — AI Validation & Intelligence Quality

**Status:** Executed — see `PHASE_5_1_REPORT.md` (builds on Phase 5; no module rebuilds)

## Audit reuse map

| Need | Reuse |
|------|--------|
| Sales / dish / compare | `lib/analytics/sales.ts`, `analytics.service` |
| Forecast model | `lib/analytics/forecast.ts` `weekday-ma-v1` |
| Inventory reorder math | `lib/analytics/inventory-intelligence.ts` |
| Menu BCG classes | `lib/analytics/menu-intelligence.ts` |
| Alerts | `lib/analytics/alerts.ts` + `ai-alert.service` |
| Assistant tools / heuristic | `lib/analytics/tools.ts`, `HeuristicAiProvider` |
| Security primitives | `lib/ai/redact.ts`, `requireOutletPermission` |
| Usage events | `aiUsageEvents` / `lib/ai/usage.ts` |
| Metric definitions | `AI_METRICS_DICTIONARY.md` |

**Gaps to close in 5.1 (additive only):**
- Explicit financial reconciliation (discounts, tax, collected vs outstanding) beyond gross/net.
- Golden assistant Q→tool→figure tests.
- Chronological forecast backtest with MAE/WAPE/bias + baselines.
- Deterministic inventory/menu/alert fixture suites with explanations.
- Expanded security + provider failure tests.
- Evaluation dashboard + usage/cost visibility.
- Honest docs with pass/fail/insufficient-data classification.

## Sequence

1. Financial reconciliation module + fixtures + `AI_FINANCIAL_VALIDATION.md`
2. Assistant golden evaluation harness
3. Forecast backtester + `AI_FORECAST_BACKTEST.md`
4. Inventory / menu / alert validation tests
5. Security & provider reliability
6. `/admin/[slug]/ai/evaluation` + usage API
7. `AI_QUALITY_EVALUATION.md` + `PHASE_5_1_REPORT.md` + update `AI_SECURITY.md`

## Non-negotiables

Preserve Phase 5 APIs/UI. LLM never becomes financial source of truth. No future leakage in backtests. No fabricated accuracy %. No automatic ops mutations.
