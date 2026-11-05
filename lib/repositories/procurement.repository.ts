import { connectToDatabase } from "@/lib/db/mongodb";
import { GoodsReceiptModel, PurchaseOrderModel, SupplierModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import type { GoodsReceipt, PurchaseOrder, Supplier } from "@/types";

export class ProcurementRepository {
  async listSuppliers(restaurantId: string): Promise<Supplier[]> {
    await connectToDatabase();
    const rows = await SupplierModel.find({ restaurantId }).sort({ name: 1 }).lean();
    return rows.map((row) => toDomain<Supplier>(row));
  }

  async createSupplier(data: Omit<Supplier, "createdAt" | "updatedAt">): Promise<Supplier> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await SupplierModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<Supplier>(created.toObject());
  }

  async getSupplier(restaurantId: string, id: string): Promise<Supplier | null> {
    await connectToDatabase();
    const row = await SupplierModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<Supplier>(row) : null;
  }

  async nextPurchaseOrderNumber(restaurantId: string): Promise<number> {
    await connectToDatabase();
    const latest = await PurchaseOrderModel.findOne({ restaurantId })
      .sort({ orderNumber: -1 })
      .lean();
    return Number(latest?.orderNumber ?? 1000) + 1;
  }

  async createPurchaseOrder(
    data: Omit<PurchaseOrder, "createdAt" | "updatedAt">,
  ): Promise<PurchaseOrder> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await PurchaseOrderModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<PurchaseOrder>(created.toObject());
  }

  async listPurchaseOrders(restaurantId: string): Promise<PurchaseOrder[]> {
    await connectToDatabase();
    const rows = await PurchaseOrderModel.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<PurchaseOrder>(row));
  }

  async getPurchaseOrder(restaurantId: string, id: string): Promise<PurchaseOrder | null> {
    await connectToDatabase();
    const row = await PurchaseOrderModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<PurchaseOrder>(row) : null;
  }

  async updatePurchaseOrder(
    restaurantId: string,
    id: string,
    patch: Partial<PurchaseOrder>,
  ): Promise<PurchaseOrder | null> {
    await connectToDatabase();
    const updated = await PurchaseOrderModel.findOneAndUpdate(
      { restaurantId, id },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    ).lean();
    return updated ? toDomain<PurchaseOrder>(updated) : null;
  }

  async createGoodsReceipt(data: GoodsReceipt): Promise<GoodsReceipt> {
    await connectToDatabase();
    try {
      const created = await GoodsReceiptModel.create(data);
      return toDomain<GoodsReceipt>(created.toObject());
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        const existing = await GoodsReceiptModel.findOne({ id: data.id }).lean();
        if (existing) return toDomain<GoodsReceipt>(existing);
      }
      throw error;
    }
  }

  async listGoodsReceipts(restaurantId: string): Promise<GoodsReceipt[]> {
    await connectToDatabase();
    const rows = await GoodsReceiptModel.find({ restaurantId }).sort({ receivedAt: -1 }).lean();
    return rows.map((row) => toDomain<GoodsReceipt>(row));
  }
}

export const procurementRepository = new ProcurementRepository();
