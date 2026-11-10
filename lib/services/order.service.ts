import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { orderRepository } from "@/lib/repositories/order.repository";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { posShiftRepository } from "@/lib/repositories/pos-shift.repository";
import { inventoryService } from "@/lib/services/inventory.service";
import { crmService } from "@/lib/services/crm.service";
import { tableSessionService } from "@/lib/services/table-session.service";
import { tableSessionRepository } from "@/lib/repositories/table-session.repository";
import { crmRepository } from "@/lib/repositories/crm.repository";
import { redeemPointsValue, loyaltyRedeemKey, couponRedeemKey } from "@/lib/crm/loyalty";
import { OrderLineCancellationModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import { hasRestaurantFeature } from "@/lib/features";
import { lineItemTotal, computeBillTotals, amountRemaining, roundMoney } from "@/lib/order-pricing";
import type { OrderLineCancellation } from "@/types";
import { canTransition } from "@/lib/order-transitions";
import {
  defaultAuthorizationForSource,
  authorizationForCustomerQr,
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
  tableSessionId: order.tableSessionId,
  locationType: order.locationType,
  status: order.status,
  channel: order.channel ?? "QR",
  source: order.source ?? "QR",
  guestCount: order.guestCount,
  orderNote: order.orderNote,
  captainAuthorization: order.captainAuthorization,
  items: order.items,
  kotLineIds: order.kotLineIds ?? [],
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
  tableSessionId: order.tableSessionId,
  locationType: order.locationType,
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

export class OrderServiceError extends Error {
  constructor(message: string, readonly statusCode = 409) {
    super(message);
  }
}

export class OrderService {
  /** Live floor orders (open + last 36h). Use repository.findByRestaurantId for full history reports. */
  async listForRestaurant(restaurantId: string) {
    return (await orderRepository.findOperational(restaurantId)).map(staffOrderView);
  }

  async listDoneHistory(restaurantId: string, limit = 500) {
    return (await orderRepository.findDoneHistory(restaurantId, limit)).map(staffOrderView);
  }

  async listKitchen(restaurantId: string, station?: KitchenStation) {
    return (await orderRepository.findKitchenActive(restaurantId, station))
      .filter((order) => isCaptainKitchenEligible(order))
      .map(staffOrderView);
  }

  async listPendingCaptainApprovals(restaurantId: string, tableIds?: string[]) {
    const orders = await orderRepository.findPending(restaurantId, tableIds);
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
    if (!table || (table.locationType ?? "TABLE") !== input.locationType || !table.isActive || table.status === "CLOSED") {
      throw new OrderServiceError(`This ${input.locationType === "ROOM" ? "room" : "table"} is unavailable. Please ask restaurant staff for help.`);
    }
    if (await orderRepository.hasIdempotencyKey(menu.restaurant.id, input.idempotencyKey)) {
      throw new OrderServiceError("This order was already submitted. Refresh the page to see your order status.");
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

      const unitPriceSnapshot = dish.price;
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
        quantity: requested.quantity,
        unitPriceSnapshot,
        addons,
        kitchenStation: resolveStation(dish.kitchenStation, categoryStation.get(dish.categoryId)),
        preparationStatus: "QUEUED" as const,
        itemTotal,
      };
    });

    const { calculateRestaurantBill } = await import("@/lib/billing/calculate-bill");
    const { resolveLineTaxRate } = await import("@/lib/billing/resolve-tax-rate");
    const categoryById = new Map(menu.categories.map((category) => [category.id, category]));
    const bill = calculateRestaurantBill({
      lines: items.map((item) => {
        const dish = menu.dishes.find((entry) => entry.id === item.dishId);
        const category = dish ? categoryById.get(dish.categoryId) : undefined;
        const resolved = resolveLineTaxRate({
          dish,
          category,
          billing: menu.restaurant.billing,
        });
        return {
          lineTotal: item.itemTotal,
          quantity: item.quantity,
          gstRatePercent: resolved.rate,
        };
      }),
      billing: menu.restaurant.billing,
    });

    const currentTable = await tableRepository.findByRestaurantAndId(menu.restaurant.id, table.id);
    if (!currentTable?.isActive || currentTable.status === "CLOSED") {
      throw new OrderServiceError("This table became unavailable. Please ask restaurant staff for help.");
    }
    if (menu.restaurant.orderSettings?.customerOrderingMode === "OFF") {
      throw new OrderServiceError("Customer QR ordering is disabled for this outlet.", 403);
    }
    const customerMode = menu.restaurant.orderSettings?.customerOrderingMode;
    const existingSession = await tableSessionRepository.findActive(menu.restaurant.id, table.id);
    if (existingSession && input.tableSessionId !== existingSession.id && customerMode !== "AUTOMATIC") {
      throw new OrderServiceError("This table already has an active party. Ask the captain to join the existing bill or start a separate order.", 409);
    }
    const customerToken = randomBytes(32).toString("base64url");
    const tableSession = await tableSessionService.ensureActive({
      restaurant: menu.restaurant,
      table,
      openedBy: { role: "CUSTOMER_QR", id: options?.loyaltyCustomerId ?? `guest:${input.idempotencyKey}` },
      customerReference: options?.loyaltyCustomerId,
    });
    const requiresCaptainApproval = menu.restaurant.orderSettings?.customerOrderingMode
      ? menu.restaurant.orderSettings.customerOrderingMode === "CAPTAIN_APPROVAL"
      : menu.restaurant.orderSettings?.qrRequiresCaptainApproval !== false;
    const captainAuthorization = authorizationForCustomerQr(requiresCaptainApproval);
    // Each guest receives a token bound to the order created below. Reusing another
    // guest's order would return a token that cannot authorize status tracking.
    const createdEvent = makeEvent("CREATED", requiresCaptainApproval
      ? "Order placed via QR menu — awaiting captain approval"
      : "Order placed via QR menu — ready for staff acceptance", undefined, {
      billSnapshot: bill,
      captainAuthorization,
    });
    const created = await orderRepository.create({
      id: `order-${randomUUID()}`,
      restaurantId: menu.restaurant.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableSessionId: tableSession.id,
      locationType: table.locationType ?? "TABLE",
      customerTokenHash: createHash("sha256").update(customerToken).digest("hex"),
      idempotencyKey: input.idempotencyKey,
      status: requiresCaptainApproval ? "PENDING" : "ACCEPTED",
      channel: "QR",
      source: "QR",
      captainAuthorization,
      customerId: loyaltyCustomerId,
      items,
      subtotal: bill.itemsSubtotal,
      billDiscountAmount: 0,
      taxRatePercent: bill.gstRatePercent,
      taxAmount: bill.taxAmount,
      packagingCharge: bill.packagingCharge,
      serviceCharge: bill.serviceCharge,
      cgstAmount: bill.cgstAmount,
      sgstAmount: bill.sgstAmount,
      igstAmount: bill.igstAmount,
      billSnapshot: bill,
      total: bill.total,
      payment: {
        status: "UNPAID",
        amountPaid: 0,
        auditTrail: [],
        ledger: [],
      },
      events: [createdEvent],
    });
    return { order: customerOrderView(created), customerToken };
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
    let locationType: RestaurantOrder["locationType"];
    let serviceTable: Awaited<ReturnType<typeof tableRepository.findByRestaurantAndNumber>> = null;
    const isCaptainActor = actor.role === "CAPTAIN";
    if (input.channel === "POS_DINE_IN") {
      const legacyMatches = input.tableId ? [] : (await tableRepository.findByRestaurantId(restaurantId)).filter((candidate) => candidate.tableNumber === input.tableNumber);
      if (legacyMatches.length > 1) throw new OrderServiceError("This table number is shared by a table and room. Select a specific location.", 409);
      const table = input.tableId
        ? await tableRepository.findByRestaurantAndId(restaurantId, input.tableId)
        : legacyMatches[0] ?? null;
      if (table && input.tableNumber !== table.tableNumber) throw new OrderServiceError("Selected location changed. Refresh and try again.", 409);
      if (!table || !table.isActive || table.status === "CLOSED" || table.status === "CLEANING") {
        throw new OrderServiceError("Selected table is unavailable.");
      }
      tableId = table.id;
      tableNumber = table.tableNumber;
      locationType = table.locationType ?? "TABLE";
      serviceTable = table;
      if (isCaptainActor) {
        const active = await orderRepository.findActiveForTable(restaurantId, table.id);
        if (active && active.tableId === table.id && !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(active.status)) {
          return this.appendItemsToOrder(restaurantId, restaurantSlug, active.id, {
            items: input.items,
            idempotencyKey: input.idempotencyKey,
            orderNote: input.orderNote,
          }, actor);
        }
      }
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

      let unitPriceSnapshot = dish.price;
      let variantNameSnapshot: string | undefined;
      let variantId: string | undefined;
      if (requested.variantId) {
        const variant = (dish.variants ?? []).find((entry) => entry.id === requested.variantId);
        if (!variant || variant.isAvailable === false) {
          throw new OrderServiceError(`A variant for ${dish.name} is unavailable.`);
        }
        unitPriceSnapshot = variant.price;
        variantNameSnapshot = variant.name;
        variantId = variant.id;
      } else if ((dish.variants ?? []).length > 0) {
        throw new OrderServiceError(`Select a variant for ${dish.name}.`);
      }

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

    const { calculateRestaurantBill } = await import("@/lib/billing/calculate-bill");
    const { resolveLineTaxRate } = await import("@/lib/billing/resolve-tax-rate");
    const categoryById = new Map(menu.categories.map((category) => [category.id, category]));
    const bill = calculateRestaurantBill({
      lines: items.map((item) => {
        const dish = menu.dishes.find((entry) => entry.id === item.dishId);
        const category = dish ? categoryById.get(dish.categoryId) : undefined;
        const resolved = resolveLineTaxRate({
          dish,
          category,
          billing: menu.restaurant.billing,
        });
        return {
          lineTotal: item.itemTotal,
          quantity: item.quantity,
          gstRatePercent: resolved.rate,
        };
      }),
      billDiscountAmount,
      billing: menu.restaurant.billing,
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

      const tableSession = serviceTable
        ? await tableSessionService.ensureActive({ restaurant: menu.restaurant, table: serviceTable, openedBy: actor, guestCount: input.guestCount, customerReference: customerId })
        : null;
      const created = await orderRepository.create({
        id: orderId,
        restaurantId,
        tableId,
        tableNumber,
        tableSessionId: tableSession?.id,
        locationType,
        customerTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
        channel: input.channel,
        source: isCaptainActor ? "CAPTAIN" : "POS",
        guestCount: input.guestCount,
        orderNote: input.orderNote,
        captainAuthorization,
        items,
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

      let unitPriceSnapshot = dish.price;
      let variantNameSnapshot: string | undefined;
      let variantId: string | undefined;
      if (requested.variantId) {
        const variant = (dish.variants ?? []).find((entry) => entry.id === requested.variantId);
        if (!variant || variant.isAvailable === false) {
          throw new OrderServiceError(`A variant for ${dish.name} is unavailable.`);
        }
        unitPriceSnapshot = variant.price;
        variantNameSnapshot = variant.name;
        variantId = variant.id;
      } else if ((dish.variants ?? []).length > 0) {
        throw new OrderServiceError(`Select a variant for ${dish.name}.`);
      }

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

    const merged = [...current.items, ...newItems];
    const { calculateRestaurantBill } = await import("@/lib/billing/calculate-bill");
    const { resolveLineTaxRate } = await import("@/lib/billing/resolve-tax-rate");
    const categoryById = new Map(menu.categories.map((category) => [category.id, category]));
    const bill = calculateRestaurantBill({
      lines: merged.map((item) => {
        const dish = menu.dishes.find((entry) => entry.id === item.dishId);
        const category = dish ? categoryById.get(dish.categoryId) : undefined;
        const resolved = resolveLineTaxRate({
          dish,
          category,
          billing: menu.restaurant.billing,
        });
        return {
          lineTotal: item.itemTotal,
          quantity: item.quantity,
          gstRatePercent: resolved.rate,
        };
      }),
      billDiscountAmount: current.billDiscountAmount ?? 0,
      billing: menu.restaurant.billing,
    });

    const event = makeEvent(
      "NOTE",
      `Added ${newItems.length} item(s) to order`,
      actor,
      {
        appendIdempotencyKey: input.idempotencyKey,
        newLineIds: newItems.map((item) => item.lineId),
        billSnapshot: bill,
      },
    );

    const updated = await orderRepository.replaceItemsAndTotals(restaurantId, orderId, {
      items: merged,
      subtotal: bill.itemsSubtotal,
      taxRatePercent: bill.gstRatePercent,
      taxAmount: bill.taxAmount,
      packagingCharge: bill.packagingCharge,
      serviceCharge: bill.serviceCharge,
      cgstAmount: bill.cgstAmount,
      sgstAmount: bill.sgstAmount,
      igstAmount: bill.igstAmount,
      billSnapshot: bill,
      total: bill.total,
      orderNote: input.orderNote
        ? [current.orderNote, input.orderNote].filter(Boolean).join(" · ")
        : current.orderNote,
      event,
      reopenForKitchen: ["READY", "SERVED"].includes(current.status),
    });

    if (!updated) throw new OrderServiceError("Unable to update order.", 500);
    // Appended lines remain QUEUED until the captain explicitly sends the next KOT.
    return staffOrderView(updated);
  }

  /** Explicit additional KOT enqueue for captain append flows (idempotent print layer handles dupes). */
  async enqueueAdditionalKot(order: RestaurantOrder, actorId?: string, lineIds?: string[]) {
    const items = lineIds ? order.items.filter((item) => item.lineId && lineIds.includes(item.lineId)) : order.items;
    if (!items.length) return { warnings: ["No items to print on this KOT."], jobIds: [] as string[] };
    const batchSubtotal = Math.round(items.reduce((sum, item) => sum + item.itemTotal, 0) * 100) / 100;
    return this.enqueueKotPrintSafe({ ...order, items, subtotal: batchSubtotal, taxAmount: 0, total: batchSubtotal }, { actorId });
  }

  async sendKot(restaurantId: string, orderId: string, actor: PaymentAuditActor) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (!isCaptainKitchenEligible(current)) throw new OrderServiceError("Approve this customer order before sending a KOT.", 409);
    const sent = new Set(current.kotLineIds ?? []);
    const pendingLineIds = current.items.map((item) => item.lineId).filter((id): id is string => typeof id === "string" && !sent.has(id));
    if (!pendingLineIds.length) throw new OrderServiceError("There are no new items waiting for a KOT.", 409);
    const event = makeEvent("STATUS_CHANGED", `KOT sent for ${pendingLineIds.length} new line(s)`, actor, { kotLineIds: pendingLineIds });
    const updated = await orderRepository.markKotSent(restaurantId, orderId, pendingLineIds, event);
    if (!updated) throw new OrderServiceError("Unable to send KOT. Refresh the table and try again.", 409);
    void this.enqueueAdditionalKot(updated, actor.id, pendingLineIds);
    return staffOrderView(updated);
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

    return staffOrderView(updated);
  }

  async findActiveForTable(restaurantId: string, tableId: string) {
    const match = await orderRepository.findActiveForTable(restaurantId, tableId);
    return match ? staffOrderView(match) : null;
  }

  async recordPayment(
    restaurantId: string,
    id: string,
    method: PaymentMethod,
    actor: PaymentAuditActor,
    amount?: number,
  ) {
    const current = await orderRepository.findByRestaurantAndId(restaurantId, id);
    if (!current) throw new OrderServiceError("Order not found.", 404);
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
      },
    );

    if (!updated) {
      throw new OrderServiceError(
        "Payment could not be recorded. The order may have been modified concurrently.",
        409,
      );
    }

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
    const existingCancel = await OrderLineCancellationModel.findOne({
      restaurantId,
      idempotencyKey: input.idempotencyKey,
    }).lean();
    if (existingCancel) {
      const order = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
      if (!order) throw new OrderServiceError("Order not found.", 404);
      return {
        order: staffOrderView(order),
        cancellations: [toDomain<OrderLineCancellation>(existingCancel)],
        duplicate: true as const,
      };
    }

    const current = await orderRepository.findByRestaurantAndId(restaurantId, orderId);
    if (!current) throw new OrderServiceError("Order not found.", 404);
    if (["CANCELLED", "REJECTED", "REFUNDED"].includes(current.status)) {
      throw new OrderServiceError("Order is already closed for cancellation.", 409);
    }

    const nextItems = current.items.map((item) => ({ ...item }));
    const cancelledLineIds: string[] = [];
    const cancellationRows: Omit<OrderLineCancellation, "createdAt">[] = [];

    for (const request of input.lines) {
      if (!Number.isInteger(request.quantity) || request.quantity < 1) {
        throw new OrderServiceError("Cancellation quantity must be a positive integer.");
      }
      const idx = nextItems.findIndex((item) => item.lineId === request.lineId);
      if (idx < 0) throw new OrderServiceError(`Order line ${request.lineId} not found.`, 404);
      const line = nextItems[idx];
      const alreadyCancelled = line.cancelledQuantity ?? 0;
      const remaining = line.quantity - alreadyCancelled;
      if (request.quantity > remaining) {
        throw new OrderServiceError(
          `Cannot cancel ${request.quantity} of ${line.dishNameSnapshot}; only ${remaining} remaining.`,
          409,
        );
      }
      if (line.preparationStatus === "PREPARING" || line.preparationStatus === "READY") {
        // Allowed to record cancel of unprepared remainder only — block when fully in prep.
        // If any qty remains QUEUED conceptually we still allow reducing unpaid remainder;
        // for safety, block cancel of lines already in prep/ready.
        throw new OrderServiceError(
          `${line.dishNameSnapshot} is already being prepared and cannot be cancelled.`,
          409,
        );
      }

      const newCancelled = alreadyCancelled + request.quantity;
      const activeQty = line.quantity - newCancelled;
      const addonTotals = (line.addons ?? []).map((addon) => addon.unitPriceSnapshot);
      const itemTotal =
        activeQty < 1
          ? 0
          : lineItemTotal({
              unitPrice: line.unitPriceSnapshot,
              quantity: activeQty,
              addonTotals,
              itemDiscountAmount: line.itemDiscountAmount
                ? roundMoney((line.itemDiscountAmount * activeQty) / Math.max(1, line.quantity - alreadyCancelled))
                : 0,
            });

      nextItems[idx] = {
        ...line,
        cancelledQuantity: newCancelled,
        itemTotal,
      };
      cancelledLineIds.push(request.lineId);
      cancellationRows.push({
        id: `olc-${randomUUID()}`,
        restaurantId,
        orderId,
        orderLineId: request.lineId,
        quantityCancelled: request.quantity,
        reason,
        inventoryRestoreStatus: "NONE",
        idempotencyKey: `${input.idempotencyKey}:${request.lineId}`,
        actor: input.actor,
      });
    }

    const activeLineTotals = nextItems.map((item) => {
      const active = item.quantity - (item.cancelledQuantity ?? 0);
      return active > 0 ? item.itemTotal : 0;
    });
    const billDiscountCap = Math.min(current.billDiscountAmount ?? 0, activeLineTotals.reduce((a, b) => a + b, 0));
    const totals = computeBillTotals({
      lineTotals: activeLineTotals,
      billDiscountAmount: billDiscountCap,
      taxRatePercent: current.taxRatePercent ?? 0,
    });

    const event = makeEvent(
      "LINE_CANCELLED",
      `Cancelled lines: ${input.lines.map((l) => `${l.lineId}×${l.quantity}`).join(", ")} — ${reason}`,
      input.actor,
      { lines: input.lines, reason, idempotencyKey: input.idempotencyKey },
    );

    const updated = await orderRepository.replaceItemsAndTotals(restaurantId, orderId, {
      items: nextItems,
      subtotal: totals.itemsSubtotal,
      billDiscountAmount: totals.billDiscount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      event,
    });
    if (!updated) throw new OrderServiceError("Order could not be updated for cancellation.", 409);

    // If all lines fully cancelled, move order to CANCELLED.
    const allGone = nextItems.every((item) => (item.cancelledQuantity ?? 0) >= item.quantity);
    let finalOrder = updated;
    if (allGone && canTransition(updated.status, "CANCELLED")) {
      const cancelEvent = makeEvent(
        "STATUS_CHANGED",
        "Order cancelled after all lines cancelled",
        input.actor,
        { from: updated.status, to: "CANCELLED" },
      );
      const cancelled = await orderRepository.updateStatus(
        restaurantId,
        orderId,
        updated.status,
        "CANCELLED",
        cancelEvent,
      );
      if (cancelled) finalOrder = cancelled;
    }

    const restaurant = await restaurantService.getById(restaurantId);
    let restoreStatus: OrderLineCancellation["inventoryRestoreStatus"] = "NONE";
    if (restaurant && hasRestaurantFeature(restaurant, "INVENTORY")) {
      const restore = await inventoryService.restoreForCancelledLines(
        restaurant,
        finalOrder,
        cancelledLineIds,
        current.status,
      );
      if (restore.skipped) restoreStatus = "NONE";
      else if ("blocked" in restore && restore.blocked) restoreStatus = "BLOCKED";
      else restoreStatus = "RESTORED";
    }

    const now = new Date().toISOString();
    const saved: OrderLineCancellation[] = [];
    for (const row of cancellationRows) {
      try {
        const created = await OrderLineCancellationModel.create({
          ...row,
          inventoryRestoreStatus: restoreStatus,
          createdAt: now,
        });
        saved.push(toDomain<OrderLineCancellation>(created.toObject()));
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === 11000) {
          const again = await OrderLineCancellationModel.findOne({
            restaurantId,
            idempotencyKey: row.idempotencyKey,
          }).lean();
          if (again) saved.push(toDomain<OrderLineCancellation>(again));
          continue;
        }
        throw error;
      }
    }

    // Parent idempotency marker
    try {
      await OrderLineCancellationModel.create({
        id: `olc-parent-${randomUUID()}`,
        restaurantId,
        orderId,
        orderLineId: "*",
        quantityCancelled: input.lines.reduce((sum, line) => sum + line.quantity, 0),
        reason,
        inventoryRestoreStatus: restoreStatus,
        idempotencyKey: input.idempotencyKey,
        actor: input.actor,
        createdAt: now,
      });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
    }

    if (finalOrder.status === "CANCELLED") {
      await this.runInventorySideEffects(restaurantId, finalOrder, current.status);
    }

    const amountPaid = finalOrder.payment?.amountPaid ?? 0;
    return {
      order: staffOrderView(finalOrder),
      cancellations: saved,
      duplicate: false as const,
      refundSuggested: amountPaid > finalOrder.total ? roundMoney(amountPaid - finalOrder.total) : 0,
    };
  }

  listLineCancellations(restaurantId: string, orderId: string) {
    return connectToDatabase().then(async () => {
      const rows = await OrderLineCancellationModel.find({
        restaurantId,
        orderId,
        orderLineId: { $ne: "*" },
      })
        .sort({ createdAt: -1 })
        .lean();
      return rows.map((row) => toDomain<OrderLineCancellation>(row));
    });
  }
}

export const orderService = new OrderService();
