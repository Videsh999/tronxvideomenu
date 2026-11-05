import { connectToDatabase } from "@/lib/db/mongodb";
import { MENU_IMPORT_JOB_STATUSES, MenuImportJobModel } from "@/lib/db/import-job-model";
import type { ImportJobStatus, MenuImportJob } from "@/lib/menu-import/types";
import { toDomain } from "@/lib/db/mongo-mappers";

function assertImportStatus(status: string): asserts status is ImportJobStatus {
  if (!(MENU_IMPORT_JOB_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid import job status: ${status}`);
  }
}

export class ImportJobRepository {
  async create(data: Omit<MenuImportJob, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<MenuImportJob> {
    await connectToDatabase();
    assertImportStatus(data.status);
    const now = new Date().toISOString();
    const id = data.id ?? `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc = { ...data, id, createdAt: now, updatedAt: now };
    const created = await MenuImportJobModel.create(doc);
    return toDomain<MenuImportJob>(created.toObject());
  }

  async findByIdForRestaurant(id: string, restaurantId: string): Promise<MenuImportJob | null> {
    await connectToDatabase();
    const job = await MenuImportJobModel.findOne({ id, restaurantId }).lean();
    return job ? toDomain<MenuImportJob>(job) : null;
  }

  async listForRestaurant(restaurantId: string, limit = 30): Promise<MenuImportJob[]> {
    await connectToDatabase();
    const jobs = await MenuImportJobModel.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-grids")
      .lean();
    return jobs.map((job) => toDomain<MenuImportJob>(job));
  }

  async update(id: string, restaurantId: string, patch: Partial<MenuImportJob>): Promise<MenuImportJob | null> {
    await connectToDatabase();
    if (patch.status) assertImportStatus(patch.status);
    const updated = await MenuImportJobModel.findOneAndUpdate(
      { id, restaurantId },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<MenuImportJob>(updated) : null;
  }
}

export const importJobRepository = new ImportJobRepository();
