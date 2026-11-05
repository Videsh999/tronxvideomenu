import { connectToDatabase } from "@/lib/db/mongodb";
import { OrganizationModel, RestaurantModel, StockTransferModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import type { Organization, Restaurant, StockTransfer } from "@/types";

export class OrganizationRepository {
  async create(data: Omit<Organization, "createdAt" | "updatedAt">): Promise<Organization> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await OrganizationModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<Organization>(created.toObject());
  }

  async findById(id: string): Promise<Organization | null> {
    await connectToDatabase();
    const row = await OrganizationModel.findOne({ id }).lean();
    return row ? toDomain<Organization>(row) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    await connectToDatabase();
    const row = await OrganizationModel.findOne({ slug }).lean();
    return row ? toDomain<Organization>(row) : null;
  }

  async listOutlets(organizationId: string): Promise<Restaurant[]> {
    await connectToDatabase();
    const rows = await RestaurantModel.find({ organizationId }).sort({ name: 1 }).lean();
    return rows.map((row) => toDomain<Restaurant>(row));
  }

  async attachOutlet(restaurantId: string, organizationId: string): Promise<Restaurant | null> {
    await connectToDatabase();
    const updated = await RestaurantModel.findOneAndUpdate(
      { id: restaurantId },
      { $set: { organizationId, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<Restaurant>(updated) : null;
  }

  async assertSameOrganization(a: string, b: string): Promise<boolean> {
    await connectToDatabase();
    const outlets = await RestaurantModel.find({ id: { $in: [a, b] } })
      .select({ id: 1, organizationId: 1 })
      .lean();
    if (outlets.length !== 2) return false;
    const orgA = outlets[0]?.organizationId;
    const orgB = outlets[1]?.organizationId;
    return Boolean(orgA && orgB && orgA === orgB);
  }

  async createTransfer(
    data: Omit<StockTransfer, "createdAt" | "updatedAt">,
  ): Promise<StockTransfer> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await StockTransferModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<StockTransfer>(created.toObject());
  }

  async updateTransfer(
    organizationId: string,
    id: string,
    patch: Partial<StockTransfer>,
    expectedStatus?: StockTransfer["status"],
  ): Promise<StockTransfer | null> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { organizationId, id };
    if (expectedStatus) filter.status = expectedStatus;
    const updated = await StockTransferModel.findOneAndUpdate(
      filter,
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<StockTransfer>(updated) : null;
  }

  async getTransfer(organizationId: string, id: string): Promise<StockTransfer | null> {
    await connectToDatabase();
    const row = await StockTransferModel.findOne({ organizationId, id }).lean();
    return row ? toDomain<StockTransfer>(row) : null;
  }

  async listTransfers(organizationId: string): Promise<StockTransfer[]> {
    await connectToDatabase();
    const rows = await StockTransferModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<StockTransfer>(row));
  }
}

export const organizationRepository = new OrganizationRepository();
