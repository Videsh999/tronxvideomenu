import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  IngredientModel,
  InventoryConsumptionModel,
  InventoryMovementModel,
  RecipeModel,
} from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import type {
  Ingredient,
  InventoryConsumptionRecord,
  InventoryMovement,
  InventoryMovementKind,
  PaymentAuditActor,
  Recipe,
} from "@/types";
// InventoryConsumptionRecord used by patchConsumption / saveConsumption

export class InventoryRepository {
  async listIngredients(restaurantId: string): Promise<Ingredient[]> {
    await connectToDatabase();
    const rows = await IngredientModel.find({ restaurantId }).sort({ name: 1 }).lean();
    return rows.map((row) => toDomain<Ingredient>(row));
  }

  async getIngredient(restaurantId: string, id: string): Promise<Ingredient | null> {
    await connectToDatabase();
    const row = await IngredientModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<Ingredient>(row) : null;
  }

  async createIngredient(
    data: Omit<Ingredient, "createdAt" | "updatedAt">,
  ): Promise<Ingredient> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await IngredientModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<Ingredient>(created.toObject());
  }

  async updateIngredient(
    restaurantId: string,
    id: string,
    patch: Partial<Ingredient>,
  ): Promise<Ingredient | null> {
    await connectToDatabase();
    const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const $unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) $unset[key] = 1;
      else $set[key] = value;
    }
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) update.$unset = $unset;
    const updated = await IngredientModel.findOneAndUpdate(
      { restaurantId, id },
      update,
      { new: true, runValidators: true },
    ).lean();
    return updated ? toDomain<Ingredient>(updated) : null;
  }

  async listRecipes(restaurantId: string): Promise<Recipe[]> {
    await connectToDatabase();
    const rows = await RecipeModel.find({ restaurantId }).sort({ name: 1 }).lean();
    return rows.map((row) => toDomain<Recipe>(row));
  }

  async getRecipeByDish(restaurantId: string, dishId: string): Promise<Recipe | null> {
    await connectToDatabase();
    const row = await RecipeModel.findOne({ restaurantId, dishId, isActive: true }).lean();
    return row ? toDomain<Recipe>(row) : null;
  }

  async upsertRecipe(data: Omit<Recipe, "createdAt" | "updatedAt">): Promise<Recipe> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const existing = await RecipeModel.findOne({
      restaurantId: data.restaurantId,
      dishId: data.dishId,
    }).lean();
    if (existing) {
      const updated = await RecipeModel.findOneAndUpdate(
        { restaurantId: data.restaurantId, dishId: data.dishId },
        { $set: { ...data, updatedAt: now } },
        { new: true, runValidators: true },
      ).lean();
      return toDomain<Recipe>(updated!);
    }
    const created = await RecipeModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<Recipe>(created.toObject());
  }

  async findMovementByKey(
    restaurantId: string,
    idempotencyKey: string,
  ): Promise<InventoryMovement | null> {
    await connectToDatabase();
    const row = await InventoryMovementModel.findOne({ restaurantId, idempotencyKey }).lean();
    return row ? toDomain<InventoryMovement>(row) : null;
  }

  async findConsumptionByKey(
    restaurantId: string,
    idempotencyKey: string,
  ): Promise<InventoryConsumptionRecord | null> {
    await connectToDatabase();
    const row = await InventoryConsumptionModel.findOne({ restaurantId, idempotencyKey }).lean();
    return row ? toDomain<InventoryConsumptionRecord>(row) : null;
  }

  async applyMovement(params: {
    restaurantId: string;
    ingredientId: string;
    kind: InventoryMovementKind;
    quantityDelta: number;
    unitCost?: number;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey: string;
    note?: string;
    actor?: PaymentAuditActor;
    /** When true and delta < 0, refuse only if on-hand covers the deduction. */
    enforceStock?: boolean;
  }): Promise<InventoryMovement> {
    await connectToDatabase();
    const existing = await this.findMovementByKey(params.restaurantId, params.idempotencyKey);
    if (existing) return existing;

    const ingredient = await IngredientModel.findOne({
      restaurantId: params.restaurantId,
      id: params.ingredientId,
    });
    if (!ingredient) throw new Error("Ingredient not found.");

    const now = new Date().toISOString();
    const movementId = `im-${randomUUID()}`;
    const needed = params.quantityDelta < 0 ? Math.abs(params.quantityDelta) : 0;

    let updatedIngredient = null as typeof ingredient | null;
    if (params.quantityDelta < 0 && params.enforceStock) {
      updatedIngredient = await IngredientModel.findOneAndUpdate(
        {
          restaurantId: params.restaurantId,
          id: params.ingredientId,
          quantityOnHand: { $gte: needed },
        },
        {
          $inc: { quantityOnHand: params.quantityDelta },
          $set: { updatedAt: now },
        },
        { new: true },
      );
      if (!updatedIngredient) {
        throw new Error(
          `Insufficient stock for ${ingredient.name}: need ${needed} ${ingredient.baseUnit}.`,
        );
      }
    } else {
      const costPatch: Record<string, unknown> = {
        updatedAt: now,
      };
      if (
        params.kind === "PURCHASE_RECEIPT" &&
        typeof params.unitCost === "number" &&
        params.quantityDelta > 0
      ) {
        const prevQty = Number(ingredient.quantityOnHand);
        const prevAvg = Number(ingredient.averageUnitCost ?? params.unitCost);
        const nextAvg =
          prevQty + params.quantityDelta <= 0
            ? params.unitCost
            : (prevAvg * Math.max(0, prevQty) + params.unitCost * params.quantityDelta) /
              (Math.max(0, prevQty) + params.quantityDelta);
        costPatch.averageUnitCost = nextAvg;
        costPatch.lastPurchaseUnitCost = params.unitCost;
      }
      updatedIngredient = await IngredientModel.findOneAndUpdate(
        { restaurantId: params.restaurantId, id: params.ingredientId },
        {
          $inc: { quantityOnHand: params.quantityDelta },
          $set: costPatch,
        },
        { new: true },
      );
    }

    const balanceAfter = Number(updatedIngredient?.quantityOnHand ?? 0);

    try {
      await InventoryMovementModel.create({
        id: movementId,
        restaurantId: params.restaurantId,
        ingredientId: params.ingredientId,
        kind: params.kind,
        quantityDelta: params.quantityDelta,
        unitCost: params.unitCost,
        balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        note: params.note,
        actor: params.actor,
        createdAt: now,
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        const again = await this.findMovementByKey(params.restaurantId, params.idempotencyKey);
        if (again) return again;
      }
      // Compensate stock bump if movement insert failed for a non-duplicate reason.
      await IngredientModel.updateOne(
        { restaurantId: params.restaurantId, id: params.ingredientId },
        { $inc: { quantityOnHand: -params.quantityDelta } },
      );
      throw error;
    }

    const created = await InventoryMovementModel.findOne({ id: movementId }).lean();
    return toDomain<InventoryMovement>(created!);
  }

  async saveConsumptionRecord(
    data: Omit<InventoryConsumptionRecord, "createdAt" | "updatedAt">,
  ) {
    return this.saveConsumption(data);
  }

  async patchConsumption(
    restaurantId: string,
    idempotencyKey: string,
    patch: Partial<InventoryConsumptionRecord>,
  ) {
    await connectToDatabase();
    const updated = await InventoryConsumptionModel.findOneAndUpdate(
      { restaurantId, idempotencyKey },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<InventoryConsumptionRecord>(updated) : null;
  }

  async saveConsumption(
    data: Omit<InventoryConsumptionRecord, "createdAt" | "updatedAt">,
  ): Promise<InventoryConsumptionRecord> {
    await connectToDatabase();
    const now = new Date().toISOString();
    try {
      const created = await InventoryConsumptionModel.create({
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      return toDomain<InventoryConsumptionRecord>(created.toObject());
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        const existing = await this.findConsumptionByKey(data.restaurantId, data.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async updateConsumptionStatus(
    restaurantId: string,
    idempotencyKey: string,
    status: InventoryConsumptionRecord["status"],
    reason?: string,
  ) {
    await connectToDatabase();
    const updated = await InventoryConsumptionModel.findOneAndUpdate(
      { restaurantId, idempotencyKey },
      { $set: { status, reason, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<InventoryConsumptionRecord>(updated) : null;
  }

  async listMovements(restaurantId: string, limit = 100): Promise<InventoryMovement[]> {
    await connectToDatabase();
    const rows = await InventoryMovementModel.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((row) => toDomain<InventoryMovement>(row));
  }

  async lowStock(restaurantId: string): Promise<Ingredient[]> {
    await connectToDatabase();
    const rows = await IngredientModel.find({
      restaurantId,
      isActive: true,
      reorderLevel: { $ne: null },
      $expr: { $lte: ["$quantityOnHand", "$reorderLevel"] },
    })
      .sort({ name: 1 })
      .lean();
    return rows.map((row) => toDomain<Ingredient>(row));
  }
}

export const inventoryRepository = new InventoryRepository();
