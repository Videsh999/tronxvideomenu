import { createHash, randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DishModel, MenuSyncJobModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import { withOptionalTransaction } from "@/lib/db/mongo-tx";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import type { MenuSyncDishSnapshot, MenuSyncJob, PaymentAuditActor } from "@/types";

export class MenuSyncServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

const SYNC_PATCH_KEYS = [
  "description",
  "type",
  "isVeg",
  "isCustomizable",
  "image",
  "video",
  "imageUrl",
  "videoUrl",
  "videoPosterUrl",
  "gallery",
  "addonGroupIds",
  "variants",
  "sku",
  "name",
] as const;

function fingerprintDish(payload: Record<string, unknown>): string {
  const relevant: Record<string, unknown> = {};
  for (const key of SYNC_PATCH_KEYS) {
    if (key in payload) relevant[key] = payload[key];
  }
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function snapshotFromDoc(doc: Record<string, unknown>, restaurantId: string): MenuSyncDishSnapshot {
  const { _id, __v, ...payload } = doc;
  void _id;
  void __v;
  return {
    restaurantId,
    dishId: String(payload.id),
    payload,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Central menu sync preserves branch price/availability/sort/kitchenStation by default.
 * Publish captures pre-publish snapshots + fingerprints for safe compensating rollback.
 */
export class MenuSyncService {
  async createJob(input: {
    organizationId: string;
    sourceRestaurantId: string;
    targetRestaurantIds: string[];
    actor: PaymentAuditActor;
    preserveBranchFields?: MenuSyncJob["preserveBranchFields"];
  }) {
    const outlets = await organizationRepository.listOutlets(input.organizationId);
    const ids = new Set(outlets.map((outlet) => outlet.id));
    if (!ids.has(input.sourceRestaurantId)) {
      throw new MenuSyncServiceError("Source outlet is not in this organization.", 403);
    }
    for (const target of input.targetRestaurantIds) {
      if (!ids.has(target)) {
        throw new MenuSyncServiceError("Target outlet is not in this organization.", 403);
      }
      if (target === input.sourceRestaurantId) {
        throw new MenuSyncServiceError("Cannot publish a menu onto its source outlet.");
      }
    }
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await MenuSyncJobModel.create({
      id: `msync-${randomUUID()}`,
      organizationId: input.organizationId,
      sourceRestaurantId: input.sourceRestaurantId,
      targetRestaurantIds: input.targetRestaurantIds,
      status: "DRAFT",
      preserveBranchFields: input.preserveBranchFields ?? [
        "price",
        "isAvailable",
        "sortOrder",
        "kitchenStation",
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor,
    });
    return toDomain<MenuSyncJob>(created.toObject());
  }

  async preview(organizationId: string, jobId: string) {
    await connectToDatabase();
    const job = await MenuSyncJobModel.findOne({ organizationId, id: jobId }).lean();
    if (!job) throw new MenuSyncServiceError("Sync job not found.", 404);
    const sourceDishes = await DishModel.find({ restaurantId: job.sourceRestaurantId }).lean();
    const summary = `Would sync ${sourceDishes.length} dishes to ${job.targetRestaurantIds.length} outlet(s); preserving ${((job.preserveBranchFields as string[]) ?? []).join(", ")}.`;
    const updated = await MenuSyncJobModel.findOneAndUpdate(
      { organizationId, id: jobId },
      { $set: { status: "PREVIEW", snapshotSummary: summary, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return toDomain<MenuSyncJob>(updated!);
  }

  async publish(organizationId: string, jobId: string) {
    await connectToDatabase();
    const jobDoc = await MenuSyncJobModel.findOne({ organizationId, id: jobId }).lean();
    if (!jobDoc) throw new MenuSyncServiceError("Sync job not found.", 404);
    if (jobDoc.status !== "PREVIEW" && jobDoc.status !== "DRAFT") {
      throw new MenuSyncServiceError("Only draft/preview jobs can be published.", 409);
    }

    const preserve = new Set((jobDoc.preserveBranchFields as string[]) ?? []);
    const sourceDishes = await DishModel.find({ restaurantId: jobDoc.sourceRestaurantId }).lean();
    const prePublishSnapshots: MenuSyncDishSnapshot[] = [];
    const publishFingerprints: { restaurantId: string; dishId: string; hash: string }[] = [];

    const { result } = await withOptionalTransaction(async () => {
      for (const targetId of jobDoc.targetRestaurantIds as string[]) {
        for (const source of sourceDishes) {
          const match = await DishModel.findOne({
            restaurantId: targetId,
            $or: [...(source.sku ? [{ sku: source.sku }] : []), { name: source.name }],
          }).lean();
          if (!match) continue;

          prePublishSnapshots.push(snapshotFromDoc(match as Record<string, unknown>, targetId));

          const patch: Record<string, unknown> = {
            description: source.description,
            type: source.type,
            isVeg: source.isVeg,
            isCustomizable: source.isCustomizable,
            image: source.image,
            video: source.video,
            imageUrl: source.imageUrl,
            videoUrl: source.videoUrl,
            videoPosterUrl: source.videoPosterUrl,
            gallery: source.gallery,
            addonGroupIds: source.addonGroupIds,
            variants: source.variants,
            sku: source.sku,
            name: source.name,
            updatedAt: new Date().toISOString(),
          };
          if (!preserve.has("price")) patch.price = source.price;
          if (!preserve.has("isAvailable")) patch.isAvailable = source.isAvailable;
          if (!preserve.has("sortOrder")) patch.sortOrder = source.sortOrder;
          if (!preserve.has("kitchenStation")) patch.kitchenStation = source.kitchenStation;

          await DishModel.updateOne({ restaurantId: targetId, id: match.id }, { $set: patch });
          publishFingerprints.push({
            restaurantId: targetId,
            dishId: String(match.id),
            hash: fingerprintDish({ ...(match as object), ...patch } as Record<string, unknown>),
          });
        }
      }

      const updated = await MenuSyncJobModel.findOneAndUpdate(
        { organizationId, id: jobId, status: { $in: ["DRAFT", "PREVIEW"] } },
        {
          $set: {
            status: "PUBLISHED",
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            snapshotSummary: `Published ${sourceDishes.length} source dishes.`,
            prePublishSnapshots,
            publishFingerprints,
          },
        },
        { new: true },
      ).lean();
      if (!updated) throw new MenuSyncServiceError("Publish raced another update.", 409);
      return toDomain<MenuSyncJob>(updated);
    });

    return result;
  }

  /**
   * Preview rollback conflicts: dishes edited after publish require explicit resolution.
   */
  async previewRollback(organizationId: string, jobId: string) {
    await connectToDatabase();
    const job = await MenuSyncJobModel.findOne({ organizationId, id: jobId }).lean();
    if (!job) throw new MenuSyncServiceError("Sync job not found.", 404);
    if (job.status !== "PUBLISHED") {
      throw new MenuSyncServiceError("Only published jobs can be rolled back.", 409);
    }
    const snapshots = (job.prePublishSnapshots as MenuSyncDishSnapshot[] | undefined) ?? [];
    if (!snapshots.length) {
      throw new MenuSyncServiceError("No pre-publish snapshot is available for rollback.", 409);
    }

    const fingerprints = new Map(
      ((job.publishFingerprints as { restaurantId: string; dishId: string; hash: string }[]) ?? []).map(
        (entry) => [`${entry.restaurantId}:${entry.dishId}`, entry.hash],
      ),
    );

    const conflicts: { restaurantId: string; dishId: string; dishName?: string }[] = [];
    for (const snap of snapshots) {
      const current = await DishModel.findOne({
        restaurantId: snap.restaurantId,
        id: snap.dishId,
      }).lean();
      if (!current) continue;
      const expected = fingerprints.get(`${snap.restaurantId}:${snap.dishId}`);
      const actual = fingerprintDish(current as Record<string, unknown>);
      if (expected && expected !== actual) {
        conflicts.push({
          restaurantId: snap.restaurantId,
          dishId: snap.dishId,
          dishName: String((current as { name?: string }).name ?? ""),
        });
      }
    }

    const summary = conflicts.length
      ? `Rollback would restore ${snapshots.length} dishes; ${conflicts.length} conflict(s) require resolution.`
      : `Rollback would restore ${snapshots.length} dishes with no post-publish conflicts.`;

    const updated = await MenuSyncJobModel.findOneAndUpdate(
      { organizationId, id: jobId },
      { $set: { rollbackPreview: summary, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();

    return {
      job: toDomain<MenuSyncJob>(updated!),
      conflicts,
      snapshotCount: snapshots.length,
    };
  }

  /**
   * Compensating rollback via restoring pre-publish snapshots.
   * Does not rewrite history — marks job ROLLED_BACK.
   * Conflicts must be listed in forceDishIds or forceAllConflicts=true.
   */
  async rollback(
    organizationId: string,
    jobId: string,
    options?: {
      forceDishIds?: string[];
      forceAllConflicts?: boolean;
      actor?: PaymentAuditActor;
    },
  ) {
    const preview = await this.previewRollback(organizationId, jobId);
    const conflictIds = new Set(preview.conflicts.map((c) => `${c.restaurantId}:${c.dishId}`));
    const forced = new Set(options?.forceDishIds ?? []);

    if (conflictIds.size > 0 && !options?.forceAllConflicts) {
      for (const key of conflictIds) {
        const dishId = key.split(":")[1];
        if (!forced.has(dishId) && !forced.has(key)) {
          throw new MenuSyncServiceError(
            `Post-publish edits detected on ${conflictIds.size} dish(es). Preview rollback and pass forceDishIds or forceAllConflicts.`,
            409,
          );
        }
      }
    }

    const snapshots = (preview.job.prePublishSnapshots as MenuSyncDishSnapshot[] | undefined) ?? [];
    const preserve = new Set(preview.job.preserveBranchFields ?? []);

    const { result } = await withOptionalTransaction(async () => {
      for (const snap of snapshots) {
        const current = await DishModel.findOne({
          restaurantId: snap.restaurantId,
          id: snap.dishId,
        }).lean();
        if (!current) continue;

        const restore: Record<string, unknown> = { ...snap.payload, updatedAt: new Date().toISOString() };
        // Always keep current branch-preserved fields if they were preserved at publish —
        // rollback restores synced content, not local price/availability overrides that may have changed.
        for (const field of ["price", "isAvailable", "sortOrder", "kitchenStation"] as const) {
          if (preserve.has(field) && field in (current as object)) {
            restore[field] = (current as Record<string, unknown>)[field];
          }
        }
        delete restore.id;
        delete restore.restaurantId;
        await DishModel.updateOne(
          { restaurantId: snap.restaurantId, id: snap.dishId },
          { $set: restore },
        );
      }

      // Compensating publication record — do not mutate historical publishedAt.
      const updated = await MenuSyncJobModel.findOneAndUpdate(
        { organizationId, id: jobId, status: "PUBLISHED" },
        {
          $set: {
            status: "ROLLED_BACK",
            rolledBackAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            rollbackPreview: `Rolled back ${snapshots.length} dishes (compensating restore).`,
          },
        },
        { new: true },
      ).lean();
      if (!updated) throw new MenuSyncServiceError("Rollback raced another update.", 409);
      return toDomain<MenuSyncJob>(updated);
    });

    return result;
  }

  async list(organizationId: string) {
    await connectToDatabase();
    const rows = await MenuSyncJobModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<MenuSyncJob>(row));
  }
}

export const menuSyncService = new MenuSyncService();
