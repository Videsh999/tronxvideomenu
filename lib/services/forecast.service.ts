import { randomUUID } from "node:crypto";
import { AiForecastRunModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import { buildWeekdayForecast, FORECAST_MODEL_VERSION } from "@/lib/analytics/forecast";
import { localDateKey, restaurantTimezone } from "@/lib/analytics/period";
import { analyticsService } from "@/lib/services/analytics.service";
import type { AiForecastHorizon, AiForecastRun } from "@/types";

export class ForecastService {
  async getOrCreate(
    restaurantId: string,
    horizon: AiForecastHorizon,
    organizationId?: string,
  ): Promise<AiForecastRun> {
    await connectToDatabase();
    const cached = await AiForecastRunModel.findOne({
      restaurantId,
      horizon,
      modelVersion: FORECAST_MODEL_VERSION,
      generatedAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
    })
      .sort({ generatedAt: -1 })
      .lean();
    if (cached) return toDomain<AiForecastRun>(cached);

    const timeZone = restaurantTimezone();
    const todayKey = localDateKey(new Date().toISOString(), timeZone);
    const inputTo = new Date().toISOString();
    const inputFrom = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const daily = await analyticsService.dailySales(restaurantId, inputFrom, inputTo, timeZone);
    const built = buildWeekdayForecast({
      daily,
      horizon,
      fromDateKey: todayKey,
    });

    const doc = {
      id: `aif-${randomUUID()}`,
      restaurantId,
      organizationId,
      horizon,
      modelVersion: FORECAST_MODEL_VERSION,
      inputFrom,
      inputTo,
      generatedAt: new Date().toISOString(),
      figuresSource: built.figuresSource,
      points: built.points,
      note: built.note,
    };
    await AiForecastRunModel.create(doc);
    return doc;
  }
}

export const forecastService = new ForecastService();
