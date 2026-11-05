import { randomUUID } from "node:crypto";
import { procurementRepository } from "@/lib/repositories/procurement.repository";
import { inventoryRepository } from "@/lib/repositories/inventory.repository";
import { convertToBase, roundQty } from "@/lib/inventory/units";
import type {
  InventoryUnit,
  PaymentAuditActor,
  PurchaseOrderLine,
} from "@/types";

export class ProcurementServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

export class ProcurementService {
  listSuppliers(restaurantId: string) {
    return procurementRepository.listSuppliers(restaurantId);
  }

  createSupplier(
    restaurantId: string,
    input: {
      name: string;
      contactName?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      organizationId?: string;
    },
  ) {
    return procurementRepository.createSupplier({
      id: `sup-${randomUUID()}`,
      restaurantId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      contactName: input.contactName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      isActive: true,
    });
  }

  listPurchaseOrders(restaurantId: string) {
    return procurementRepository.listPurchaseOrders(restaurantId);
  }

  async createPurchaseOrder(
    restaurantId: string,
    input: {
      supplierId: string;
      lines: {
        ingredientId: string;
        quantity: number;
        unit: InventoryUnit;
        unitCost: number;
      }[];
      expectedAt?: string;
      notes?: string;
    },
  ) {
    const supplier = await procurementRepository.getSupplier(restaurantId, input.supplierId);
    if (!supplier || !supplier.isActive) {
      throw new ProcurementServiceError("Supplier not found.", 404);
    }
    const lines: PurchaseOrderLine[] = [];
    for (const line of input.lines) {
      const ingredient = await inventoryRepository.getIngredient(restaurantId, line.ingredientId);
      if (!ingredient) throw new ProcurementServiceError(`Ingredient ${line.ingredientId} not found.`);
      lines.push({
        ingredientId: line.ingredientId,
        nameSnapshot: ingredient.name,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
        receivedQuantity: 0,
      });
    }
    const orderNumber = await procurementRepository.nextPurchaseOrderNumber(restaurantId);
    return procurementRepository.createPurchaseOrder({
      id: `po-${randomUUID()}`,
      restaurantId,
      supplierId: input.supplierId,
      status: "SENT",
      orderNumber,
      lines,
      expectedAt: input.expectedAt,
      notes: input.notes,
    });
  }

  async receivePurchaseOrder(
    restaurantId: string,
    purchaseOrderId: string,
    input: {
      lines: { ingredientId: string; quantity: number; unit: InventoryUnit; unitCost: number }[];
      invoiceNumber?: string;
      notes?: string;
      actor: PaymentAuditActor;
      receiptIdempotencyKey?: string;
    },
  ) {
    const po = await procurementRepository.getPurchaseOrder(restaurantId, purchaseOrderId);
    if (!po) throw new ProcurementServiceError("Purchase order not found.", 404);
    if (po.status === "CANCELLED" || po.status === "RECEIVED") {
      throw new ProcurementServiceError("Purchase order cannot receive stock in its current status.", 409);
    }

    const receiptId = `gr-${input.receiptIdempotencyKey ?? randomUUID()}`;
    const { withOptionalTransaction } = await import("@/lib/db/mongo-tx");

    const allowOverReceive = false;
    for (const line of input.lines) {
      const poLine = po.lines.find((entry) => entry.ingredientId === line.ingredientId);
      if (!poLine) {
        throw new ProcurementServiceError(`Ingredient ${line.ingredientId} is not on this purchase order.`);
      }
      const nextQty = roundQty(poLine.receivedQuantity + line.quantity);
      if (!allowOverReceive && nextQty > poLine.quantity + 1e-9) {
        throw new ProcurementServiceError(
          `Cannot receive more than ordered for ${poLine.nameSnapshot} (ordered ${poLine.quantity}, already ${poLine.receivedQuantity}).`,
          409,
        );
      }
    }

    const { result } = await withOptionalTransaction(async () => {
      for (const line of input.lines) {
        const ingredient = await inventoryRepository.getIngredient(restaurantId, line.ingredientId);
        if (!ingredient) throw new ProcurementServiceError(`Ingredient ${line.ingredientId} not found.`);
        const baseQty = convertToBase(
          line.quantity,
          line.unit,
          ingredient.baseUnit,
          ingredient.conversions,
        );
        await inventoryRepository.applyMovement({
          restaurantId,
          ingredientId: line.ingredientId,
          kind: "PURCHASE_RECEIPT",
          quantityDelta: roundQty(baseQty),
          unitCost: line.unitCost,
          referenceType: "PURCHASE_ORDER",
          referenceId: po.id,
          idempotencyKey: `recv:${receiptId}:${line.ingredientId}`,
          note: input.invoiceNumber ? `Invoice ${input.invoiceNumber}` : `PO #${po.orderNumber}`,
          actor: input.actor,
        });
      }

      const updatedLines = po.lines.map((poLine) => {
        const received = input.lines.find((line) => line.ingredientId === poLine.ingredientId);
        if (!received) return poLine;
        return {
          ...poLine,
          receivedQuantity: roundQty(poLine.receivedQuantity + received.quantity),
          unitCost: received.unitCost,
        };
      });

      const fullyReceived = updatedLines.every((line) => line.receivedQuantity >= line.quantity);
      const partially = updatedLines.some((line) => line.receivedQuantity > 0);

      const updated = await procurementRepository.updatePurchaseOrder(restaurantId, po.id, {
        lines: updatedLines,
        status: fullyReceived ? "RECEIVED" : partially ? "PARTIAL" : po.status,
        receivedAt: fullyReceived ? new Date().toISOString() : po.receivedAt,
      });

      const receipt = await procurementRepository.createGoodsReceipt({
        id: receiptId,
        restaurantId,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        lines: input.lines,
        receivedAt: new Date().toISOString(),
        receivedBy: input.actor,
        invoiceNumber: input.invoiceNumber,
        notes: input.notes,
      });

      return { purchaseOrder: updated, receipt };
    });

    return result;
  }

  async reorderSuggestions(restaurantId: string) {
    const low = await inventoryRepository.lowStock(restaurantId);
    return low.map((ingredient) => ({
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantityOnHand: ingredient.quantityOnHand,
      reorderLevel: ingredient.reorderLevel,
      suggestedOrderQuantity: ingredient.reorderQuantity ?? ingredient.reorderLevel ?? 0,
      lastPurchaseUnitCost: ingredient.lastPurchaseUnitCost,
      averageUnitCost: ingredient.averageUnitCost,
    }));
  }

  outstandingPurchaseOrders(restaurantId: string) {
    return procurementRepository.listPurchaseOrders(restaurantId).then((rows) =>
      rows.filter((row) => row.status === "SENT" || row.status === "PARTIAL"),
    );
  }
}

export const procurementService = new ProcurementService();
