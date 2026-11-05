import { randomUUID } from "node:crypto";
import { AiAlertModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import {
  detectHighCancelRate,
  detectRefundSpike,
  detectSalesDrop,
  detectWastageSpike,
  type DetectedAlert,
} from "@/lib/analytics/alerts";
import { analyticsService } from "@/lib/services/analytics.service";
import type { AiAlert, AiAlertStatus } from "@/types";

export class AiAlertService {
  async list(restaurantId: string, status?: AiAlertStatus) {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (status) filter.status = status;
    const rows = await AiAlertModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return {
      figuresSource: "ACTUAL" as const,
      alerts: rows.map((row) => toDomain<AiAlert>(row)),
    };
  }

  async scan(restaurantId: string, organizationId?: string) {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86_400_000);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - 7 * 86_400_000);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const prevFromIso = prevFrom.toISOString();
    const prevToIso = prevTo.toISOString();

    const compare = await analyticsService.salesCompare(
      restaurantId,
      fromIso,
      toIso,
      prevFromIso,
      prevToIso,
    );
    const wastageNow = await analyticsService.inventoryWastage(restaurantId, fromIso, toIso);
    const wastagePrev = await analyticsService.inventoryWastage(
      restaurantId,
      prevFromIso,
      prevToIso,
    );

    const detected: DetectedAlert[] = [];
    const drop = detectSalesDrop({
      restaurantId,
      current: compare.current,
      previous: compare.previous,
    });
    if (drop) detected.push(drop);
    const cancels = detectHighCancelRate({ restaurantId, summary: compare.current });
    if (cancels) detected.push(cancels);
    const refunds = detectRefundSpike({
      restaurantId,
      currentRefunds: compare.current.refundedAmount,
      previousRefunds: compare.previous.refundedAmount,
      from: fromIso,
      to: toIso,
    });
    if (refunds) detected.push(refunds);
    const waste = detectWastageSpike({
      restaurantId,
      currentQty: wastageNow.wastageQuantityBase,
      previousQty: wastagePrev.wastageQuantityBase,
      from: fromIso,
      to: toIso,
    });
    if (waste) detected.push(waste);

    await connectToDatabase();
    const saved: AiAlert[] = [];
    const now = new Date().toISOString();
    for (const alert of detected) {
      try {
        const created = await AiAlertModel.findOneAndUpdate(
          { restaurantId, dedupeKey: alert.dedupeKey },
          {
            $setOnInsert: {
              id: `aia-${randomUUID()}`,
              restaurantId,
              organizationId,
              type: alert.type,
              dedupeKey: alert.dedupeKey,
              title: alert.title,
              severity: alert.severity,
              status: "NEW",
              detectionFrom: fromIso,
              detectionTo: toIso,
              supportingData: alert.supportingData,
              reason: alert.reason,
              suggestedAction: alert.suggestedAction,
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true, new: true },
        ).lean();
        if (created) saved.push(toDomain<AiAlert>(created));
      } catch {
        const existing = await AiAlertModel.findOne({
          restaurantId,
          dedupeKey: alert.dedupeKey,
        }).lean();
        if (existing) saved.push(toDomain<AiAlert>(existing));
      }
    }
    return { figuresSource: "ACTUAL" as const, alerts: saved, scanned: detected.length };
  }

  async updateStatus(
    restaurantId: string,
    alertId: string,
    status: AiAlertStatus,
  ): Promise<AiAlert | null> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updatedAt: now };
    if (status === "ACKNOWLEDGED") patch.acknowledgedAt = now;
    if (status === "RESOLVED" || status === "DISMISSED") patch.resolvedAt = now;
    const updated = await AiAlertModel.findOneAndUpdate(
      { restaurantId, id: alertId },
      { $set: patch },
      { new: true },
    ).lean();
    return updated ? toDomain<AiAlert>(updated) : null;
  }
}

export const aiAlertService = new AiAlertService();
