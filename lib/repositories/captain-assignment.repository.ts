import { randomUUID } from "node:crypto";
import type { CaptainTableAssignmentEvent } from "@/types";
import { CaptainTableAssignmentEventModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";

export class CaptainAssignmentRepository {
  async append(event: Omit<CaptainTableAssignmentEvent, "id" | "createdAt">) {
    await connectToDatabase();
    const createdAt = new Date().toISOString();
    const doc = await CaptainTableAssignmentEventModel.create({
      ...event,
      id: `cta-${randomUUID()}`,
      createdAt,
    });
    return toDomain<CaptainTableAssignmentEvent>(doc.toObject());
  }

  async listForRestaurant(restaurantId: string, limit = 50) {
    await connectToDatabase();
    const rows = await CaptainTableAssignmentEventModel.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((row) => toDomain<CaptainTableAssignmentEvent>(row));
  }
}

export const captainAssignmentRepository = new CaptainAssignmentRepository();
