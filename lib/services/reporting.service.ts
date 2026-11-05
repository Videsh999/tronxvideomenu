import { orderRepository } from "@/lib/repositories/order.repository";
import { inventoryRepository } from "@/lib/repositories/inventory.repository";
import { procurementRepository } from "@/lib/repositories/procurement.repository";
import { crmRepository } from "@/lib/repositories/crm.repository";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import { inventoryService } from "@/lib/services/inventory.service";
import { roundMoney } from "@/lib/order-pricing";

function inRange(iso: string, from?: string, to?: string) {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export class ReportingService {
  async salesSummary(restaurantId: string, from?: string, to?: string) {
    const orders = await orderRepository.findByRestaurantId(restaurantId);
    const scoped = orders.filter((order) => inRange(order.createdAt, from, to));
    const completed = scoped.filter(
      (order) => !["CANCELLED", "REJECTED"].includes(order.status),
    );
    const gross = completed.reduce((sum, order) => sum + order.total, 0);
    const paid = completed.filter((order) => order.payment?.status === "PAID").length;
    return {
      orderCount: scoped.length,
      activeOrderCount: completed.length,
      grossSales: roundMoney(gross),
      paidOrders: paid,
      averageTicket: completed.length ? roundMoney(gross / completed.length) : 0,
      from: from ?? null,
      to: to ?? null,
    };
  }

  async inventorySummary(restaurantId: string) {
    const ingredients = await inventoryRepository.listIngredients(restaurantId);
    const valuation = inventoryService.stockValuation(ingredients);
    const low = ingredients.filter(
      (ingredient) =>
        ingredient.reorderLevel != null &&
        ingredient.quantityOnHand <= ingredient.reorderLevel,
    );
    const expiring = ingredients.filter((ingredient) => {
      if (!ingredient.expiryDate) return false;
      const days =
        (new Date(ingredient.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 14;
    });
    const wastage = (await inventoryRepository.listMovements(restaurantId, 500)).filter(
      (movement) => movement.kind === "WASTAGE",
    );
    const wastageQty = wastage.reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);
    return {
      ...valuation,
      lowStockCount: low.length,
      expiringSoonCount: expiring.length,
      wastageMovementCount: wastage.length,
      wastageQuantityBase: wastageQty,
    };
  }

  async purchaseSummary(restaurantId: string) {
    const orders = await procurementRepository.listPurchaseOrders(restaurantId);
    const outstanding = orders.filter(
      (order) => order.status === "SENT" || order.status === "PARTIAL",
    );
    const received = orders.filter((order) => order.status === "RECEIVED");
    return {
      purchaseOrderCount: orders.length,
      outstandingCount: outstanding.length,
      receivedCount: received.length,
    };
  }

  async customerRetention(restaurantId: string) {
    const customers = await crmRepository.listCustomers(restaurantId);
    const vip = customers.filter((customer) => customer.segment === "VIP").length;
    const optedIn = customers.filter((customer) => customer.marketingOptIn).length;
    const repeat = customers.filter((customer) => customer.totalOrders >= 2).length;
    return {
      customerCount: customers.length,
      vipCount: vip,
      marketingOptInCount: optedIn,
      repeatCustomerCount: repeat,
    };
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
    return { organizationId, outlets: rows, from: from ?? null, to: to ?? null };
  }

  async dashboard(restaurantId: string, from?: string, to?: string) {
    const [sales, inventory, purchases, customers] = await Promise.all([
      this.salesSummary(restaurantId, from, to),
      this.inventorySummary(restaurantId),
      this.purchaseSummary(restaurantId),
      this.customerRetention(restaurantId),
    ]);
    return { sales, inventory, purchases, customers };
  }
}

export const reportingService = new ReportingService();
