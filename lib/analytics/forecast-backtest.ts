import { buildWeekdayForecast, FORECAST_MODEL_VERSION, MIN_COMPLETE_DAYS } from "@/lib/analytics/forecast";
import { addLocalDays, weekdayIndex } from "@/lib/analytics/period";
import type { DailySalesRow } from "@/lib/analytics/sales";
import { roundMoney } from "@/lib/order-pricing";

export type BacktestHorizon = 1 | 7 | 30;

export type BacktestDayResult = {
  date: string;
  actualRevenue: number;
  predictedRevenueP50: number;
  absoluteError: number;
  actualVolume: number;
  predictedVolumeP50: number;
  volumeAbsoluteError: number;
  baselineWeekdayRevenue: number;
  baselineMaRevenue: number;
  withinP10P90: boolean;
};

export type BacktestReport = {
  modelVersion: string;
  trainingFrom: string;
  trainingTo: string;
  testFrom: string;
  testTo: string;
  horizonDays: BacktestHorizon;
  figuresSource: "ESTIMATED" | "INSUFFICIENT_DATA";
  note?: string;
  days: BacktestDayResult[];
  maeRevenue: number | null;
  wapeRevenue: number | null;
  biasRevenue: number | null;
  maeVolume: number | null;
  wapeVolume: number | null;
  baselineWeekdayWape: number | null;
  baselineMaWape: number | null;
  intervalCoverage: number | null;
};

function meanAbs(errors: number[]): number | null {
  if (!errors.length) return null;
  return roundMoney(errors.reduce((s, v) => s + Math.abs(v), 0) / errors.length);
}

function wape(actuals: number[], preds: number[]): number | null {
  const denom = actuals.reduce((s, v) => s + Math.abs(v), 0);
  if (denom <= 0) return null;
  const num = actuals.reduce((s, a, i) => s + Math.abs(a - (preds[i] ?? 0)), 0);
  return roundMoney(num / denom);
}

function bias(actuals: number[], preds: number[]): number | null {
  if (!actuals.length) return null;
  return roundMoney(
    actuals.reduce((s, a, i) => s + ((preds[i] ?? 0) - a), 0) / actuals.length,
  );
}

/**
 * Chronological backtest: for each test day, train only on complete days strictly before that day.
 * Never uses future data.
 */
export function backtestWeekdayMa(params: {
  daily: DailySalesRow[];
  testFrom: string;
  testTo: string;
  horizonDays?: BacktestHorizon;
}): BacktestReport {
  const horizonDays = params.horizonDays ?? 1;
  const complete = params.daily.filter((d) => d.complete).sort((a, b) => a.date.localeCompare(b.date));
  const testDays = complete.filter(
    (d) => d.date >= params.testFrom && d.date <= params.testTo,
  );

  if (complete.length < MIN_COMPLETE_DAYS + 1) {
    return {
      modelVersion: FORECAST_MODEL_VERSION,
      trainingFrom: complete[0]?.date ?? "",
      trainingTo: complete[complete.length - 1]?.date ?? "",
      testFrom: params.testFrom,
      testTo: params.testTo,
      horizonDays,
      figuresSource: "INSUFFICIENT_DATA",
      note: `Need at least ${MIN_COMPLETE_DAYS + 1} complete days for train/test split.`,
      days: [],
      maeRevenue: null,
      wapeRevenue: null,
      biasRevenue: null,
      maeVolume: null,
      wapeVolume: null,
      baselineWeekdayWape: null,
      baselineMaWape: null,
      intervalCoverage: null,
    };
  }

  const results: BacktestDayResult[] = [];
  for (const day of testDays) {
    const train = complete.filter((d) => d.date < day.date);
    if (train.length < MIN_COMPLETE_DAYS) continue;

    // Forecast from the day before target so horizon-1 lands on target date.
    const origin = addLocalDays(day.date, -horizonDays);
    const built = buildWeekdayForecast({
      daily: train.map((d) => ({ ...d, complete: true })),
      horizon: horizonDays === 1 ? "TOMORROW" : horizonDays === 7 ? "NEXT_7_DAYS" : "NEXT_30_DAYS",
      fromDateKey: origin,
    });
    if (built.figuresSource === "INSUFFICIENT_DATA") continue;
    const point = built.points.find((p) => p.date === day.date) ?? built.points[horizonDays - 1];
    if (!point) continue;

    const sameWd = train.filter((d) => weekdayIndex(d.date) === weekdayIndex(day.date));
    const baselineWeekdayRevenue =
      sameWd.length > 0
        ? sameWd[sameWd.length - 1]!.grossSales
        : train[train.length - 1]!.grossSales;
    const recent = train.slice(-7);
    const baselineMaRevenue =
      recent.reduce((s, d) => s + d.grossSales, 0) / Math.max(1, recent.length);

    results.push({
      date: day.date,
      actualRevenue: day.grossSales,
      predictedRevenueP50: point.revenueP50,
      absoluteError: roundMoney(Math.abs(day.grossSales - point.revenueP50)),
      actualVolume: day.orderVolume,
      predictedVolumeP50: point.orderVolumeP50,
      volumeAbsoluteError: Math.abs(day.orderVolume - point.orderVolumeP50),
      baselineWeekdayRevenue: roundMoney(baselineWeekdayRevenue),
      baselineMaRevenue: roundMoney(baselineMaRevenue),
      withinP10P90:
        day.grossSales >= point.revenueP10 && day.grossSales <= point.revenueP90,
    });
  }

  const actuals = results.map((r) => r.actualRevenue);
  const preds = results.map((r) => r.predictedRevenueP50);
  const baseWd = results.map((r) => r.baselineWeekdayRevenue);
  const baseMa = results.map((r) => r.baselineMaRevenue);
  const volsA = results.map((r) => r.actualVolume);
  const volsP = results.map((r) => r.predictedVolumeP50);

  return {
    modelVersion: FORECAST_MODEL_VERSION,
    trainingFrom: complete[0]!.date,
    trainingTo: complete[complete.length - 1]!.date,
    testFrom: params.testFrom,
    testTo: params.testTo,
    horizonDays,
    figuresSource: results.length ? "ESTIMATED" : "INSUFFICIENT_DATA",
    note: results.length
      ? "Chronological walk-forward; incomplete days excluded; no future leakage."
      : "No evaluable test days after history gate.",
    days: results,
    maeRevenue: meanAbs(results.map((r) => r.actualRevenue - r.predictedRevenueP50)),
    wapeRevenue: wape(actuals, preds),
    biasRevenue: bias(actuals, preds),
    maeVolume: meanAbs(results.map((r) => r.actualVolume - r.predictedVolumeP50)),
    wapeVolume: wape(volsA, volsP),
    baselineWeekdayWape: wape(actuals, baseWd),
    baselineMaWape: wape(actuals, baseMa),
    intervalCoverage: results.length
      ? roundMoney(results.filter((r) => r.withinP10P90).length / results.length)
      : null,
  };
}
