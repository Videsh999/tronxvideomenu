import { orderRepository } from "@/lib/repositories/order.repository";
import { inventoryRepository } from "@/lib/repositories/inventory.repository";
import { procurementRepository } from "@/lib/repositories/procurement.repository";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import { dishRepository } from "@/lib/repositories/dish.repository";
import { inventoryService } from "@/lib/services/inventory.service";
import { procurementService } from "@/lib/services/procurement.service";
import {
  comparePeriods,
  computeDailySales,
  computeDishSales,
  computeSalesSummary,
} from "@/lib/analytics/sales";
import { restaurantTimezone } from "@/lib/analytics/period";
import { classifyMenuDishes } from "@/lib/analytics/menu-intelligence";
import { recommendIngredientReorder } from "@/lib/analytics/inventory-intelligence";
import { convertToBase, roundQty } from "@/lib/inventory/units";
import type { AnalyticsToolCall } from "@/lib/analytics/tools";
import type { FiguresSource, Restaurant, RestaurantOrder } from "@/types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { OrderModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

async function loadOrders(restaurantId: string, from?: string, to?: string): Promise<RestaurantOrder[]> {
  // Prefer indexed range query when bounds provided; fall back to full list for small tenants.
  if (from || to) {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    const createdAt: Record<string, string> = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lte = to;
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;
    // Widen slightly for compare tools that also need previous windows — callers pass wide enough from.
    const rows = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    return rows.map((row) => toDomain<RestaurantOrder>(row));
  }
  return orderRepository.findByRestaurantId(restaurantId);
}

export class AnalyticsService {
  async salesSummary(restaurantId: string, from?: string, to?: string) {
    const orders = await loadOrders(restaurantId, from, to);
    return computeSalesSummary(orders, from, to);
  }

  async salesByDish(restaurantId: string, from?: string, to?: string, limit = 10) {
    const orders = await loadOrders(restaurantId, from, to);
    return computeDishSales(orders, from, to).slice(0, limit);
  }

  async salesCompare(
    restaurantId: string,
    currentFrom: string,
    currentTo: string,
    previousFrom: string,
    previousTo: string,
  ) {
    const orders = await loadOrders(restaurantId, previousFrom, currentTo);
    return comparePeriods(orders, currentFrom, currentTo, previousFrom, previousTo);
  }

  async dailySales(restaurantId: string, from: string, to: string, timeZone?: string) {
    const orders = await loadOrders(restaurantId, from, to);
    return computeDailySales(orders, from, to, restaurantTimezone(timeZone));
  }

  async inventoryLowStock(restaurantId: string) {
    const low = await inventoryRepository.lowStock(restaurantId);
    return {
      figuresSource: "ACTUAL" as FiguresSource,
      items: low.map((ingredient) => ({
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantityOnHand: ingredient.quantityOnHand,
        reorderLevel: ingredient.reorderLevel,
        baseUnit: ingredient.baseUnit,
      })),
    };
  }

  async inventoryWastage(restaurantId: string, from?: string, to?: string) {
    const movements = await inventoryRepository.listMovements(restaurantId, 1000);
    const wastage = movements.filter((movement) => {
      if (movement.kind !== "WASTAGE") return false;
      if (from && movement.createdAt < from) return false;
      if (to && movement.createdAt > to) return false;
      return true;
    });
    const qty = wastage.reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);
    return {
      figuresSource: "ACTUAL" as FiguresSource,
      wastageMovementCount: wastage.length,
      wastageQuantityBase: roundQty(qty),
      from: from ?? null,
      to: to ?? null,
    };
  }

  async procurementReorder(restaurantId: string) {
    const suggestions = await procurementService.reorderSuggestions(restaurantId);
    return { figuresSource: "ACTUAL" as FiguresSource, suggestions };
  }

  async inactiveCustomers(restaurantId: string, inactiveDays = 30, limit = 25) {
    await connectToDatabase();
    const cutoff = new Date(Date.now() - inactiveDays * 86_400_000).toISOString();
    const recent = await OrderModel.aggregate<{ _id: string }>([
      {
        $match: {
          restaurantId,
          customerId: { $exists: true, $nin: [null, ""] },
          createdAt: { $gte: cutoff },
          status: { $nin: ["CANCELLED", "REJECTED"] },
        },
      },
      { $group: { _id: "$customerId" } },
    ]);
    const recentIds = new Set(recent.map((row) => row._id));
    const historical = await OrderModel.aggregate<{
      _id: string;
      lastOrderAt: string;
      totalOrders: number;
    }>([
      {
        $match: {
          restaurantId,
          customerId: { $exists: true, $nin: [null, ""] },
          status: { $nin: ["CANCELLED", "REJECTED"] },
        },
      },
      {
        $group: {
          _id: "$customerId",
          lastOrderAt: { $max: "$createdAt" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { lastOrderAt: 1 } },
      { $limit: 200 },
    ]);
    const inactive = historical
      .filter((row) => !recentIds.has(row._id))
      .slice(0, limit)
      .map((row) => ({
        customerId: row._id,
        lastOrderAt: row.lastOrderAt,
        totalOrders: row.totalOrders,
      }));
    return {
      figuresSource: "ACTUAL" as FiguresSource,
      inactiveDays,
      customers: inactive,
      note: "Based on order history (customerId). Phones are not included.",
    };
  }

  async menuMargins(restaurantId: string, from?: string, to?: string, limit = 20) {
    const dishSales = await this.salesByDish(restaurantId, from, to, 100);
    const dishes = await dishRepository.findByRestaurantId(restaurantId);
    const priceById = new Map(dishes.map((dish) => [dish.id, dish.price]));
    const rows = [];
    for (const sale of dishSales.slice(0, limit)) {
      try {
        const profitability = await inventoryService.dishProfitability(
          restaurantId,
          sale.dishId,
          priceById.get(sale.dishId) ?? sale.revenue / Math.max(1, sale.quantitySold),
        );
        rows.push({
          ...sale,
          estimatedCostPerPortion: profitability.cost.costPerPortion,
          estimatedGrossMargin: profitability.margin.estimatedGrossMargin,
          estimatedGrossMarginPercent: profitability.margin.estimatedGrossMarginPercent,
          figuresSource: "ESTIMATED" as FiguresSource,
          disclaimer: profitability.margin.disclaimer,
        });
      } catch {
        rows.push({
          ...sale,
          estimatedCostPerPortion: null,
          estimatedGrossMargin: null,
          estimatedGrossMarginPercent: null,
          figuresSource: "INSUFFICIENT_DATA" as FiguresSource,
          disclaimer: "Recipe cost unavailable.",
        });
      }
    }
    return { figuresSource: "ESTIMATED" as FiguresSource, dishes: rows };
  }

  async outletComparison(organizationId: string, from?: string, to?: string) {
    const outlets = await organizationRepository.listOutlets(organizationId);
    const rows = [];
    for (const outlet of outlets) {
      const sales = await this.salesSummary(outlet.id, from, to);
      rows.push({
        restaurantId: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        ...sales,
      });
    }
    return { organizationId, outlets: rows, from: from ?? null, to: to ?? null, figuresSource: "ACTUAL" as FiguresSource };
  }

  async menuIntelligence(restaurantId: string, from?: string, to?: string) {
    const dishSales = await this.salesByDish(restaurantId, from, to, 100);
    const dishes = await dishRepository.findByRestaurantId(restaurantId);
    const costsByDishId = new Map<string, { costPerPortion: number | null; sellPrice: number }>();
    for (const dish of dishes) {
      try {
        const profitability = await inventoryService.dishProfitability(
          restaurantId,
          dish.id,
          dish.price,
        );
        costsByDishId.set(dish.id, {
          costPerPortion: profitability.cost.costPerPortion,
          sellPrice: dish.price,
        });
      } catch {
        costsByDishId.set(dish.id, { costPerPortion: null, sellPrice: dish.price });
      }
    }
    const insights = classifyMenuDishes({ dishSales, costsByDishId });
    return {
      figuresSource: "ESTIMATED" as FiguresSource,
      period: { from: from ?? null, to: to ?? null },
      dishes: insights,
      note: "Estimated gross margin is not net/accounting profit.",
    };
  }

  async inventoryRecommendations(restaurantId: string) {
    const ingredients = await inventoryRepository.listIngredients(restaurantId);
    const recipes = await inventoryRepository.listRecipes(restaurantId);
    const pos = await procurementRepository.listPurchaseOrders(restaurantId);
    const suppliers = await procurementRepository.listSuppliers(restaurantId);
    const defaultLead = 2;
    const leadBySupplier = new Map(
      suppliers.map((supplier) => [supplier.id, supplier.leadTimeDays ?? defaultLead]),
    );

    const pendingByIngredient = new Map<string, number>();
    for (const po of pos.filter((row) => row.status === "SENT" || row.status === "PARTIAL")) {
      for (const line of po.lines) {
        const remaining = Math.max(0, line.quantity - line.receivedQuantity);
        if (remaining <= 0) continue;
        const ingredient = ingredients.find((item) => item.id === line.ingredientId);
        if (!ingredient) continue;
        const base = convertToBase(
          remaining,
          line.unit,
          ingredient.baseUnit,
          ingredient.conversions,
        );
        pendingByIngredient.set(
          line.ingredientId,
          roundQty((pendingByIngredient.get(line.ingredientId) ?? 0) + base),
        );
      }
    }

    // Trailing 7-day dish sales → recipe demand
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const dishSales = await this.salesByDish(restaurantId, from, to, 200);
    const qtyByDish = new Map(dishSales.map((row) => [row.dishId, row.quantitySold]));
    const demandByIngredient = new Map<string, number>();
    let recipesUsed = 0;
    for (const recipe of recipes.filter((row) => row.isActive)) {
      const sold = qtyByDish.get(recipe.dishId) ?? 0;
      if (sold <= 0) continue;
      recipesUsed += 1;
      const portions = Math.max(1, recipe.yieldPortions);
      for (const line of recipe.lines) {
        const ingredient = ingredients.find((item) => item.id === line.ingredientId);
        if (!ingredient) continue;
        const perPortion = convertToBase(
          line.quantity,
          line.unit,
          ingredient.baseUnit,
          ingredient.conversions,
        ) / portions;
        demandByIngredient.set(
          line.ingredientId,
          roundQty((demandByIngredient.get(line.ingredientId) ?? 0) + perPortion * sold),
        );
      }
    }

    const demandReliable = recipesUsed > 0 && dishSales.length > 0;
    const recommendations = ingredients
      .filter((ingredient) => ingredient.isActive)
      .map((ingredient) => {
        const lead =
          [...leadBySupplier.values()][0] ??
          defaultLead;
        return recommendIngredientReorder({
          ingredientId: ingredient.id,
          name: ingredient.name,
          quantityOnHand: ingredient.quantityOnHand,
          pendingInboundBase: pendingByIngredient.get(ingredient.id) ?? 0,
          predictedDemandBase: demandByIngredient.get(ingredient.id) ?? 0,
          leadTimeDays: lead,
          demandReliable: demandReliable && (demandByIngredient.has(ingredient.id) || false),
        });
      })
      .filter((row) => row.stockoutRisk || row.suggestedReorder > 0 || row.figuresSource === "INSUFFICIENT_DATA")
      .slice(0, 50);

    return {
      figuresSource: (demandReliable ? "ESTIMATED" : "INSUFFICIENT_DATA") as FiguresSource,
      recommendations,
      note: "Recommendations never place purchase orders automatically.",
    };
  }

  async executeTool(
    restaurant: Restaurant,
    call: AnalyticsToolCall,
    options?: { organizationId?: string; allowOrgComparison?: boolean },
  ) {
    const { tool, args } = call;
    const from = args.from;
    const to = args.to;

    switch (tool) {
      case "sales_summary":
        return this.salesSummary(restaurant.id, from, to);
      case "sales_by_dish":
        return this.salesByDish(restaurant.id, from, to, args.limit ?? 10);
      case "sales_compare_periods": {
        if (!args.from || !args.to || !args.previousFrom || !args.previousTo) {
          return {
            figuresSource: "INSUFFICIENT_DATA" as FiguresSource,
            error: "sales_compare_periods requires from, to, previousFrom, previousTo.",
          };
        }
        return this.salesCompare(
          restaurant.id,
          args.from,
          args.to,
          args.previousFrom,
          args.previousTo,
        );
      }
      case "inventory_low_stock":
        return this.inventoryLowStock(restaurant.id);
      case "inventory_wastage":
        return this.inventoryWastage(restaurant.id, from, to);
      case "procurement_reorder":
        return this.procurementReorder(restaurant.id);
      case "crm_inactive_customers":
        return this.inactiveCustomers(restaurant.id, args.inactiveDays ?? 30, args.limit ?? 25);
      case "menu_margins":
        return this.menuMargins(restaurant.id, from, to, args.limit ?? 20);
      case "outlet_comparison": {
        if (!options?.allowOrgComparison || !options.organizationId) {
          return {
            figuresSource: "INSUFFICIENT_DATA" as FiguresSource,
            error: "Outlet comparison requires organization report permission.",
          };
        }
        return this.outletComparison(options.organizationId, from, to);
      }
      case "forecast_summary": {
        const { forecastService } = await import("@/lib/services/forecast.service");
        return forecastService.getOrCreate(restaurant.id, args.horizon ?? "NEXT_7_DAYS");
      }
      case "inventory_recommendations":
        return this.inventoryRecommendations(restaurant.id);
      case "menu_intelligence":
        return this.menuIntelligence(restaurant.id, from, to);
      case "list_alerts": {
        const { aiAlertService } = await import("@/lib/services/ai-alert.service");
        return aiAlertService.list(restaurant.id);
      }
      default:
        return { figuresSource: "INSUFFICIENT_DATA" as FiguresSource, error: "Unknown tool." };
    }
  }
}

export const analyticsService = new AnalyticsService();
