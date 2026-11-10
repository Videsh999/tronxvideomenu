import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { orderRepository } from "@/lib/repositories/order.repository";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { posShiftRepository } from "@/lib/repositories/pos-shift.repository";
import { inventoryService } from "@/lib/services/inventory.service";
import { crmService } from "@/lib/services/crm.service";
import { crmRepository } from "@/lib/repositories/crm.repository";
import { redeemPointsValue, loyaltyRedeemKey, couponRedeemKey } from "@/lib/crm/loyalty";
import { OrderLineCancellationModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import { hasRestaurantFeature } from "@/lib/features";
import { lineItemTotal, amountRemaining, roundMoney } from "@/lib/order-pricing";
import {
  billFromStoredLines,
  billMoneyFields,
  billingForRecompute,
  freezeBillingSettings,
  planLineCancellation,
  snapshotGstRate,
} from "@/lib/billing/order-bill";
import { resolveOrderedUnitPrice, VariantPriceError } from "@/lib/billing/price-line";
import { nextKotNumber } from "@/lib/captain-floor";
import type { OrderLineCancellation } from "@/types";
import { canTransition } from "@/lib/order-transitions";
import {
  defaultAuthorizationForSource,
  isCaptainKitchenEligible,
  resolveAuthorization,
} from "@/lib/order-authorization";
import type {
  OrderStatus,
  RestaurantOrder,
  PaymentMethod,
  PaymentStatus,
  PaymentAuditActor,
  PaymentAuditEvent,
  PaymentLedgerEntry,
  OrderEvent,
  KitchenStation,
  OrderItemSnapshot,
  CaptainAuthorization,
} from "@/types";
import type { PlaceOrderInput, PlacePosOrderInput, RefundPaymentInput } from "@/lib/validations";

const staffOrderView = (order: RestaurantOrder) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  tableNumber: order.tableNumber,
  tableId: order.tableId,
  status: order.status,
  channel: order.channel ?? "QR",
  source: order.source ?? "QR",
  guestCount: order.guestCount,
  orderNote: order.orderNote,
  captainAuthorization: order.captainAuthorization,
  items: order.items,
  subtotal: order.subtotal,
  billDiscountAmount: order.billDiscountAmount ?? 0,
  taxRatePercent: order.taxRatePercent ?? 0,
  taxAmount: order.taxAmount ?? 0,
  packagingCharge: order.packagingCharge ?? 0,
  serviceCharge: order.serviceCharge ?? 0,
  cgstAmount: order.cgstAmount ?? 0,
  sgstAmount: order.sgstAmount ?? 0,
  igstAmount: order.igstAmount ?? 0,
  billSnapshot: order.billSnapshot,
  total: order.total,
  payment: order.payment ?? { status: "NOT_RECORDED" as const, auditTrail: [], ledger: [], amountPaid: 0 },
  events: order.events ?? [],
  shiftId: order.shiftId,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  completedAt: order.completedAt,
});

const customerOrderView = (order: RestaurantOrder) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  tableNumber: order.tableNumber,
  status: order.status,
  items: order.items,
  subtotal: order.subtotal,
  taxAmount: order.taxAmount ?? 0,
  total: order.total,
  payment: {
    status: order.payment?.status ?? "NOT_RECORDED",
    ...(order.payment?.method ? { method: order.payment.method } : {}),
    ...(order.payment?.recordedAt ? { recordedAt: order.payment.recordedAt } : {}),
  },
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

function makeEvent(
  type: OrderEvent["type"],
  message: string,
  actor?: PaymentAuditActor,
  meta?: Record<string, unknown>,
): OrderEvent {
  return {
    id: `evt-${randomUUID()}`,
    type,
    at: new Date().toISOString(),
    actor,
    message,
    meta,
  };
}

function resolveStation(
  dishStation: KitchenStation | undefined,
  categoryStation: KitchenStation | undefined,
): KitchenStation {
  return dishStation ?? categoryStation ?? "MAIN";
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function priceVariant(dish: { name: string; price: number; variants?: Array<{ id: string; name: string; price: number; isAvailable?: boolean }> }, variantId?: string) {
  try {
    return resolveOrderedUnitPrice(dish, variantId);
  } catch (error) {
    if (error instanceof VariantPriceError) throw new OrderServiceError(error.message);
    throw error;
  }
}

function withGstSnapshot<T extends { dishId: string; gstRateSnapshot?: number }>(
  item: T,
  menu: {
    dishes: Array<{ id: string; categoryId: string; taxRatePercent?: number | null }>;
    categories: Array<{ id: string; taxRatePercent?: number | null }>;
    restaurant: { billing?: import("@/types").RestaurantBillingSettings | null };
  },
): T {
  if (item.gstRateSnapshot != null) return item;
  const dish = menu.dishes.find((entry) => entry.id === item.dishId);
  const category = dish ? menu.categories.find((entry) => entry.id === dish.categoryId) : undefined;
  return {
    ...item,
    gstRateSnapshot: snapshotGstRate({
      dish: dish ? { taxRatePercent: dish.taxRatePercent ?? undefined } : undefined,
      category: category ? { taxRatePercent: category.taxRatePercent ?? undefined } : undefined,
      billing: menu.restaurant.billing,
    }),
  };
}

export class OrderServiceError extends Error {
  constructor(message: string, readonly statusCode = 409) {
    super(message);
  }
}

class VersionConflict extends Error {
  constructor() {
    super("Order version changed.");
  }
}

/** Test hook. Set during a test to crash cancelOrderLines after the totals write. */
export const cancelCrash: { afterTotals: null | (() => void) } = { afterTotals: null };

export class OrderService {
  /** Live floor orders (open + last 36h). Use repository.findByRestaurantId for full history reports. */
  async listForRestaurant(restaurantId: string) {
    return (await orderRepository.findOperational(restaurantId)).map(staffOrderView);
  }

  async listKitchen(restaurantId: string, station?: KitchenStation) {
    return (await orderRepository.findKitchenActive(restaurantId, station))
      .filter((order) => isCaptainKitchenEligible(order))
      .map(staffOrderView);
  }

  async listPendingCaptainApprovals(restaurantId: string, tableNumbers?: number[]) {
    const orders = await orderRepository.findPending(restaurantId, tableNumbers);
    return orders
      .filter((order) => resolveAuthorization(order).status === "PENDING_CAPTAIN_APPROVAL")
      .map(staffOrderView);
  }

  async getForRestaurant(restaurantId: string, id: string) {
    const order = await orderRepository.findByRestaurantAndId(restaurantId, id);
    return order ? staffOrderView(order) : null;
  }

  async createPublic(
    input: PlaceOrderInput,
    options?: { loyaltyCustomerId?: string },
  ) {
    const menu = await restaurantService.getFullMenu(input.slug);
    if (!menu) throw new OrderServiceError("Restaurant not found.", 404);
    const table = await tableRepository.findByRestaurantAndNumber(menu.restaurant.id, input.tableNumber);
    if (!table || !table.isActive || table.status === "CLOSED") {
      throw new OrderServiceError("This table is unavailable. Please ask restaurant staff for help.");
    }
    const existing = await orderRepository.findByIdempotencyKey(menu.restaurant.id, input.idempotencyKey);
    if (existing) {
      return { order: customerOrderView(existing), duplicate: true as const };
    }

    // Optional loyalty link only — never required for QR ordering / privacy.
    let loyaltyCustomerId: string | undefined;
    if (
      options?.loyaltyCustomerId &&
      hasRestaurantFeature(menu.restaurant, "CRM_LOYALTY") &&
      menu.restaurant.loyaltySettings?.enabled !== false
    ) {
      const linked = await crmRepository.getCustomer(menu.restaurant.id, options.loyaltyCustomerId);
      if (linked) loyaltyCustomerId = linked.id;
    }

    const categoryStation = new Map(
      menu.categories.map((category) => [category.id, category.kitchenStation] as const),
    );

    const items = input.items.map((requested) => {
      const dish = menu.dishes.find((entry) => entry.id === requested.dishId);
      if (!dish || dish.restaurantId !== menu.restaurant.id) {
        throw new OrderServiceError("A selected dish is no longer available on this menu.");
      }
      if (!dish.isAvailable) throw new OrderServiceError(`${dish.name} is currently unavailable.`);

      const selections = new Map<string, (typeof requested.selections)[number]>();
      for (const selection of requested.selections) {
        if (selections.has(selection.groupId)) throw new OrderServiceError("Invalid duplicate customization group.");
        selections.set(selection.groupId, selection);
      }
      const dishGroups = dish.addonGroups ?? [];
      for (const groupId of selections.keys()) {
        if (!dishGroups.some((group) => group.id === groupId && group.isActive !== false)) {
          throw new OrderServiceError(`A customization for ${dish.name} is invalid.`);
        }
      }

      const addons = dishGroups.flatMap((group) => {
        if (group.isActive === false) return [];
        const selected = selections.get(group.id);
        const ids = selected?.addons.map((addon) => addon.addonId) ?? [];
        if (new Set(ids).size !== ids.length) {
          throw new OrderServiceError(`Duplicate option selected for ${group.name}.`);
        }
        if (
          ids.length < (group.isRequired ? Math.max(1, group.minSelect) : group.minSelect) ||
          ids.length > group.maxSelect
        ) {
          throw new OrderServiceError(`Choose the required options for ${group.name}.`);
        }
        return ids.map((id) => {
          const addon = group.addons.find((entry) => entry.id === id);
          if (!addon || addon.isActive === false || addon.isAvailable === false) {
            throw new OrderServiceError(`An option for ${dish.name} is no longer available.`);
          }
          const expectedPrice = selected?.addons.find((selection) => selection.addonId === id)?.expectedUnitPrice;
          if (expectedPrice !== addon.price) {
            throw new OrderServiceError(`The price for ${dish.name} customization changed. Please review your cart.`);
          }
          return {
            addonId: addon.id,
            nameSnapshot: addon.name,
            quantity: 1,
            unitPriceSnapshot: addon.price,
            total: addon.price,
          };
        });
      });

      const priced = priceVariant(dish, requested.variantId);
      const unitPriceSnapshot = priced.unitPrice;
      if (requested.expectedUnitPrice !== unitPriceSnapshot) {
        throw new OrderServiceError(`The price for ${dish.name} changed. Please review your cart.`);
      }
      const itemTotal = lineItemTotal({
        unitPrice: unitPriceSnapshot,
        quantity: requested.quantity,
        addonTotals: addons.map((addon) => addon.total),
      });
      return {
        lineId: `line-${randomUUID()}`,
        dishId: dish.id,
        dishNameSnapshot: dish.name,
        variantId: priced.variantId,
        variantNameSnapshot: priced.variantName,
        quantity: requested.quantity,
        unitPriceSnapshot,
        addons,
        kitchenStation: resolveStation(dish.kitchenStation, categoryStation.get(dish.categoryId)),
        preparationStatus: "QUEUED" as const,
        kotNumber: 1,
        itemTotal,
      };
    });

    const pricedItems = items.map((item) => withGstSnapshot(item, menu));
    const frozenBilling = freezeBillingSettings(menu.restaurant.billing);
    const bill = billFromStoredLines({
      items: pricedItems,
      billing: frozenBilling,
    });

    const currentTable = await tableRepository.findByRestaurantAndId(menu.restaurant.id, table.id);
    if (!currentTable?.isActive || currentTable.status === "CLOSED") {
      throw new OrderServiceError("This table became unavailable. Please ask restaurant staff for help.");
    }
    const customerToken = randomBytes(32).toString("base64url");
    const captainAuthorization = defaultAuthorizationForSource("CUSTOMER_QR");
    const createdEvent = makeEvent("CREATED", "Order placed via QR menu — awaiting captain approval", undefined, {
      billSnapshot: bill,
      captainAuthorization,
    });
    try {
      const created = await orderRepository.create({
        id: `order-${randomUUID()}`,
        restaurantId: menu.restaurant.id,
        tableId: table.id,
        tableNumber: table.tableNumber,
        customerTokenHash: createHash("sha256").update(customerToken).digest("hex"),
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
        channel: "QR",
        source: "QR",
        captainAuthorization,
        customerId: loyaltyCustomerId,
        items: pricedItems,
        ...billMoneyFields(bill),
        billingSettingsSnapshot: frozenBilling,
        payment: {
          status: "UNPAID",
          amountPaid: 0,
          auditTrail: [],
          ledger: [],
        },
        events: [createdEvent],
      });
      return { order: customerOrderView(created), customerToken };
    } catch (error) {
      if (isDuplicateKey(error)) {
        const again = await orderRepository.findByIdempotencyKey(menu.restaurant.id, input.idempotencyKey);
        if (again) return { order: customerOrderView(again), duplicate: true as const };
      }
      throw error;
    }
  }

  async createPosOrder(
    restaurantId: string,
    restaurantSlug: string,
    input: PlacePosOrderInput,
    actor: PaymentAuditActor,
  ) {
    const menu = await restaurantService.getFullMenu(restaurantSlug);
    if (!menu || menu.restaurant.id !== restaurantId) {
      throw new OrderServiceError("Restaurant not found.", 404);
    }
    const existingByKey = await orderRepository.findByIdempotencyKey(
      restaurantId,
      input.idempotencyKey,
    );
    if (existingByKey) return staffOrderView(existingByKey);

    if (input.shiftId) {
      const shift = await posShiftRepository.findById(restaurantId, input.shiftId);
      if (!shift || shift.status !== "OPEN") {
        throw new OrderServiceError("POS shift is not open.", 409);
      }
    }

    let tableId = `virtual-counter-${restaurantId}`;
    let tableNumber = 0;
    if (input.channel === "POS_DINE_IN") {
      const table = await tableRepository.findByRestaurantAndNumber(restaurantId, input.tableNumber!);
      if (!table || !table.isActive || table.status === "CLOSED" || table.status === "CLEANING") {
        throw new OrderServiceError("Selected table is unavailable.");
      }
      tableId = table.id;
      tableNumber = table.tableNumber;
    }

    const categoryStation = new Map(
      menu.categories.map((category) => [category.id, category.kitchenStation] as const),
    );

    const items: OrderItemSnapshot[] = input.items.map((requested) => {
      const dish = menu.dishes.find((entry) => entry.id === requested.dishId);
      if (!dish || dish.restaurantId !== restaurantId) {
        throw new OrderServiceError("A selected dish is no longer available.");
      }
      if (!dish.isAvailable) throw new OrderServiceError(`${dish.name} is currently unavailable.`);

      const priced = priceVariant(dish, requested.variantId);
      const unitPriceSnapshot = priced.unitPrice;
      const variantNameSnapshot = priced.variantName;
      const variantId = priced.variantId;

      const selections = new Map(requested.selections.map((selection) => [selection.groupId, selection]));
      const dishGroups = dish.addonGroups ?? [];
      for (const groupId of selections.keys()) {
        if (!dishGroups.some((group) => group.id === groupId && group.isActive !== false)) {
          throw new OrderServiceError(`A customization for ${dish.name} is invalid.`);
        }
      }

      const addons = dishGroups.flatMap((group) => {
        if (group.isActive === false) return [];
        const selected = selections.get(group.id);
        const ids = selected?.addons.map((addon) => addon.addonId) ?? [];
        if (new Set(ids).size !== ids.length) {
          throw new OrderServiceError(`Duplicate option selected for ${group.name}.`);
        }
        if (
          ids.length < (group.isRequired ? Math.max(1, group.minSelect) : group.minSelect) ||
          ids.length > group.maxSelect
        ) {
          throw new OrderServiceError(`Choose the required options for ${group.name}.`);
        }
        return ids.map((id) => {
          const addon = group.addons.find((entry) => entry.id === id);
          if (!addon || addon.isActive === false || addon.isAvailable === false) {
            throw new OrderServiceError(`An option for ${dish.name} is no longer available.`);
          }
          return {
            addonId: addon.id,
            nameSnapshot: addon.name,
            quantity: 1,
            unitPriceSnapshot: addon.price,
            total: addon.price,
          };
        });
      });

      const itemTotal = lineItemTotal({
        unitPrice: unitPriceSnapshot,
        quantity: requested.quantity,
        addonTotals: addons.map((addon) => addon.total),
        itemDiscountAmount: requested.itemDiscountAmount,
      });

      return {
        lineId: `line-${randomUUID()}`,
        dishId: dish.id,
        dishNameSnapshot: dish.name,
        variantId,
        variantNameSnapshot,
        quantity: requested.quantity,
        unitPriceSnapshot,
        addons,
        itemDiscountAmount: requested.itemDiscountAmount,
        note: requested.note,
        kitchenStation: resolveStation(dish.kitchenStation, categoryStation.get(dish.categoryId)),
        preparationStatus: "QUEUED" as const,
        kotNumber: 1,
        itemTotal,
      };
    });

    let billDiscountAmount = input.billDiscountAmount ?? 0;
    let couponCodeSnapshot: string | undefined;
    let couponDiscountAmount = 0;
    let customerId: string | undefined;
    let loyaltyPointsRedeemed = 0;

    const itemsSubtotalPreview = items.reduce((sum, item) => sum + item.itemTotal, 0);

    if (input.couponCode && hasRestaurantFeature(menu.restaurant, "CRM_LOYALTY")) {
      const preview = await crmService.previewCoupon(
        restaurantId,
        input.couponCode,
        Math.max(0, itemsSubtotalPreview - billDiscountAmount),
      );
      couponDiscountAmount = preview.discount;
      couponCodeSnapshot = preview.coupon.code;
      billDiscountAmount = roundMoney(billDiscountAmount + couponDiscountAmount);
    }

    if (input.customerPhone && hasRestaurantFeature(menu.restaurant, "CRM_LOYALTY")) {
      const customer = await crmService.upsertCustomer(restaurantId, {
        phone: input.customerPhone,
        organizationId: menu.restaurant.organizationId,
      });
      customerId = customer.id;

      if (input.redeemLoyaltyPoints && input.redeemLoyaltyPoints > 0) {
        if (input.redeemLoyaltyPoints > customer.loyaltyPoints) {
          throw new OrderServiceError("Insufficient loyalty points.", 400);
        }
        const loyaltyDiscount = redeemPointsValue({
          points: input.redeemLoyaltyPoints,
          currencyPerPoint: menu.restaurant.loyaltySettings?.currencyPerPoint,
        });
        billDiscountAmount = roundMoney(billDiscountAmount + loyaltyDiscount);
        loyaltyPointsRedeemed = input.redeemLoyaltyPoints;
      }
    }

    const pricedItems = items.map((item) => withGstSnapshot(item, menu));
    const frozenBilling = freezeBillingSettings(menu.restaurant.billing);
    const bill = billFromStoredLines({
      items: pricedItems,
      billDiscountAmount,
      billing: frozenBilling,
    });
    const taxRatePercent = bill.gstRatePercent;
    const totals = {
      itemsSubtotal: bill.itemsSubtotal,
      itemDiscounts: 0,
      billDiscount: bill.billDiscount,
      taxableAmount: bill.taxableAmount,
      taxAmount: bill.taxAmount,
      total: bill.total,
    };

    const isCaptainActor = actor.role === "CAPTAIN";
    const captainAuthorization: CaptainAuthorization = isCaptainActor
      ? {
          ...defaultAuthorizationForSource("CAPTAIN_DIRECT"),
          status: "CAPTAIN_APPROVED",
          authorizedCaptainId: actor.id,
          authorizedCaptainName: actor.name,
          authorizedAt: new Date().toISOString(),
        }
      : defaultAuthorizationForSource("POS");

    const orderId = `order-${randomUUID()}`;
    const createdEvent = makeEvent(
      "CREATED",
      isCaptainActor
        ? `Captain direct order (${input.channel}) authorized`
        : `POS order (${input.channel}) created`,
      actor,
      {
        channel: input.channel,
        couponCodeSnapshot,
        couponDiscountAmount,
        loyaltyPointsRedeemed,
        billSnapshot: bill,
        captainAuthorization,
      },
    );

    let couponIdempotencyKey: string | undefined;
    let loyaltyApplied = false;

    try {
      if (couponCodeSnapshot) {
        couponIdempotencyKey = couponRedeemKey(orderId, couponCodeSnapshot);
        const reserved = await crmService.reserveCouponRedemption({
          restaurantId,
          code: couponCodeSnapshot,
          orderTotal: Math.max(0, itemsSubtotalPreview - (input.billDiscountAmount ?? 0)),
          orderId,
          customerId,
          idempotencyKey: couponIdempotencyKey,
        });
        if (!reserved.ok) {
          throw new OrderServiceError(
            reserved.reason === "LIMIT_REACHED"
              ? "Coupon redemption limit reached."
              : "Coupon not found.",
            reserved.reason === "LIMIT_REACHED" ? 409 : 404,
          );
        }
      }

      if (customerId && loyaltyPointsRedeemed > 0) {
        await crmRepository.applyLoyalty({
          restaurantId,
          customerId,
          kind: "REDEEM",
          points: loyaltyPointsRedeemed,
          orderId,
          idempotencyKey: loyaltyRedeemKey(orderId, "pos"),
          note: "POS loyalty redemption",
        });
        loyaltyApplied = true;
      }

      const created = await orderRepository.create({
        id: orderId,
        restaurantId,
        tableId,
        tableNumber,
        customerTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
        channel: input.channel,
        source: isCaptainActor ? "CAPTAIN" : "POS",
        guestCount: input.guestCount,
        orderNote: input.orderNote,
        captainAuthorization,
        items: pricedItems,
        subtotal: totals.itemsSubtotal,
        billDiscountAmount: totals.billDiscount,
        couponCodeSnapshot,
        couponDiscountAmount,
        loyaltyPointsRedeemed,
        customerId,
        taxRatePercent,
        taxAmount: totals.taxAmount,
        packagingCharge: bill.packagingCharge,
        serviceCharge: bill.serviceCharge,
        cgstAmount: bill.cgstAmount,
        sgstAmount: bill.sgstAmount,
        igstAmount: bill.igstAmount,
        billSnapshot: bill,
        billingSettingsSnapshot: frozenBilling,
        total: totals.total,
        payment: {
          status: "UNPAID",
          amountPaid: 0,
          auditTrail: [],
          ledger: [],
        },
        events: [createdEvent],
        shiftId: input.shiftId,
      });

      if (couponIdempotencyKey) {
        await crmService.confirmCouponRedemption(restaurantId, couponIdempotencyKey);
      }

      if (input.channel === "POS_DINE_IN") {
        await tableRepository.markOccupiedForAcceptedOrder(restaurantId, tableId).catch(() => null);
      }

      return staffOrderView(created);
    } catch (error) {
      if (couponIdempotencyKey) {
        await crmService.releaseCouponRedemption(restaurantId, couponIdempotencyKey).catch(() => null);
      }
      if (loyaltyApplied && customerId && loyaltyPointsRedeemed > 0) {
        await crmRepository
          .applyLoyalty({
            restaurantId,
            customerId,
            kind: "ADJUST",
            points: loyaltyPointsRedeemed,
            orderId,
            idempotencyKey: `loyalty-release:${orderId}:pos`,
            note: "Compensate loyalty after failed POS order create",
          })
          .catch(() => null);
      }
      throw error;
    }
  }

  /**
   * Append items to an open table order (captain / POS add-on). Recalculates bill;
   * new lines start QUEUED for KOT. Idempotent via idempotencyKey on a synthetic marker event.
   */
  async appendItemsToOrder(
    restaurantId: string,
    restaurantSlug: string,
    orderId: string,
    input: {
      items: PlacePosOrderInput["items"];
      idempotencyKey: string;
      orderNote?: string;
    },
    actor: PaymentAuditActor,
  ) {
    const menu = await restaurantService.getFullMenu(restaurantSlug);
    if (!menu || menu.restaurant.id !== restaurantId) {
      throw new OrderServiceError("Restaurant not found.", 404);
    }

    const categoryStation = new Map(
      menu.categories.map((category) => [category.id, category.kitchenStation] as const),
    );

    const newItems: OrderItemSnapshot[] = input.items.map((requested) => {
      const dish = menu.dishes.find((entry) => entry.id === requested.dishId);
      if (!dish || dish.restaurantId !== restaurantId) {
        throw new OrderServiceError("A selected dish is no longer available.");
      }
      if (!dish.isAvailable) throw new OrderServiceError(`${dish.name} is currently unavailable.`);

      const priced = priceVariant(dish, requested.variantId);
      const unitPriceSnapshot = priced.unitPrice;
      const variantNameSnapshot = priced.variantName;
      const variantId = priced.variantId;

      const selections = new Map(requested.selections.map((selection) => [selection.groupId, selection]));
      const dishGroups = dish.addonGroups ?? [];
      for (const groupId of selections.keys()) {
        if (!dishGroups.some((group) => group.id === groupId && group.isActive !== false)) {
          throw new OrderServiceError(`A customization for ${dish.name} is invalid.`);
        }
      }

      const addons = dishGroups.flatMap((group) => {
        if (group.isActive === false) return [];
        const selected = selections.get(group.id);
        const ids = selected?.addons.map((addon) => addon.addonId) ?? [];
        if (new Set(ids).size !== ids.length) {
          throw new OrderServiceError(`Duplicate option selected for ${group.name}.`);
        }
        if (
          ids.length < (group.isRequired ? Math.max(1, group.minSelect) : group.minSelect) ||
          ids.length > group.maxSelect
        ) {
          throw new OrderServiceError(`Choose the required options for ${group.name}.`);
        }
        return ids.map((id) => {
          const addon = group.addons.find((entry) => entry.id === id);
          if (!addon || addon.isActive === false || addon.isAvailable === false) {
            throw new OrderServiceError(`An option for ${dish.name} is no longer available.`);
          }
          return {
            addonId: addon.id,
            nameSnapshot: addon.name,
            quantity: 1,
            unitPriceSnapshot: addon.price,
            total: addon.price,
          };
        });
      });

      const itemTotal = lineItemTotal({
        unitPrice: unitPriceSnapshot,
        quantity: requested.quantity,
        addonTotals: addons.map((addon) => addon.total),
        itemDiscountAmount: requested.itemDiscountAmount,
      });

      return {
        lineId: `line-${randomUUID()}`,
        dishId: dish.id,
        dishNameSnapshot: dish.name,
        variantId,
        variantNameSnapshot,
        quantity: requested.quantity,
        unitPriceSnapshot,
        addons,
        itemDiscountAmount: requested.itemDiscountAmount,
        note: requested.note,
        kitchenStation: resolveStation(dish.kitchenStation, categoryStation.get(dish.categoryId)),
        preparationStatus: "QUEUED" as const,
        itemTotal,
      };
    });

    const snapshottedNew = newItems.map((item) => withGstSnapshot(item, menu));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const current = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
      if (!current) throw new OrderServiceError("Order not found.", 404);
      const alreadyAppended = (current.events ?? []).some(
        (event) => event.meta?.appendIdempotencyKey === input.idempotencyKey,
      );
      if (alreadyAppended) return staffOrderView(current);
      if (["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(current.status)) {
        throw new OrderServiceError("Cannot add items to a closed order.", 409);
      }
      if (current.payment?.status === "PAID") {
        throw new OrderServiceError("Cannot add items after full payment.", 409);
      }

      // Existing lines keep unit price, tax, and KOT number. New lines are the next ticket.
      const kotNumber = nextKotNumber(current.items);
      const stampedNew = snapshottedNew.map((item) => ({ ...item, kotNumber }));
      const merged = [...current.items, ...stampedNew];
      const bill = billFromStoredLines({
        items: merged,
        billDiscountAmount: current.billDiscountAmount ?? 0,
        billing: billingForRecompute(current.billingSettingsSnapshot, current.billSnapshot),
        orderTaxRatePercent: current.taxRatePercent,
        historicalBill: current.billSnapshot,
      });

      const event = makeEvent(
        "NOTE",
        `Added ${snapshottedNew.length} item(s) to order`,
        actor,
        {
          appendIdempotencyKey: input.idempotencyKey,
          newLineIds: snapshottedNew.map((item) => item.lineId),
          billSnapshot: bill,
        },
      );

      const updated = await orderRepository.replaceItemsAndTotals(restaurantId, orderId, {
        items: merged,
        ...billMoneyFields(bill),
        orderNote: input.orderNote
          ? [current.orderNote, input.orderNote].filter(Boolean).join(" · ")
          : current.orderNote,
        event,
        reopenForKitchen: ["READY", "SERVED"].includes(current.status),
        expectedVersion: current.version ?? 0,
      });
      if (!updated) continue;
      void this.enqueueKotPrintSafe(updated, { actorId: actor.id });
      return staffOrderView(updated);
    }

    throw new OrderServiceError("Order changed while adding items. Please retry.", 409);
  }

  /** Explicit additional KOT enqueue for captain append flows (idempotent print layer handles dupes). */
  async enqueueAdditionalKot(order: RestaurantOrder, actorId?: string) {
    return this.enqueueKotPrintSafe(order, { actorId });
  }

  /**
   * Captain (or manager) authorization decision for a QR (or correction) order.
   * Atomic: only one APPROVE may win. Idempotent via decisionIdempotencyKey.
   */
  async decideCaptainAuthorization(
    restaurantId: string,
    orderId: string,
    input: {
      decision: "APPROVE" | "REJECT" | "CORRECTION";
      reason?: string;
      idempotencyKey: string;
      sendToKitchen?: boolean;
    },
    actor: PaymentAuditActor,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
    if (!current) throw new OrderServiceError("Order not found.", 404);

    const existing = resolveAuthorization(current);
    if (existing.decisionIdempotencyKey === input.idempotencyKey) {
      return staffOrderView(current);
    }

    if (existing.status === "CAPTAIN_APPROVED" && input.decision === "APPROVE") {
      throw new OrderServiceError("This order was already approved.", 409);
    }
    if (existing.status === "REJECTED" && input.decision !== "APPROVE") {
      throw new OrderServiceError("This order was already rejected.", 409);
    }

    if (input.decision !== "APPROVE" && !input.reason?.trim()) {
      throw new OrderServiceError("A reason is required for rejection or correction.", 400);
    }

    const nextStatus =
      input.decision === "APPROVE"
        ? ("CAPTAIN_APPROVED" as const)
        : input.decision === "REJECT"
          ? ("REJECTED" as const)
          : ("CORRECTION_REQUESTED" as const);

    const authorization: CaptainAuthorization = {
      status: nextStatus,
      entrySource: existing.entrySource || "CUSTOMER_QR",
      authorizedCaptainId: actor.id,
      authorizedCaptainName: actor.name,
      authorizedAt: new Date().toISOString(),
      decisionReason: input.reason?.trim() || undefined,
      decisionIdempotencyKey: input.idempotencyKey,
    };

    const event = makeEvent(
      "CAPTAIN_AUTHORIZATION",
      input.decision === "APPROVE"
        ? "Captain approved order and cleared kitchen gate"
        : input.decision === "REJECT"
          ? `Captain rejected order: ${input.reason}`
          : `Captain requested correction: ${input.reason}`,
      actor,
      { decision: input.decision, authorization },
    );

    const updated = await orderRepository.setCaptainAuthorization(
      restaurantId,
      orderId,
      {
        authorization,
        event,
        // Only transition from pending-like authorization states.
        expectedAuthorizationStatuses: [
          "PENDING_CAPTAIN_APPROVAL",
          "CORRECTION_REQUESTED",
        ],
        orderStatusOnReject: input.decision === "REJECT" ? "REJECTED" : undefined,
      },
    );

    if (!updated) {
      throw new OrderServiceError(
        "Authorization conflict — another captain may have already decided. Refresh and try again.",
        409,
      );
    }

    if (input.decision === "APPROVE" && input.sendToKitchen !== false && updated.status === "PENDING") {
      return this.acceptToKitchen(restaurantId, orderId, updated, actor);
    }

    return staffOrderView(updated);
  }

  async findActiveForTable(restaurantId: string, tableNumber: number) {
    const match = await orderRepository.findActiveForTable(restaurantId, tableNumber);
    return match ? staffOrderView(match) : null;
  }

  async recordPayment(
    restaurantId: string,
    id: string,
    method: PaymentMethod,
    actor: PaymentAuditActor,
    amount?: number,
    idempotencyKey?: string,
  ) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (
      idempotencyKey &&
      (current.payment?.ledger ?? []).some((entry) => entry.idempotencyKey === idempotencyKey)
    ) {
      return staffOrderView(current);
    }
    if (current.status === "CANCELLED" || current.status === "REJECTED") {
      throw new OrderServiceError("Cannot record payment for a cancelled or rejected order.", 409);
    }
    if (current.payment?.status === "PAID") {
      throw new OrderServiceError("Payment has already been recorded for this order.", 409);
    }
    if (current.payment?.status === "REFUNDED") {
      throw new OrderServiceError("Cannot record payment on a refunded order.", 409);
    }

    const alreadyPaid = current.payment?.amountPaid ?? 0;
    const remaining = amountRemaining(current.total, alreadyPaid);
    if (remaining <= 0) {
      throw new OrderServiceError("Order is already fully paid.", 409);
    }

    const chargeAmount = amount == null ? remaining : roundMoney(amount);
    if (chargeAmount <= 0) throw new OrderServiceError("Payment amount must be positive.", 400);
    if (chargeAmount > remaining) {
      throw new OrderServiceError("Payment amount exceeds the remaining balance.", 400);
    }

    const nextPaid = roundMoney(alreadyPaid + chargeAmount);
    const paymentStatus: PaymentStatus = nextPaid + 0.001 >= current.total ? "PAID" : "PARTIAL";

    const event: PaymentAuditEvent = {
      eventId: `pay-evt-${randomUUID()}`,
      action: paymentStatus === "PAID" ? "RECORD" : "PARTIAL",
      previousStatus: current.payment?.status ?? "NOT_RECORDED",
      newStatus: paymentStatus,
      newMethod: method,
      amount: chargeAmount,
      actor,
      timestamp: new Date().toISOString(),
    };

    const ledgerEntry: PaymentLedgerEntry = {
      id: `led-${randomUUID()}`,
      kind: "CHARGE",
      method,
      amount: chargeAmount,
      recordedAt: event.timestamp,
      recordedBy: actor,
      idempotencyKey,
    };

    const orderEvent = makeEvent(
      "PAYMENT",
      `${paymentStatus === "PAID" ? "Full" : "Partial"} payment of ${chargeAmount} via ${method}`,
      actor,
      { chargeAmount, paymentStatus },
    );

    const updated = await orderRepository.recordPayment(
      restaurantId,
      id,
      method,
      chargeAmount,
      actor,
      event,
      {
        paymentStatus,
        amountPaid: nextPaid,
        ledgerEntry,
        orderEvent,
        expectedVersion: current.version ?? 0,
        expectedAmountPaid: alreadyPaid,
        idempotencyKey,
      },
    );

    if (!updated) continue;

    // Hardware: enqueue receipt print after successful payment — never blocks payment.
    if (paymentStatus === "PAID") {
      void this.enqueueReceiptPrintSafe(updated, {
        isReprint: false,
        actorId: actor.id,
      });

      // Optional loyalty earn — only when guest opted in (customerId present). Never blocks payment.
      if (updated.customerId) {
        void restaurantService
          .getById(restaurantId)
          .then(async (restaurant) => {
            if (!restaurant) return;
            if (!hasRestaurantFeature(restaurant, "CRM_LOYALTY")) return;
            await crmService.earnForOrder(
              restaurant,
              updated.customerId!,
              updated.id,
              updated.total,
            );
          })
          .catch(() => null);
      }
    }

    return staffOrderView(updated);
    }
    throw new OrderServiceError(
      "Payment could not be recorded. The order may have been modified concurrently.",
      409,
    );
  }

  async refundPayment(
    restaurantId: string,
    id: string,
    input: RefundPaymentInput,
    actor: PaymentAuditActor,
  ) {
    if (actor.role !== "RESTAURANT_ADMIN") {
      throw new OrderServiceError("Only restaurant admins can authorize refunds.", 403);
    }
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (!current.payment || !["PAID", "PARTIAL"].includes(current.payment.status)) {
      throw new OrderServiceError("Only paid or partially paid orders can be refunded.", 409);
    }

    const paid = current.payment.amountPaid ?? current.payment.amount ?? current.total;
    const refundAmount = roundMoney(input.amount);
    if (refundAmount > paid) {
      throw new OrderServiceError("Refund cannot exceed amount paid.", 400);
    }

    const nextPaid = roundMoney(paid - refundAmount);
    const paymentStatus: PaymentStatus = nextPaid <= 0 ? "REFUNDED" : "PARTIAL";
    const orderStatus: OrderStatus | undefined = paymentStatus === "REFUNDED" ? "REFUNDED" : undefined;

    const auditEvent: PaymentAuditEvent = {
      eventId: `pay-evt-${randomUUID()}`,
      action: "REFUND",
      previousStatus: current.payment.status,
      newStatus: paymentStatus,
      previousMethod: current.payment.method,
      newMethod: input.method,
      amount: refundAmount,
      actor,
      reason: input.reason,
      timestamp: new Date().toISOString(),
    };

    const ledgerEntry: PaymentLedgerEntry = {
      id: `led-${randomUUID()}`,
      kind: "REFUND",
      method: input.method,
      amount: refundAmount,
      recordedAt: auditEvent.timestamp,
      recordedBy: actor,
      reason: input.reason,
    };

    const orderEvent = makeEvent(
      "REFUND",
      `Refunded ${refundAmount} via ${input.method}: ${input.reason}`,
      actor,
      { refundAmount },
    );

    const updated = await orderRepository.applyRefund(
      restaurantId,
      id,
      paymentStatus,
      nextPaid,
      auditEvent,
      ledgerEntry,
      orderEvent,
      orderStatus,
      current.version ?? 0,
    );

    if (!updated) {
      throw new OrderServiceError("Refund failed. The order may have changed concurrently.", 409);
    }
    return staffOrderView(updated);
  }

  async correctPayment(
    restaurantId: string,
    id: string,
    input: { action: "CORRECTION" | "REVERSAL"; method?: PaymentMethod; reason: string },
    actor: PaymentAuditActor,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (current.status === "CANCELLED") {
      throw new OrderServiceError("Cannot modify payment for a cancelled order.", 409);
    }
    if (!current.payment || current.payment.status !== "PAID") {
      throw new OrderServiceError("Only already paid orders can be corrected or reversed.", 409);
    }

    const targetStatus: PaymentStatus = input.action === "REVERSAL" ? "UNPAID" : "PAID";
    const targetMethod = input.action === "CORRECTION" ? input.method : undefined;

    const event: PaymentAuditEvent = {
      eventId: `pay-evt-${randomUUID()}`,
      action: input.action,
      previousStatus: current.payment.status,
      newStatus: targetStatus,
      previousMethod: current.payment.method,
      newMethod: targetMethod,
      amount: current.total,
      actor,
      reason: input.reason,
      timestamp: new Date().toISOString(),
    };

    const updated = await orderRepository.correctPayment(
      restaurantId,
      id,
      targetStatus,
      targetMethod,
      event,
    );

    if (!updated) {
      throw new OrderServiceError(
        "Payment modification failed. The order may have been modified concurrently.",
        409,
      );
    }

    return staffOrderView(updated);
  }

  async updateStatus(
    restaurantId: string,
    id: string,
    status: OrderStatus,
    actor?: PaymentAuditActor,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) return null;
    if (!canTransition(current.status, status)) {
      throw new OrderServiceError(`Order cannot move from ${current.status} to ${status}.`);
    }

    if (current.status === "PENDING" && status === "PREPARING") {
      return this.acceptToKitchen(restaurantId, id, current, actor);
    }

    if (
      current.status === "PENDING" &&
      (status === "ACCEPTED" || status === "PREPARING") &&
      !isCaptainKitchenEligible(current)
    ) {
      throw new OrderServiceError(
        "Captain approval is required before this order can enter the kitchen.",
        409,
      );
    }

    let table = null;
    if (status === "ACCEPTED" && current.tableNumber > 0) {
      table = await tableRepository.findByRestaurantAndId(restaurantId, current.tableId);
      if (!table || !table.isActive || table.status === "CLOSED") {
        throw new OrderServiceError("This table is closed or unavailable. The order cannot be accepted.");
      }
    }

    const event = makeEvent(
      "STATUS_CHANGED",
      `Status changed from ${current.status} to ${status}`,
      actor,
      { from: current.status, to: status },
    );

    const updated = await orderRepository.updateStatus(
      restaurantId,
      id,
      current.status,
      status,
      event,
      current.version ?? 0,
    );
    if (!updated) throw new OrderServiceError("Order status changed. Refresh and try again.");
    if (status === "ACCEPTED" && table) {
      const occupied = await tableRepository.markOccupiedForAcceptedOrder(restaurantId, table.id);
      if (!occupied) {
        await orderRepository.revertAcceptance(restaurantId, id);
        throw new OrderServiceError("This table was closed or unavailable before the order could be accepted.");
      }
    }
    await this.runInventorySideEffects(restaurantId, updated, current.status);
    return staffOrderView(updated);
  }

  private async runInventorySideEffects(
    restaurantId: string,
    order: RestaurantOrder,
    priorStatus: OrderStatus,
  ) {
    try {
      const restaurant = await restaurantService.getById(restaurantId);
      if (!restaurant || !hasRestaurantFeature(restaurant, "INVENTORY")) return;
      if (order.status === "CANCELLED" || order.status === "REJECTED") {
        await inventoryService.maybeRestoreForCancelledOrder(restaurant, order, priorStatus);
        return;
      }
      await inventoryService.consumeForOrder(restaurant, order);
    } catch {
      // Inventory failures must not block kitchen/POS status transitions; movements are idempotent on retry.
    }
  }

  async updateItemPreparation(
    restaurantId: string,
    id: string,
    lineId: string,
    preparationStatus: "QUEUED" | "PREPARING" | "READY",
    actor?: PaymentAuditActor,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (!["ACCEPTED", "PREPARING", "READY"].includes(current.status)) {
      throw new OrderServiceError("Items can only be updated while the order is in the kitchen.", 409);
    }
    const line = current.items.find((item) => item.lineId === lineId);
    if (!line) throw new OrderServiceError("Order line not found.", 404);

    const event = makeEvent(
      "ITEM_PREP",
      `${line.dishNameSnapshot}: ${preparationStatus}`,
      actor,
      { lineId, preparationStatus },
    );

    const updated = await orderRepository.updateItemPreparation(
      restaurantId,
      id,
      lineId,
      preparationStatus,
      event,
      current.version ?? 0,
    );
    if (!updated) throw new OrderServiceError("Could not update item preparation.", 409);

    if (
      preparationStatus === "READY" &&
      updated.items.every((item) => item.preparationStatus === "READY") &&
      updated.status === "PREPARING"
    ) {
      return this.updateStatus(restaurantId, id, "READY", actor);
    }

    if (preparationStatus === "PREPARING" && updated.status === "ACCEPTED") {
      return this.updateStatus(restaurantId, id, "PREPARING", actor);
    }

    return staffOrderView(updated);
  }

  async reprintReceipt(
    restaurantId: string,
    id: string,
    actor: PaymentAuditActor,
    reason?: string,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);

    const event = makeEvent("RECEIPT_REPRINT", "Receipt reprinted", actor, { reason });
    await orderRepository.logReceiptReprint({
      id: `reprint-${randomUUID()}`,
      restaurantId,
      orderId: current.id,
      orderNumber: current.orderNumber,
      reprintedAt: event.at,
      reprintedBy: actor,
      reason,
    });
    const updated = await orderRepository.appendEvent(restaurantId, id, event);
    const view = staffOrderView(updated ?? current);
    const print = await this.enqueueReceiptPrintSafe(updated ?? current, {
      isReprint: true,
      actorId: actor.id,
    });
    return { ...view, printWarning: print.warning, printJobId: print.jobId };
  }

  /** Fire-and-forget safe print helpers — device failures never fail the order path. */
  private async enqueueReceiptPrintSafe(
    order: RestaurantOrder,
    opts: { isReprint?: boolean; actorId?: string },
  ) {
    try {
      const { deviceService } = await import("@/lib/services/device.service");
      return await deviceService.tryEnqueueReceiptForOrder(order, {
        outletId: order.restaurantId,
        isReprint: opts.isReprint,
        actorId: opts.actorId,
      });
    } catch {
      return { warning: "Receipt print unavailable." };
    }
  }

  private async enqueueKotPrintSafe(
    order: RestaurantOrder,
    opts: { isReprint?: boolean; actorId?: string },
  ) {
    try {
      const { deviceService } = await import("@/lib/services/device.service");
      return await deviceService.tryEnqueueKotForOrder(order, {
        outletId: order.restaurantId,
        isReprint: opts.isReprint,
        actorId: opts.actorId,
      });
    } catch {
      return { warnings: ["KOT print unavailable."], jobIds: [] as string[] };
    }
  }

  private async acceptToKitchen(
    restaurantId: string,
    id: string,
    current: RestaurantOrder,
    actor?: PaymentAuditActor,
  ) {
    if (!isCaptainKitchenEligible(current)) {
      const auth = resolveAuthorization(current);
      throw new OrderServiceError(
        auth.status === "PENDING_CAPTAIN_APPROVAL"
          ? "This QR order is waiting for captain approval before it can enter the kitchen."
          : `Order cannot enter the kitchen while authorization is ${auth.status}.`,
        409,
      );
    }

    if (current.tableNumber > 0) {
      const table = await tableRepository.findByRestaurantAndId(restaurantId, current.tableId);
      if (!table || !table.isActive || table.status === "CLOSED") {
        throw new OrderServiceError("This table is closed or unavailable. The order cannot be accepted.");
      }

      const acceptEvent = makeEvent(
        "STATUS_CHANGED",
        "Status changed from PENDING to ACCEPTED",
        actor,
        { from: "PENDING", to: "ACCEPTED" },
      );
      const accepted = await orderRepository.updateStatus(
        restaurantId,
        id,
        "PENDING",
        "ACCEPTED",
        acceptEvent,
        current.version ?? 0,
      );
      if (!accepted) throw new OrderServiceError("Order status changed. Refresh and try again.");

      const occupied = await tableRepository.markOccupiedForAcceptedOrder(restaurantId, table.id);
      if (!occupied) {
        await orderRepository.revertAcceptance(restaurantId, id);
        throw new OrderServiceError("This table was closed or unavailable before the order could be accepted.");
      }

      const prepEvent = makeEvent(
        "STATUS_CHANGED",
        "Status changed from ACCEPTED to PREPARING",
        actor,
        { from: "ACCEPTED", to: "PREPARING" },
      );
      const preparing = await orderRepository.updateStatus(
        restaurantId,
        id,
        "ACCEPTED",
        "PREPARING",
        prepEvent,
        accepted.version ?? (current.version ?? 0) + 1,
      );
      const finalOrder = preparing ?? accepted;
      await this.runInventorySideEffects(restaurantId, finalOrder, current.status);
      void this.enqueueKotPrintSafe(finalOrder, { actorId: actor?.id });
      return staffOrderView(finalOrder);
    }

    const prepEvent = makeEvent(
      "STATUS_CHANGED",
      "Status changed from PENDING to PREPARING",
      actor,
      { from: "PENDING", to: "PREPARING" },
    );
    const preparing = await orderRepository.updateStatus(
      restaurantId,
      id,
      "PENDING",
      "PREPARING",
      prepEvent,
      current.version ?? 0,
    );
    if (!preparing) throw new OrderServiceError("Order status changed. Refresh and try again.");
    await this.runInventorySideEffects(restaurantId, preparing, current.status);
    void this.enqueueKotPrintSafe(preparing, { actorId: actor?.id });
    return staffOrderView(preparing);
  }

  async getCustomerStatus(id: string, token: string) {
    const order = await orderRepository.findForCustomer(id);
    if (!order || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
    const expected = Buffer.from(order.customerTokenHash, "hex");
    const supplied = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    return customerOrderView(order);
  }

  /**
   * Cancel eligible quantities on individual order lines.
   * Prepared/consumed lines block inventory restore but may still reduce bill quantities
   * when the line is still QUEUED. Idempotent per (orderId, lineId, qty, key).
   */
  async cancelOrderLines(
    restaurantId: string,
    orderId: string,
    input: {
      lines: { lineId: string; quantity: number }[];
      reason: string;
      idempotencyKey: string;
      actor: PaymentAuditActor;
    },
  ) {
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new OrderServiceError("A cancellation reason of at least 3 characters is required.");
    }
    if (!input.lines.length) {
      throw new OrderServiceError("Select at least one line to cancel.");
    }

    await connectToDatabase();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const session = await mongoose.startSession();
      let outcome:
        | {
            order: ReturnType<typeof staffOrderView>;
            cancellations: OrderLineCancellation[];
            duplicate: boolean;
            refundSuggested?: number;
            restorePending?: boolean;
          }
        | undefined;
      try {
        await session.withTransaction(async () => {
          outcome = undefined;
          const marker = await OrderLineCancellationModel.findOne({
            restaurantId,
            idempotencyKey: input.idempotencyKey,
          }).session(session);
          const markerStatus = marker?.applyStatus as "PENDING" | "APPLIED" | undefined;
          if (marker && (markerStatus == null || markerStatus === "APPLIED")) {
            const order = await orderRepository.findByRestaurantAndId(restaurantId, orderId, session);
            if (!order) throw new OrderServiceError("Order not found.", 404);
            const restore = marker.inventoryRestoreStatus as string | undefined;
            outcome = {
              order: staffOrderView(order),
              cancellations: [toDomain<OrderLineCancellation>(marker.toObject())],
              duplicate: true,
              restorePending: restore === "PENDING" || restore === "FAILED",
            };
            return;
          }

          const current = await orderRepository.findByRestaurantAndId(restaurantId, orderId, session);
          if (!current) throw new OrderServiceError("Order not found.", 404);
          if (["CANCELLED", "REJECTED", "REFUNDED"].includes(current.status)) {
            throw new OrderServiceError("Order is already closed for cancellation.", 409);
          }

          let plan: ReturnType<typeof planLineCancellation>;
          try {
            plan = planLineCancellation(current.items, input.lines);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to cancel lines.";
            throw new OrderServiceError(message, /not found/i.test(message) ? 404 : 409);
          }

          const bill = billFromStoredLines({
            items: plan.items,
            billDiscountAmount: current.billDiscountAmount ?? 0,
            billing: billingForRecompute(current.billingSettingsSnapshot, current.billSnapshot),
            orderTaxRatePercent: current.taxRatePercent,
            historicalBill: current.billSnapshot,
          });
          const allGone = plan.items.every((item) => (item.cancelledQuantity ?? 0) >= item.quantity);
          const event = makeEvent(
            "LINE_CANCELLED",
            `Cancelled lines: ${input.lines.map((line) => `${line.lineId}×${line.quantity}`).join(", ")} — ${reason}`,
            input.actor,
            { lines: input.lines, reason, idempotencyKey: input.idempotencyKey },
          );
          const updated = await orderRepository.replaceItemsAndTotals(restaurantId, orderId, {
            items: plan.items,
            ...billMoneyFields(bill),
            event,
            expectedVersion: current.version ?? 0,
            nextStatus: allGone && canTransition(current.status, "CANCELLED") ? "CANCELLED" : undefined,
            session,
          });
          if (!updated) throw new VersionConflict();
          if (cancelCrash.afterTotals) {
            const crash = cancelCrash.afterTotals;
            cancelCrash.afterTotals = null;
            crash();
          }

          const now = new Date().toISOString();
          const parentFields = {
            applyStatus: "APPLIED" as const,
            baseVersion: current.version ?? 0,
            plannedCancelled: plan.plannedCancelled,
            inventoryRestoreStatus: "PENDING" as const,
            priorOrderStatus: current.status,
            quantityCancelled: input.lines.reduce((sum, line) => sum + line.quantity, 0),
            reason,
          };
          if (marker) {
            await OrderLineCancellationModel.updateOne(
              { _id: marker._id },
              { $set: parentFields },
              { session },
            );
          } else {
            await OrderLineCancellationModel.create([{
              id: `olc-parent-${randomUUID()}`,
              restaurantId,
              orderId,
              orderLineId: "*",
              idempotencyKey: input.idempotencyKey,
              actor: input.actor,
              createdAt: now,
              ...parentFields,
            }], { session });
          }
          const lineRows = input.lines.map((request) => ({
            id: `olc-${randomUUID()}`,
            restaurantId,
            orderId,
            orderLineId: request.lineId,
            quantityCancelled: request.quantity,
            reason,
            inventoryRestoreStatus: "PENDING" as const,
            idempotencyKey: `${input.idempotencyKey}:${request.lineId}`,
            actor: input.actor,
            createdAt: now,
            applyStatus: "APPLIED" as const,
          }));
          if (lineRows.length) await OrderLineCancellationModel.create(lineRows, { session });
          const amountPaid = updated.payment?.amountPaid ?? 0;
          outcome = {
            order: staffOrderView(updated),
            cancellations: lineRows.map((row) => toDomain<OrderLineCancellation>(row)),
            duplicate: false,
            refundSuggested: amountPaid > updated.total ? roundMoney(amountPaid - updated.total) : 0,
          };
        });
      } catch (error) {
        if (error instanceof VersionConflict) continue;
        if (error instanceof OrderServiceError) throw error;
        if (isDuplicateKey(error)) continue;
        throw error;
      } finally {
        await session.endSession();
      }

      if (!outcome) continue;
      if (!outcome.duplicate || outcome.restorePending) {
        await this.settleCancellationInventory(restaurantId, orderId, input.idempotencyKey);
      }
      return outcome;
    }

    throw new OrderServiceError("Order changed during cancellation. Please retry.", 409);
  }

  /**
   * Finish inventory restore for one applied cancellation. Idempotent.
   * A full cancel uses the whole-order restore. A partial cancel restores only those lines.
   */
  async settleCancellationInventory(restaurantId: string, orderId: string, idempotencyKey: string) {
    await connectToDatabase();
    const parent = await OrderLineCancellationModel.findOne({ restaurantId, idempotencyKey }).lean();
    if (!parent) return { status: "APPLIED" as const };
    const current = parent.inventoryRestoreStatus as string | undefined;
    if (current === "APPLIED" || current === "RESTORED" || current === "BLOCKED" || current === "NONE") {
      return { status: "APPLIED" as const };
    }
    const order = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
    if (!order) throw new OrderServiceError("Order not found.", 404);
    const lineIds = Object.keys((parent.plannedCancelled as Record<string, number> | undefined) ?? {});
    const priorStatus = (parent.priorOrderStatus as RestaurantOrder["status"] | undefined) ?? order.status;
    const allGone = order.items.every((item) => (item.cancelledQuantity ?? 0) >= item.quantity);
    let status: "APPLIED" | "FAILED" = "APPLIED";
    try {
      const restaurant = await restaurantService.getById(restaurantId);
      if (restaurant && hasRestaurantFeature(restaurant, "INVENTORY")) {
        const result = allGone
          ? await inventoryService.maybeRestoreForCancelledOrder(restaurant, order, priorStatus)
          : await inventoryService.restoreForCancelledLines(restaurant, order, lineIds, priorStatus);
        if (result && "blocked" in result && result.blocked) status = "FAILED";
      }
    } catch (error) {
      status = "FAILED";
      await this.markInventoryRestore(restaurantId, orderId, idempotencyKey, lineIds, status);
      throw error;
    }
    await this.markInventoryRestore(restaurantId, orderId, idempotencyKey, lineIds, status);
    return { status };
  }

  /** Retry every pending or failed restore for an order. Safe to call more than once. */
  async retryInventoryRestores(restaurantId: string, orderId: string) {
    await connectToDatabase();
    const pending = await OrderLineCancellationModel.find({
      restaurantId,
      orderId,
      orderLineId: "*",
      inventoryRestoreStatus: { $in: ["PENDING", "FAILED"] },
    }).lean();
    const results = [];
    for (const row of pending) {
      try {
        results.push(await this.settleCancellationInventory(restaurantId, orderId, String(row.idempotencyKey)));
      } catch {
        results.push({ status: "FAILED" as const });
      }
    }
    return results;
  }

  private async markInventoryRestore(
    restaurantId: string,
    orderId: string,
    idempotencyKey: string,
    lineIds: string[],
    status: "APPLIED" | "FAILED",
  ) {
    const keys = [idempotencyKey, ...lineIds.map((lineId) => `${idempotencyKey}:${lineId}`)];
    await OrderLineCancellationModel.updateMany(
      { restaurantId, orderId, idempotencyKey: { $in: keys } },
      { $set: { inventoryRestoreStatus: status } },
    );
  }

  async listLineCancellations(restaurantId: string, orderId: string) {
    await this.retryInventoryRestores(restaurantId, orderId);
    await connectToDatabase();
    const rows = await OrderLineCancellationModel.find({
      restaurantId,
      orderId,
      orderLineId: { $ne: "*" },
    })
      .sort({ createdAt: -1 })
      .lean();
    return rows.map((row) => toDomain<OrderLineCancellation>(row));
  }
}

export const orderService = new OrderService();
