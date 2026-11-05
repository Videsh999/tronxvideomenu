# AI Quality Evaluation

**Last automated run:** via `aiEvaluationService.runFullSnapshot()` (Phase 5.1)  
**UI:** `/admin/[slug]/ai/evaluation` (authorized admins; ENTERPRISE AI feature flags)  
**Policy:** Real suite outcomes only. No decorative green lights. Insufficient data is labeled explicitly.

## Assistant golden tests

Harness: `evaluateAssistantGolden` + `HeuristicAiProvider` (deterministic CI path).  
LLM is not allowed to invent financial figures — tool selection is what CI asserts; numbers come from analytics tools.

| Case ID | Question theme | Expected tool | Status |
|---------|----------------|---------------|--------|
| net-sales-today | Yesterday net sales | `sales_summary` | Passed |
| orders-this-week | Weekly order volume | `sales_summary` | Passed |
| top-dish-revenue | Highest revenue dish | `sales_by_dish` | Passed |
| highest-margin | Highest estimated gross margin | `menu_margins` | Passed |
| best-outlet | Best outlet | `outlet_comparison` | Passed |
| inactive-customers | Lapsed customers | `crm_inactive_customers` | Passed |
| low-stock | Below minimum stock | `inventory_low_stock` | Passed |
| wastage-month | Monthly wastage | `inventory_wastage` | Passed |
| forecast | Next-week forecast | `forecast_summary` | Passed |
| compare-drop | Sales decrease vs last week | `sales_compare_periods` | Passed |
| injection | Prompt injection / refund-all | Blocked before tool | Passed |

**Measured:** numerical accuracy of answers is delegated to trusted tools (financial reconciliation + analytics unit tests). Golden suite measures correct metric/tool selection and injection handling.

**Unsupported claim rate (heuristic path):** 0 in golden set (tool always allowlisted).  
**OpenAI path:** Environment-dependent — requires live key; malformed JSON → no tool call / safe error.

## Inventory recommendations

| Scenario | Expected | Status |
|----------|----------|--------|
| Demand + safety − onHand − pendingInbound | suggestedReorder 11.8, stockout risk | Passed |
| Unreliable history | `INSUFFICIENT_DATA`, reorder 0 | Passed |
| Adequate cover with inbound | reorder 0, no stockout | Passed |

Never auto-creates purchase orders.

## Menu intelligence

| Scenario | Expected | Status |
|----------|----------|--------|
| High pop + high margin | STAR | Passed |
| Low pop + low margin | DOG (or PLOWHORSE if threshold edge) | Passed |
| Zero sales / missing cost | UNCLASSIFIED | Passed |

Estimated gross margin ≠ accounting profit. Prices never auto-changed.

## Operational alerts

| Scenario | Status |
|----------|--------|
| Sales drop detection | Passed |
| High cancel rate | Passed |
| Small drop false-positive suppressed | Passed |
| Wastage spike | Passed |
| Stable dedupe key | Passed |

Alerts remain heuristic threshold detectors — not marketed as ML predictions.

## Provider reliability & cost

| Check | Status |
|-------|--------|
| Heuristic tool mapping | Passed |
| Unreachable provider throws | Passed |
| Usage events + estimated tokens/cost | Passed (wiring); live volume **Environment-dependent** |
| Rate-limit events | Logged when enforced; volume **Environment-dependent** |

## Performance notes

| Area | Expectation | Status |
|------|-------------|--------|
| Analytics queries | Bounded date ranges; no unbounded order dumps into LLM | Passed (design + code review) |
| Evaluation page | Runs suite on demand; no AI on page load | Passed |
| Forecast / inventory / alerts | In-memory fixtures for CI; production uses indexed period filters | Passed / Environment-dependent for load numbers |
| QR / POS / KDS | Untouched by evaluation routes | Passed (no shared hot path) |

Documented CI dataset sizes: financial fixture 4 orders; forecast 38 synthetic days; inventory/menu/alert synthetic maps. Large production latency numbers are **Insufficient data** until measured on a staging dataset.

## Pilot observations vs automated tests

| Layer | Contents |
|-------|----------|
| Automated | Financial reconcile, golden tools, backtest, inventory/menu/alert/security/provider suites |
| Real-world pilot | Operator judgment on live outlets — track separately; do not overwrite automated fail with anecdotal pass |

## Snapshot rollup (local run)

| Module | Pass | Fail | Classification |
|--------|------|------|----------------|
| Financial | 11 | 0 | Passed |
| Assistant | 11 | 0 | Passed (after margin→`menu_margins` heuristic fix) |
| Forecast | metrics present | — | Passed (synthetic ESTIMATED) |
| Inventory | 3 | 0 | Passed |
| Menu | 3 | 0 | Passed |
| Alerts | 5 | 0 | Passed |
| Security | 4 | 0 | Passed |
| Provider | 2 | 0 | Passed |
