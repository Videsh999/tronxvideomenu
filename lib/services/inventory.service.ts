import { randomUUID } from "node:crypto";
import { inventoryRepository } from "@/lib/repositories/inventory.repository";
import { convertToBase, roundQty } from "@/lib/inventory/units";
import { costRecipeLines, estimateDishMargin, scaleRecipeForPortions } from "@/lib/inventory/recipe-cost";
import {
  canAutoRestoreFromPriorStatus,
  consumeIdempotencyKey,
  consumptionPointReached,
  restoreIdempotencyKey,
} from "@/lib/inventory/consumption";
import type {
  Ingredient,
  InventoryUnit,
  PaymentAuditActor,
  Recipe,
  Restaurant,
  RestaurantOrder,
} from "@/types";

export class InventoryServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

export class InventoryService {
  listIngredients(restaurantId: string) {
    return inventoryRepository.listIngredients(restaurantId);
  }

  listRecipes(restaurantId: string) {
    return inventoryRepository.listRecipes(restaurantId);
  }

  listMovements(restaurantId: string) {
    return inventoryRepository.listMovements(restaurantId);
  }

  lowStock(restaurantId: string) {
    return inventoryRepository.lowStock(restaurantId);
  }

  async createIngredient(
    restaurantId: string,
    input: {
      name: string;
      baseUnit: InventoryUnit;
      sku?: string;
      conversions?: Partial<Record<InventoryUnit, number>>;
      quantityOnHand?: number;
      reorderLevel?: number;
      reorderQuantity?: number;
      averageUnitCost?: number;
      expiryDate?: string;
      organizationId?: string;
    },
  ) {
    return inventoryRepository.createIngredient({
      id: `ing-${randomUUID()}`,
      restaurantId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      sku: input.sku,
      baseUnit: input.baseUnit,
      conversions: input.conversions ?? {},
      quantityOnHand: input.quantityOnHand ?? 0,
      reorderLevel: input.reorderLevel,
      reorderQuantity: input.reorderQuantity,
      averageUnitCost: input.averageUnitCost,
      expiryDate: input.expiryDate,
      isActive: true,
    });
  }

  async updateIngredient(
    restaurantId: string,
    ingredientId: string,
    input: {
      name?: string;
      sku?: string | null;
      baseUnit?: InventoryUnit;
      conversions?: Partial<Record<InventoryUnit, number>>;
      reorderLevel?: number | null;
      reorderQuantity?: number | null;
      averageUnitCost?: number | null;
      expiryDate?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await inventoryRepository.getIngredient(restaurantId, ingredientId);
    if (!existing) throw new InventoryServiceError("Ingredient not found.", 404);

    const patch: Partial<Ingredient> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.baseUnit !== undefined) patch.baseUnit = input.baseUnit;
    if (input.conversions !== undefined) patch.conversions = input.conversions;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.sku !== undefined) patch.sku = input.sku?.trim() ? input.sku.trim() : undefined;
    if (input.reorderLevel !== undefined) {
      patch.reorderLevel = input.reorderLevel === null ? undefined : input.reorderLevel;
    }
    if (input.reorderQuantity !== undefined) {
      patch.reorderQuantity = input.reorderQuantity === null ? undefined : input.reorderQuantity;
    }
    if (input.averageUnitCost !== undefined) {
      patch.averageUnitCost = input.averageUnitCost === null ? undefined : input.averageUnitCost;
    }
    if (input.expiryDate !== undefined) {
      patch.expiryDate = input.expiryDate?.trim() ? input.expiryDate.trim() : undefined;
    }

    const updated = await inventoryRepository.updateIngredient(restaurantId, ingredientId, patch);
    if (!updated) throw new InventoryServiceError("Ingredient not found.", 404);
    return updated;
  }

  async deactivateIngredient(restaurantId: string, ingredientId: string) {
    return this.updateIngredient(restaurantId, ingredientId, { isActive: false });
  }

  async upsertRecipe(
    restaurantId: string,
    input: {
      dishId: string;
      name: string;
      yieldPortions: number;
      lines: { ingredientId: string; quantity: number; unit: InventoryUnit }[];
    },
  ) {
    const ingredients = await inventoryRepository.listIngredients(restaurantId);
    const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    for (const line of input.lines) {
      if (!byId.has(line.ingredientId)) {
        throw new InventoryServiceError(`Unknown ingredient ${line.ingredientId}.`);
      }
    }
    const cost = costRecipeLines(input.lines, byId, input.yieldPortions);
    return inventoryRepository.upsertRecipe({
      id: `recipe-${randomUUID()}`,
      restaurantId,
      dishId: input.dishId,
      name: input.name.trim(),
      yieldPortions: input.yieldPortions,
      lines: input.lines,
      estimatedCostPerPortion: cost.costPerPortion,
      isActive: true,
    });
  }

  async dishProfitability(restaurantId: string, dishId: string, sellPrice: number) {
    const recipe = await inventoryRepository.getRecipeByDish(restaurantId, dishId);
    if (!recipe) throw new InventoryServiceError("No recipe configured for this dish.", 404);
    const ingredients = await inventoryRepository.listIngredients(restaurantId);
    const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const cost = costRecipeLines(recipe.lines, byId, recipe.yieldPortions);
    return {
      recipe,
      cost,
      margin: estimateDishMargin({
        sellPrice,
        recipeCostPerPortion: cost.costPerPortion,
      }),
    };
  }

  async adjustStock(
    restaurantId: string,
    input: {
      ingredientId: string;
      quantityDelta: number;
      kind: "ADJUSTMENT" | "WASTAGE" | "RECONCILIATION";
      note?: string;
      actor?: PaymentAuditActor;
      idempotencyKey?: string;
    },
  ) {
    if (input.kind === "WASTAGE" && input.quantityDelta > 0) {
      throw new InventoryServiceError("Wastage must reduce stock (negative delta).");
    }
    return inventoryRepository.applyMovement({
      restaurantId,
      ingredientId: input.ingredientId,
      kind: input.kind,
      quantityDelta: input.quantityDelta,
      idempotencyKey: input.idempotencyKey ?? `adj-${randomUUID()}`,
      note: input.note,
      actor: input.actor,
      referenceType: "MANUAL",
    });
  }

  async reconcileToCounted(
    restaurantId: string,
    ingredientId: string,
    countedQuantityBase: number,
    actor?: PaymentAuditActor,
  ) {
    const ingredient = await inventoryRepository.getIngredient(restaurantId, ingredientId);
    if (!ingredient) throw new InventoryServiceError("Ingredient not found.", 404);
    const delta = roundQty(countedQuantityBase - ingredient.quantityOnHand);
    if (delta === 0) return { ingredient, movement: null };
    const movement = await inventoryRepository.applyMovement({
      restaurantId,
      ingredientId,
      kind: "RECONCILIATION",
      quantityDelta: delta,
      idempotencyKey: `recon-${ingredientId}-${Date.now()}`,
      note: `Physical count ${countedQuantityBase}`,
      actor,
      referenceType: "RECONCILIATION",
    });
    const updated = await inventoryRepository.getIngredient(restaurantId, ingredientId);
    return { ingredient: updated, movement };
  }

  /**
   * Idempotent recipe consumption when an order hits the configured consumption point.
   */
  async consumeForOrder(restaurant: Restaurant, order: RestaurantOrder) {
    if (!consumptionPointReached(order.status, restaurant.inventorySettings)) {
      return { skipped: true as const, reason: "Consumption point not reached." };
    }

    const key = consumeIdempotencyKey(order.id);
    const existing = await inventoryRepository.findConsumptionByKey(restaurant.id, key);
    if (existing) return { skipped: true as const, reason: "Already consumed.", record: existing };

    const ingredients = await inventoryRepository.listIngredients(restaurant.id);
    const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const enforceStock = restaurant.inventorySettings?.enforceStock === true;
    const lines: InventoryConsumptionRecordLines = [];

    for (const item of order.items) {
      const recipe = await inventoryRepository.getRecipeByDish(restaurant.id, item.dishId);
      if (!recipe) continue;
      const scaled = scaleRecipeForPortions(recipe, item.quantity);
      for (const line of scaled) {
        const ingredient = byId.get(line.ingredientId);
        if (!ingredient) continue;
        const base = roundQty(
          convertToBase(line.quantity, line.unit, ingredient.baseUnit, ingredient.conversions),
        );
        const orderLineId = item.lineId ?? item.dishId;
        const movement = await inventoryRepository.applyMovement({
          restaurantId: restaurant.id,
          ingredientId: line.ingredientId,
          kind: "SALE_CONSUMPTION",
          quantityDelta: -base,
          referenceType: "ORDER",
          referenceId: order.id,
          idempotencyKey: `${key}:${orderLineId}:${line.ingredientId}`,
          note: `Order #${order.orderNumber} line ${orderLineId}`,
          enforceStock,
        });
        lines.push({
          ingredientId: line.ingredientId,
          quantityBase: base,
          movementId: movement.id,
          orderLineId,
          restoredQuantityBase: 0,
        });
      }
    }

    if (lines.length === 0) {
      return { skipped: true as const, reason: "No recipes mapped to order items." };
    }

    const record = await inventoryRepository.saveConsumption({
      id: `ic-${randomUUID()}`,
      restaurantId: restaurant.id,
      orderId: order.id,
      idempotencyKey: key,
      status: "CONSUMED",
      lines,
    });

    return { skipped: false as const, record };
  }

  /**
   * Restore stock only for eligible cancelled order lines (unprepared).
   * Idempotent per orderLineId. Does not restore unrelated lines.
   */
  async restoreForCancelledLines(
    restaurant: Restaurant,
    order: RestaurantOrder,
    cancelledOrderLineIds: string[],
    priorStatus: RestaurantOrder["status"],
  ) {
    const { quantitiesToRestoreForLines, lineRestoreIdempotencyKey } = await import(
      "@/lib/inventory/line-restore"
    );
    const consumeKey = consumeIdempotencyKey(order.id);
    const consumed = await inventoryRepository.findConsumptionByKey(restaurant.id, consumeKey);
    if (!consumed || (consumed.status !== "CONSUMED" && consumed.status !== "PARTIALLY_RESTORED")) {
      return { skipped: true as const, reason: "Nothing to restore." };
    }

    const gate = canAutoRestoreFromPriorStatus({
      priorStatus,
      items: order.items.filter(
        (item) => item.lineId && cancelledOrderLineIds.includes(item.lineId),
      ),
      settings: restaurant.inventorySettings,
    });
    if (!gate.allowed) {
      return { skipped: false as const, blocked: true as const, reason: gate.reason };
    }

    const planned = quantitiesToRestoreForLines({
      consumptionLines: consumed.lines,
      cancelledOrderLineIds,
      orderItems: order.items,
    });
    if (planned.length === 0) {
      return { skipped: true as const, reason: "No eligible unrestored quantities." };
    }

    const updatedLines = consumed.lines.map((line) => ({ ...line }));
    for (const plan of planned) {
      const key = lineRestoreIdempotencyKey(order.id, plan.orderLineId);
      const movement = await inventoryRepository.applyMovement({
        restaurantId: restaurant.id,
        ingredientId: plan.ingredientId,
        kind: "RESTORE_CANCEL",
        quantityDelta: plan.quantityBase,
        referenceType: "ORDER_LINE",
        referenceId: `${order.id}:${plan.orderLineId}`,
        idempotencyKey: `${key}:${plan.ingredientId}`,
        note: `Partial cancel restore order #${order.orderNumber}`,
      });
      void movement;
      const idx = updatedLines.findIndex(
        (line) =>
          line.orderLineId === plan.orderLineId && line.ingredientId === plan.ingredientId,
      );
      if (idx >= 0) {
        updatedLines[idx] = {
          ...updatedLines[idx],
          restoredQuantityBase: roundQty(
            (updatedLines[idx].restoredQuantityBase ?? 0) + plan.quantityBase,
          ),
        };
      }
    }

    const fullyRestored = updatedLines.every(
      (line) => (line.restoredQuantityBase ?? 0) + 1e-9 >= line.quantityBase,
    );
    await inventoryRepository.patchConsumption(restaurant.id, consumeKey, {
      lines: updatedLines,
      status: fullyRestored ? "RESTORED" : "PARTIALLY_RESTORED",
      reason: fullyRestored ? "Fully restored" : "Partial line cancellation restore",
    });

    return { skipped: false as const, blocked: false as const, lines: planned };
  }

  async maybeRestoreForCancelledOrder(
    restaurant: Restaurant,
    order: RestaurantOrder,
    priorStatus: RestaurantOrder["status"],
  ) {
    const consumeKey = consumeIdempotencyKey(order.id);
    const consumed = await inventoryRepository.findConsumptionByKey(restaurant.id, consumeKey);
    if (!consumed || consumed.status !== "CONSUMED") {
      return { skipped: true as const, reason: "Nothing to restore." };
    }

    const restoreKey = restoreIdempotencyKey(order.id);
    const existingRestore = await inventoryRepository.findConsumptionByKey(
      restaurant.id,
      restoreKey,
    );
    if (existingRestore) {
      return { skipped: true as const, reason: "Restore already processed.", record: existingRestore };
    }

    const gate = canAutoRestoreFromPriorStatus({
      priorStatus,
      items: order.items,
      settings: restaurant.inventorySettings,
    });

    if (!gate.allowed) {
      const blocked = await inventoryRepository.saveConsumption({
        id: `ic-${randomUUID()}`,
        restaurantId: restaurant.id,
        orderId: order.id,
        idempotencyKey: restoreKey,
        status: "BLOCKED_NO_RESTORE",
        lines: [],
        reason: gate.reason,
      });
      return { skipped: false as const, blocked: true as const, record: blocked };
    }

    const lines = [];
    for (const line of consumed.lines) {
      const movement = await inventoryRepository.applyMovement({
        restaurantId: restaurant.id,
        ingredientId: line.ingredientId,
        kind: "RESTORE_CANCEL",
        quantityDelta: roundQty(line.quantityBase),
        referenceType: "ORDER",
        referenceId: order.id,
        idempotencyKey: `${restoreKey}:${line.ingredientId}`,
        note: `Restore cancel order #${order.orderNumber}`,
      });
      lines.push({
        ingredientId: line.ingredientId,
        quantityBase: line.quantityBase,
        movementId: movement.id,
      });
    }

    await inventoryRepository.updateConsumptionStatus(restaurant.id, consumeKey, "RESTORED");
    const record = await inventoryRepository.saveConsumption({
      id: `ic-${randomUUID()}`,
      restaurantId: restaurant.id,
      orderId: order.id,
      idempotencyKey: restoreKey,
      status: "RESTORED",
      lines,
      reason: "Auto-restored on early cancellation before prep.",
    });
    return { skipped: false as const, blocked: false as const, record };
  }

  stockValuation(ingredients: Ingredient[]) {
    const total = ingredients.reduce((sum, ingredient) => {
      const unit = ingredient.averageUnitCost ?? ingredient.lastPurchaseUnitCost ?? 0;
      return sum + ingredient.quantityOnHand * unit;
    }, 0);
    return { totalValue: roundQty(total), ingredientCount: ingredients.length };
  }
}

type InventoryConsumptionRecordLines = {
  ingredientId: string;
  quantityBase: number;
  movementId: string;
  orderLineId?: string;
  restoredQuantityBase?: number;
}[];

export const inventoryService = new InventoryService();
