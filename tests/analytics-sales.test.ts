import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDishSales,
  computeSalesSummary,
  comparePeriods,
} from "../lib/analytics/sales";
import { buildWeekdayForecast, MIN_COMPLETE_DAYS } from "../lib/analytics/forecast";
import { classifyMenuDishes } from "../lib/analytics/menu-intelligence";
import { recommendIngredientReorder } from "../lib/analytics/inventory-intelligence";
import {
  detectSalesDrop,
  detectHighCancelRate,
} from "../lib/analytics/alerts";
import type { RestaurantOrder } from "../types";

function order(partial: Partial<RestaurantOrder> & Pick<RestaurantOrder, "id" | "total" | "status" | "createdAt">): RestaurantOrder {
  return {
    restaurantId: "r1",
    tableId: "t1",
    tableNumber: 1,
    orderNumber: 1,
    customerTokenHash: "x",
    idempotencyKey: partial.id,
    items: partial.items ?? [
      {
        dishId: "d1",
        dishNameSnapshot: "Paneer",
        quantity: 2,
        unitPriceSnapshot: 100,
        addons: [],
        itemTotal: partial.total ?? 200,
      },
    ],
    subtotal: partial.total ?? 200,
    payment: partial.payment ?? { status: "PAID", amountPaid: partial.total ?? 200, auditTrail: [], ledger: [] },
    channel: "QR",
    source: "QR",
    updatedAt: partial.createdAt,
    ...partial,
  } as RestaurantOrder;
}

test("sales summary excludes cancelled and computes net from ledger", () => {
  const orders = [
    order({
      id: "1",
      total: 100,
      status: "COMPLETED",
      createdAt: "2026-01-10T10:00:00.000Z",
      payment: {
        status: "PAID",
        amountPaid: 100,
        auditTrail: [],
        ledger: [
          {
            id: "l1",
            kind: "CHARGE",
            method: "CASH",
            amount: 100,
            recordedAt: "2026-01-10T10:05:00.000Z",
            recordedBy: { role: "RESTAURANT_ADMIN", id: "a" },
          },
        ],
      },
    }),
    order({
      id: "2",
      total: 50,
      status: "CANCELLED",
      createdAt: "2026-01-10T11:00:00.000Z",
    }),
  ];
  const summary = computeSalesSummary(orders, "2026-01-01T00:00:00.000Z", "2026-01-31T23:59:59.000Z");
  assert.equal(summary.grossSales, 100);
  assert.equal(summary.activeOrderCount, 1);
  assert.equal(summary.netSales, 100);
  assert.equal(summary.cancelledOrRejected, 1);
});

test("dish sales ranks by quantity", () => {
  const rows = computeDishSales([
    order({
      id: "1",
      total: 300,
      status: "COMPLETED",
      createdAt: "2026-01-10T10:00:00.000Z",
      items: [
        {
          dishId: "a",
          dishNameSnapshot: "A",
          quantity: 3,
          unitPriceSnapshot: 50,
          addons: [],
          itemTotal: 150,
        },
        {
          dishId: "b",
          dishNameSnapshot: "B",
          quantity: 1,
          unitPriceSnapshot: 150,
          addons: [],
          itemTotal: 150,
        },
      ],
    }),
  ]);
  assert.equal(rows[0]?.dishId, "a");
  assert.equal(rows[0]?.quantitySold, 3);
});

test("compare periods reports gross delta", () => {
  const orders = [
    order({ id: "1", total: 200, status: "COMPLETED", createdAt: "2026-01-05T10:00:00.000Z" }),
    order({ id: "2", total: 100, status: "COMPLETED", createdAt: "2026-01-15T10:00:00.000Z" }),
  ];
  const result = comparePeriods(
    orders,
    "2026-01-10T00:00:00.000Z",
    "2026-01-20T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
    "2026-01-09T23:59:59.000Z",
  );
  assert.equal(result.current.grossSales, 100);
  assert.equal(result.previous.grossSales, 200);
  assert.equal(result.grossDelta, -100);
});

test("forecast requires minimum complete days", () => {
  const daily = Array.from({ length: MIN_COMPLETE_DAYS - 1 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    grossSales: 100,
    orderVolume: 5,
    complete: true,
  }));
  const result = buildWeekdayForecast({
    daily,
    horizon: "TOMORROW",
    fromDateKey: "2026-01-20",
  });
  assert.equal(result.figuresSource, "INSUFFICIENT_DATA");
});

test("forecast weekday-ma returns points when history sufficient", () => {
  const daily = Array.from({ length: 21 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    grossSales: 100 + (i % 7) * 10,
    orderVolume: 4 + (i % 3),
    complete: true,
  }));
  const result = buildWeekdayForecast({
    daily,
    horizon: "NEXT_7_DAYS",
    fromDateKey: "2026-01-21",
  });
  assert.equal(result.figuresSource, "ESTIMATED");
  assert.equal(result.points.length, 7);
  assert.ok(result.points[0]!.revenueP90 >= result.points[0]!.revenueP10);
});

test("menu classification marks missing cost as unclassified", () => {
  const insights = classifyMenuDishes({
    dishSales: [{ dishId: "d1", dishName: "X", quantitySold: 10, revenue: 1000 }],
    costsByDishId: new Map([["d1", { costPerPortion: null, sellPrice: 100 }]]),
  });
  assert.equal(insights[0]?.classification, "UNCLASSIFIED");
});

test("menu star when popular and profitable", () => {
  const insights = classifyMenuDishes({
    dishSales: [{ dishId: "d1", dishName: "X", quantitySold: 10, revenue: 1000 }],
    costsByDishId: new Map([["d1", { costPerPortion: 20, sellPrice: 100 }]]),
    popularityThreshold: 0.01,
    marginPercentThreshold: 30,
  });
  assert.equal(insights[0]?.classification, "STAR");
});

test("inventory reorder respects inbound and safety", () => {
  const rec = recommendIngredientReorder({
    ingredientId: "i1",
    name: "Tomato",
    quantityOnHand: 20,
    pendingInboundBase: 5,
    predictedDemandBase: 32,
    leadTimeDays: 2,
    demandReliable: true,
  });
  assert.equal(rec.stockoutRisk, true);
  assert.ok(rec.suggestedReorder > 0);
  assert.equal(rec.figuresSource, "ESTIMATED");
});

test("alerts detect sales drop and cancel rate", () => {
  const currentOrders = [
    order({ id: "1", total: 50, status: "COMPLETED", createdAt: "2026-02-01T10:00:00.000Z" }),
    ...Array.from({ length: 4 }, (_, i) =>
      order({
        id: `c${i}`,
        total: 40,
        status: "CANCELLED",
        createdAt: `2026-02-0${2 + (i % 5)}T11:00:00.000Z`,
      }),
    ),
  ];
  const current = computeSalesSummary(currentOrders, "2026-02-01", "2026-02-10");
  const previous = computeSalesSummary([
    order({ id: "3", total: 200, status: "COMPLETED", createdAt: "2026-01-20T10:00:00.000Z" }),
  ], "2026-01-20", "2026-01-27");
  const drop = detectSalesDrop({ restaurantId: "r1", current, previous, thresholdPct: 25 });
  assert.ok(drop);
  const cancel = detectHighCancelRate({ restaurantId: "r1", summary: current, threshold: 0.1 });
  assert.ok(cancel);
});
