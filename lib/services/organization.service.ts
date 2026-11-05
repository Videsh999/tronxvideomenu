import { randomUUID } from "node:crypto";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import { inventoryRepository } from "@/lib/repositories/inventory.repository";
import { convertToBase, roundQty } from "@/lib/inventory/units";
import type { InventoryUnit, PaymentAuditActor } from "@/types";

export class OrganizationServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

export class OrganizationService {
  async createOrganization(name: string, slug: string) {
    const existing = await organizationRepository.findBySlug(slug);
    if (existing) throw new OrganizationServiceError("Organization slug already exists.", 409);
    return organizationRepository.create({
      id: `org-${randomUUID()}`,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      isActive: true,
    });
  }

  getOrganization(id: string) {
    return organizationRepository.findById(id);
  }

  listOutlets(organizationId: string) {
    return organizationRepository.listOutlets(organizationId);
  }

  attachOutlet(restaurantId: string, organizationId: string) {
    return organizationRepository.attachOutlet(restaurantId, organizationId);
  }

  async createStockTransfer(input: {
    organizationId: string;
    fromRestaurantId: string;
    toRestaurantId: string;
    lines: { ingredientId: string; quantity: number; unit: InventoryUnit }[];
  }) {
    if (input.fromRestaurantId === input.toRestaurantId) {
      throw new OrganizationServiceError("Cannot transfer stock to the same outlet.");
    }
    const same = await organizationRepository.assertSameOrganization(
      input.fromRestaurantId,
      input.toRestaurantId,
    );
    if (!same) {
      throw new OrganizationServiceError(
        "Outlets must belong to the same organization.",
        403,
      );
    }
    return organizationRepository.createTransfer({
      id: `xfer-${randomUUID()}`,
      organizationId: input.organizationId,
      fromRestaurantId: input.fromRestaurantId,
      toRestaurantId: input.toRestaurantId,
      status: "DRAFT",
      lines: input.lines,
    });
  }

  async sendTransfer(organizationId: string, transferId: string, actor?: PaymentAuditActor) {
    const transfer = await organizationRepository.getTransfer(organizationId, transferId);
    if (!transfer || transfer.status !== "DRAFT") {
      throw new OrganizationServiceError("Transfer not available to send.", 409);
    }
    const { withOptionalTransaction } = await import("@/lib/db/mongo-tx");
    const { result } = await withOptionalTransaction(async () => {
      for (const line of transfer.lines) {
        const ingredient = await inventoryRepository.getIngredient(
          transfer.fromRestaurantId,
          line.ingredientId,
        );
        if (!ingredient) {
          throw new OrganizationServiceError(
            `Ingredient missing at source outlet: ${line.ingredientId}`,
          );
        }
        const base = convertToBase(
          line.quantity,
          line.unit,
          ingredient.baseUnit,
          ingredient.conversions,
        );
        await inventoryRepository.applyMovement({
          restaurantId: transfer.fromRestaurantId,
          ingredientId: line.ingredientId,
          kind: "TRANSFER_OUT",
          quantityDelta: -roundQty(base),
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          idempotencyKey: `xfer-out:${transfer.id}:${line.ingredientId}`,
          actor,
          note: `Transfer to ${transfer.toRestaurantId}`,
        });
      }
      const claimed = await organizationRepository.updateTransfer(
        organizationId,
        transferId,
        { status: "SENT" },
        "DRAFT",
      );
      if (!claimed) {
        throw new OrganizationServiceError("Transfer send raced another request.", 409);
      }
      return claimed;
    });
    return result;
  }

  async receiveTransfer(organizationId: string, transferId: string, actor?: PaymentAuditActor) {
    const transfer = await organizationRepository.getTransfer(organizationId, transferId);
    if (!transfer || transfer.status !== "SENT") {
      throw new OrganizationServiceError("Transfer not available to receive.", 409);
    }
    const { withOptionalTransaction } = await import("@/lib/db/mongo-tx");
    const { result } = await withOptionalTransaction(async () => {
      for (const line of transfer.lines) {
        const ingredient = await inventoryRepository.getIngredient(
          transfer.toRestaurantId,
          line.ingredientId,
        );
        if (!ingredient) {
          throw new OrganizationServiceError(
            `Ingredient ${line.ingredientId} must exist at the destination outlet before receiving.`,
            409,
          );
        }
        const base = convertToBase(
          line.quantity,
          line.unit,
          ingredient.baseUnit,
          ingredient.conversions,
        );
        await inventoryRepository.applyMovement({
          restaurantId: transfer.toRestaurantId,
          ingredientId: line.ingredientId,
          kind: "TRANSFER_IN",
          quantityDelta: roundQty(base),
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          idempotencyKey: `xfer-in:${transfer.id}:${line.ingredientId}`,
          actor,
          note: `Transfer from ${transfer.fromRestaurantId}`,
        });
      }
      const updated = await organizationRepository.updateTransfer(
        organizationId,
        transferId,
        {
          status: "RECEIVED",
          receivedAt: new Date().toISOString(),
        },
        "SENT",
      );
      if (!updated) {
        throw new OrganizationServiceError("Transfer receive raced another request.", 409);
      }
      return updated;
    });
    return result;
  }

  listTransfers(organizationId: string) {
    return organizationRepository.listTransfers(organizationId);
  }
}

export const organizationService = new OrganizationService();
