# AI Forecast Backtest (`weekday-ma-v1`)

**Model:** `weekday-ma-v1` (`lib/analytics/forecast.ts`)  
**Backtester:** `lib/analytics/forecast-backtest.ts`  
**Synthetic series:** complete daily sales 2026-01-01 → 2026-02-07  
**Test window:** 2026-01-25 → 2026-02-07 (horizon = 1 day)  
**Figures source:** `ESTIMATED` (synthetic walk-forward; not production accuracy)

## Method

1. Sort complete days chronologically.
2. For each test day `D`, train **only** on complete days with `date < D`.
3. Exclude incomplete days from training.
4. Never peek at future actuals.
5. Compare p50 prediction to actual revenue and order volume.
6. Baselines: previous comparable weekday; recent overall moving average.
7. Metrics: MAE, WAPE, bias; p10–p90 interval coverage.

## Insufficient history

If fewer than `MIN_COMPLETE_DAYS` prior complete days exist for a forecast origin, the report returns `figuresSource: INSUFFICIENT_DATA`. This is **not** scored as a successful prediction.

Verified by `tests/ai-evaluation.test.ts` (“forecast backtest insufficient history is explicit”).

## Synthetic backtest results (evaluation snapshot)

| Field | Value |
|-------|-------|
| Training coverage | Days strictly before each test day within Jan 1–Feb 7 series |
| Test period | 2026-01-25 → 2026-02-07 |
| Outlet | N/A (synthetic single series) |
| Horizon | 1 day |
| Days evaluated | 14 |
| WAPE revenue | 0.05 |
| MAE revenue | 55 |
| Bias revenue | −35 (slight under-forecast on this series) |
| Baseline weekday WAPE | 0.05 |
| Baseline MA WAPE | 0.07 |
| p10–p90 coverage | 0.50 |

**Interpretation:** On this synthetic weekday-pattern series, `weekday-ma-v1` matched the comparable-weekday baseline WAPE and beat the flat MA baseline. Interval coverage at 50% indicates calibrated bands are not guaranteed — do **not** advertise fixed accuracy %.

## Classification

| Check | Status |
|-------|--------|
| Chronological separation / no future leakage | **Passed** |
| Incomplete-day exclusion | **Passed** |
| Insufficient-history labeling | **Passed** |
| Baseline comparison present | **Passed** |
| Production multi-outlet accuracy claim | **Insufficient data** — requires representative live history per outlet |
| Complex model upgrade | **Deferred** — no meaningful improvement mandate on synthetic data alone |
