import mongoose, { Schema } from "mongoose";
import type { MenuImportJob } from "@/lib/menu-import/types";

/**
 * Status values are enforced in TypeScript / the menu-import service.
 * Do NOT use a Mongoose enum here — HMR can keep a stale compiled model and
 * reject new statuses like READY_TO_IMPORT (exact production bug we hit).
 */
export const MENU_IMPORT_JOB_STATUSES = [
  "UPLOADED",
  "ANALYZING",
  "AWAITING_MAPPING",
  "VALIDATING",
  "READY_TO_IMPORT",
  "AWAITING_REVIEW",
  "IMPORTING",
  "COMMITTING",
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "PARTIALLY_COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

const importJobSchema = new Schema<MenuImportJob>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    uploadedByEmail: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    status: {
      type: String,
      required: true,
      index: true,
    },
    selectedSheet: String,
    sheets: { type: Schema.Types.Mixed, default: [] },
    grids: { type: Schema.Types.Mixed, default: {} },
    columnMappings: { type: Schema.Types.Mixed, default: [] },
    strategy: {
      type: String,
      enum: ["CREATE_ONLY", "UPDATE_MATCHING", "SMART_MERGE"],
      default: "UPDATE_MATCHING",
    },
    preview: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    rollback: { type: Schema.Types.Mixed },
    errorMessage: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    completedAt: String,
  },
  { strict: true, versionKey: false, collection: "menuImportJobs" },
);

importJobSchema.index({ restaurantId: 1, createdAt: -1 });

function getMenuImportJobModel() {
  const existing = mongoose.models.MenuImportJob as mongoose.Model<MenuImportJob> | undefined;
  if (existing) {
    const statusPath = existing.schema.path("status") as { enumValues?: unknown[] } | undefined;
    // If a stale HMR model still has a status enum, rebuild without it.
    if (statusPath && Array.isArray(statusPath.enumValues) && statusPath.enumValues.length > 0) {
      delete mongoose.models.MenuImportJob;
      delete (mongoose as { modelSchemas?: Record<string, unknown> }).modelSchemas?.MenuImportJob;
      return mongoose.model<MenuImportJob>("MenuImportJob", importJobSchema);
    }
    return existing;
  }
  return mongoose.model<MenuImportJob>("MenuImportJob", importJobSchema);
}

export const MenuImportJobModel = getMenuImportJobModel();
