import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import { BillingAuditModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export type BillingAuditEvent = {
  id: string;
  restaurantId: string;
  action: "SETTINGS_SAVE" | "BULK_TAX_APPLY";
  previous?: unknown;
  next?: unknown;
  meta?: Record<string, unknown>;
  actor: { id: string; email?: string; role: string };
  createdAt: string;
};

export class BillingAuditRepository {
  async append(input: Omit<BillingAuditEvent, "id" | "createdAt">) {
    await connectToDatabase();
    const created = await BillingAuditModel.create({
      ...input,
      id: `baudit-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    });
    return toDomain<BillingAuditEvent>(created.toObject());
  }

  async list(restaurantId: string, limit = 20) {
    await connectToDatabase();
    const rows = await BillingAuditModel.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((row) => toDomain<BillingAuditEvent>(row));
  }
}

export const billingAuditRepository = new BillingAuditRepository();
