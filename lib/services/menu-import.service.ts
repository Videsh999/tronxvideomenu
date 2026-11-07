import { importJobRepository } from "@/lib/repositories/import-job.repository";
import { dishRepository } from "@/lib/repositories/dish.repository";
import { categoryRepository } from "@/lib/repositories/category.repository";
import { assertSafeUpload, parseWorkbookBuffer } from "@/lib/menu-import/parse-workbook";
import { mappingNeedsConfirmation, suggestColumnMappings } from "@/lib/menu-import/map-columns";
import { buildItemDraftsFromGrid } from "@/lib/menu-import/infer-rows";
import { applyExistingMatches } from "@/lib/menu-import/match-existing";
import { commitImportPreview, rollbackImport } from "@/lib/menu-import/commit-import";
import { normalizeImportItemDraft } from "@/lib/menu-import/item-schema";
import { validateImportItemDraft } from "@/lib/menu-import/validate-draft";
import type {
  ColumnMapping,
  ImportJobStatus,
  ImportPreview,
  ImportStrategy,
  MenuImportJob,
} from "@/lib/menu-import/types";

function publicJob(job: MenuImportJob): Omit<MenuImportJob, "grids"> {
  const { grids: _grids, ...rest } = job;
  return rest;
}

function resolveCommitStatus(params: {
  result: NonNullable<MenuImportJob["result"]>;
  preview: ImportPreview;
}): ImportJobStatus {
  const intended = params.preview.items.filter((item) => item.included && item.errors.length === 0).length;
  const processed =
    (params.result.createdDishes ?? 0) +
    (params.result.updatedDishes ?? 0);
  const failed = params.result.failedRows ?? 0;
  const hasWarnings = (params.result.warningCount ?? 0) > 0 || (params.result.errors?.length ?? 0) > 0;
  const hasInvalid = (params.result.invalidRows ?? 0) > 0;

  if (intended > 0 && processed === 0 && failed > 0) return "FAILED";
  if (processed > 0 && (failed > 0 || processed < intended)) return "PARTIALLY_COMPLETED";
  if (hasWarnings || hasInvalid) return "COMPLETED_WITH_WARNINGS";
  return "COMPLETED";
}

export class MenuImportService {
  async upload(input: {
    restaurantId: string;
    email: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    assertSafeUpload(input.fileName, input.mimeType, input.buffer.byteLength);
    const parsed = await parseWorkbookBuffer(input.buffer);
    const selectedSheet = parsed.sheets[0]?.name;
    const headers = parsed.sheets[0]?.headers ?? [];
    const columnMappings = suggestColumnMappings(headers);

    const job = await importJobRepository.create({
      restaurantId: input.restaurantId,
      uploadedByEmail: input.email,
      fileName: input.fileName,
      fileSize: input.buffer.byteLength,
      mimeType: input.mimeType || "application/octet-stream",
      status: mappingNeedsConfirmation(columnMappings) ? "AWAITING_MAPPING" : "READY_TO_IMPORT",
      selectedSheet,
      sheets: parsed.sheets,
      grids: parsed.grids,
      columnMappings,
      strategy: "UPDATE_MATCHING",
    });

    if (
      (job.status === "READY_TO_IMPORT" || job.status === "AWAITING_REVIEW") &&
      selectedSheet
    ) {
      const preview = await this.buildPreview(job, selectedSheet, columnMappings, "UPDATE_MATCHING");
      const updated = await importJobRepository.update(job.id, input.restaurantId, {
        preview,
        status: "READY_TO_IMPORT",
      });
      return publicJob(updated ?? job);
    }

    return publicJob(job);
  }

  async list(restaurantId: string) {
    return importJobRepository.listForRestaurant(restaurantId);
  }

  async get(restaurantId: string, jobId: string) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job) return null;
    return publicJob(job);
  }

  async selectSheet(restaurantId: string, jobId: string, sheetName: string) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job) throw new Error("Import job not found.");
    if (
      job.status === "COMPLETED" ||
      job.status === "COMPLETED_WITH_WARNINGS" ||
      job.status === "PARTIALLY_COMPLETED" ||
      job.status === "COMMITTING" ||
      job.status === "IMPORTING"
    ) {
      throw new Error("This import can no longer be changed.");
    }
    if (!job.grids[sheetName]) throw new Error("Sheet not found in uploaded file.");
    const headers = job.sheets.find((sheet) => sheet.name === sheetName)?.headers ?? job.grids[sheetName][0] ?? [];
    const columnMappings = suggestColumnMappings(headers);
    await importJobRepository.update(jobId, restaurantId, { status: "VALIDATING" });
    const preview = await this.buildPreview(job, sheetName, columnMappings, job.strategy);
    const updated = await importJobRepository.update(jobId, restaurantId, {
      selectedSheet: sheetName,
      columnMappings,
      preview,
      status: mappingNeedsConfirmation(columnMappings) ? "AWAITING_MAPPING" : "READY_TO_IMPORT",
    });
    return publicJob(updated!);
  }

  async updateMapping(
    restaurantId: string,
    jobId: string,
    columnMappings: ColumnMapping[],
    strategy: ImportStrategy,
  ) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job) throw new Error("Import job not found.");
    if (!job.selectedSheet) throw new Error("Select a sheet first.");
    await importJobRepository.update(jobId, restaurantId, { status: "VALIDATING" });
    const preview = await this.buildPreview(job, job.selectedSheet, columnMappings, strategy);
    const updated = await importJobRepository.update(jobId, restaurantId, {
      columnMappings,
      strategy,
      preview,
      status: "READY_TO_IMPORT",
    });
    return publicJob(updated!);
  }

  async updatePreviewItems(restaurantId: string, jobId: string, items: ImportPreview["items"]) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job?.preview) throw new Error("Import preview is not ready.");

    const normalized = items.map((item) => validateImportItemDraft(normalizeImportItemDraft(item)));
    const preview = applyExistingMatches(
      normalized,
      await dishRepository.findByRestaurantId(restaurantId),
      await categoryRepository.findByRestaurantId(restaurantId),
      job.strategy,
    );
    // Preserve admin include/action edits from payload after rematch baselines.
    const byKey = new Map(normalized.map((item) => [item.rowKey, item]));
    preview.items = preview.items.map((item) => {
      const edited = byKey.get(item.rowKey);
      if (!edited) return item;
      const merged = validateImportItemDraft({
        ...item,
        included: edited.included,
        action: edited.action,
        name: edited.name || item.name,
        categoryName: edited.categoryName || item.categoryName,
        description: edited.description,
        price: edited.price,
        dietary: edited.dietary,
        sku: edited.sku,
        isAvailable: edited.isAvailable,
      });
      // Keep strategy-driven SKIP unless admin explicitly re-included.
      if (item.action === "SKIP" && !edited.included) {
        return { ...merged, action: "SKIP", included: false };
      }
      return merged;
    });
    preview.summary.createCount = preview.items.filter((item) => item.action === "CREATE" && item.included).length;
    preview.summary.updateCount = preview.items.filter((item) => item.action === "UPDATE" && item.included).length;
    preview.summary.skipCount = preview.items.filter((item) => !item.included).length;
    preview.summary.validItems = preview.items.filter((item) => item.errors.length === 0).length;
    preview.summary.invalidItems = preview.items.length - preview.summary.validItems;
    preview.summary.warningCount = preview.items.reduce((sum, item) => sum + item.warnings.length, 0);

    const updated = await importJobRepository.update(jobId, restaurantId, {
      preview,
      status: "READY_TO_IMPORT",
    });
    return publicJob(updated!);
  }

  async commit(restaurantId: string, jobId: string) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job?.preview) throw new Error("Import preview is not ready.");
    if (
      job.status === "COMPLETED" ||
      job.status === "COMPLETED_WITH_WARNINGS" ||
      job.status === "PARTIALLY_COMPLETED"
    ) {
      throw new Error("This import was already completed.");
    }
    if (job.status === "CANCELLED") throw new Error("This import was cancelled.");

    const blocking = job.preview.items.filter((item) => item.included && item.errors.length > 0);
    if (blocking.length > 0) {
      throw new Error(
        `Cannot import: ${blocking.length} included row${blocking.length === 1 ? "" : "s"} still have blocking errors. Fix or uncheck them first.`,
      );
    }

    const intended = job.preview.items.filter((item) => item.included && item.errors.length === 0);
    if (intended.length === 0) {
      throw new Error("No valid rows are selected for import.");
    }

    await importJobRepository.update(jobId, restaurantId, { status: "IMPORTING" });
    try {
      const { result, rollback } = await commitImportPreview(job, job.preview);
      const status = resolveCommitStatus({ result, preview: job.preview });
      const updated = await importJobRepository.update(jobId, restaurantId, {
        status,
        result,
        rollback,
        completedAt: new Date().toISOString(),
        // Drop raw grids after success to reduce retained spreadsheet data.
        grids: {},
      });
      return publicJob(updated!);
    } catch (error) {
      await importJobRepository.update(jobId, restaurantId, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Import failed.",
      });
      throw error;
    }
  }

  async cancel(restaurantId: string, jobId: string) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job) throw new Error("Import job not found.");
    if (job.status === "COMMITTING" || job.status === "IMPORTING") {
      throw new Error("A completed or in-progress commit cannot be cancelled.");
    }
    if (
      job.status === "COMPLETED" ||
      job.status === "COMPLETED_WITH_WARNINGS" ||
      job.status === "PARTIALLY_COMPLETED"
    ) {
      throw new Error("A completed import cannot be cancelled — use rollback instead.");
    }
    const updated = await importJobRepository.update(jobId, restaurantId, {
      status: "CANCELLED",
      grids: {},
      completedAt: new Date().toISOString(),
    });
    return publicJob(updated!);
  }

  async rollback(restaurantId: string, jobId: string) {
    const job = await importJobRepository.findByIdForRestaurant(jobId, restaurantId);
    if (!job?.rollback) throw new Error("No rollback data is available for this import.");
    await rollbackImport(job.rollback);
    const updated = await importJobRepository.update(jobId, restaurantId, {
      status: "CANCELLED",
      errorMessage: "Import rolled back by administrator.",
      rollback: undefined,
      completedAt: new Date().toISOString(),
    });
    return publicJob(updated!);
  }

  private async buildPreview(
    job: MenuImportJob,
    sheetName: string,
    mappings: ColumnMapping[],
    strategy: ImportStrategy,
  ): Promise<ImportPreview> {
    const grid = job.grids[sheetName];
    if (!grid) throw new Error("Sheet data missing.");
    const drafts = buildItemDraftsFromGrid(grid, mappings);
    const dishes = await dishRepository.findByRestaurantId(job.restaurantId);
    const categories = await categoryRepository.findByRestaurantId(job.restaurantId);
    return applyExistingMatches(drafts, dishes, categories, strategy);
  }
}

export const menuImportService = new MenuImportService();
