import { roundMoney } from "@/lib/order-pricing";
import { addLocalDays, weekdayIndex } from "@/lib/analytics/period";
import type { DailySalesRow } from "@/lib/analytics/sales";
import type { AiForecastHorizon, AiForecastPoint, FiguresSource } from "@/types";

export const FORECAST_MODEL_VERSION = "weekday-ma-v1";
export const MIN_COMPLETE_DAYS = 14;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx]!;
}

export function buildWeekdayForecast(params: {
  daily: DailySalesRow[];
  horizon: AiForecastHorizon;
  fromDateKey: string;
}): {
  figuresSource: FiguresSource;
  points: AiForecastPoint[];
  note?: string;
} {
  const complete = params.daily.filter((day) => day.complete);
  if (complete.length < MIN_COMPLETE_DAYS) {
    return {
      figuresSource: "INSUFFICIENT_DATA",
      points: [],
      note: `Need at least ${MIN_COMPLETE_DAYS} complete local days of history; found ${complete.length}.`,
    };
  }

  const byWeekday = new Map<number, { revenue: number[]; volume: number[] }>();
  for (const day of complete) {
    const wd = weekdayIndex(day.date);
    const bucket = byWeekday.get(wd) ?? { revenue: [], volume: [] };
    bucket.revenue.push(day.grossSales);
    bucket.volume.push(day.orderVolume);
    byWeekday.set(wd, bucket);
  }

  const days =
    params.horizon === "TOMORROW" ? 1 : params.horizon === "NEXT_7_DAYS" ? 7 : 30;
  const points: AiForecastPoint[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addLocalDays(params.fromDateKey, i);
    const wd = weekdayIndex(date);
    const bucket =
      byWeekday.get(wd) ?? {
        revenue: complete.map((d) => d.grossSales),
        volume: complete.map((d) => d.orderVolume),
      };
    const rev = [...bucket.revenue].sort((a, b) => a - b);
    const vol = [...bucket.volume].sort((a, b) => a - b);
    const meanRev = rev.reduce((s, v) => s + v, 0) / rev.length;
    const meanVol = vol.reduce((s, v) => s + v, 0) / vol.length;
    points.push({
      date,
      revenueP10: roundMoney(percentile(rev, 10)),
      revenueP50: roundMoney(meanRev),
      revenueP90: roundMoney(percentile(rev, 90)),
      orderVolumeP10: Math.round(percentile(vol, 10)),
      orderVolumeP50: Math.round(meanVol),
      orderVolumeP90: Math.round(percentile(vol, 90)),
    });
  }

  return {
    figuresSource: "ESTIMATED",
    points,
    note: `Weekday moving-average baseline (${FORECAST_MODEL_VERSION}). Not a guarantee.`,
  };
}
