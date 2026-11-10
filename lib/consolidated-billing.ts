import { createHash } from "node:crypto";
import type { BillAllocation, BillSplitMode, MasterBillLine, RestaurantOrder } from "@/types";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function consolidateSessionOrders(orders: RestaurantOrder[], tipAmount = 0) {
  const eligible = orders
    .filter((order) => !["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const seen = new Set<string>();
  const lines: MasterBillLine[] = [];
  for (const order of eligible) {
    order.items.forEach((item, index) => {
      const lineId = item.lineId ?? `${item.dishId}-${index}`;
      const allocationKey = `${order.id}:${lineId}`;
      if (seen.has(allocationKey)) throw new Error(`Duplicate bill line ${allocationKey}`);
      seen.add(allocationKey);
      const billableQuantity = Math.max(0, item.quantity - (item.cancelledQuantity ?? 0));
      if (billableQuantity === 0) return;
      lines.push({
        allocationKey,
        orderId: order.id,
        orderNumber: order.orderNumber,
        lineId,
        dishNameSnapshot: item.dishNameSnapshot,
        quantity: item.quantity,
        billableQuantity,
        lineTotal: round(item.itemTotal * (billableQuantity / item.quantity)),
      });
    });
  }
  const subtotal = round(eligible.reduce((sum, order) => sum + order.subtotal, 0));
  const discountAmount = round(eligible.reduce((sum, order) => sum + (order.billDiscountAmount ?? 0), 0));
  const taxAmount = round(eligible.reduce((sum, order) => sum + (order.taxAmount ?? 0), 0));
  const packagingCharge = round(eligible.reduce((sum, order) => sum + (order.packagingCharge ?? 0), 0));
  const serviceCharge = round(eligible.reduce((sum, order) => sum + (order.serviceCharge ?? 0), 0));
  const normalizedTip = round(Math.max(0, tipAmount));
  const total = round(eligible.reduce((sum, order) => sum + order.total, 0) + normalizedTip);
  const amountPaid = round(Math.min(total, eligible.reduce((sum, order) => sum + (order.payment?.amountPaid ?? 0), 0)));
  const fingerprint = createHash("sha256").update(JSON.stringify({
    orders: eligible.map((order) => ({ id: order.id, updatedAt: order.updatedAt, total: order.total, status: order.status })),
    tipAmount: normalizedTip,
  })).digest("hex");
  return {
    orderIds: eligible.map((order) => order.id), lines, subtotal, discountAmount, taxAmount,
    packagingCharge, serviceCharge, tipAmount: normalizedTip, total, amountPaid,
    outstandingAmount: round(total - amountPaid), fingerprint,
  };
}

export function createBillAllocations(input: {
  mode: Exclude<BillSplitMode, "NONE">;
  total: number;
  lines: MasterBillLine[];
  customers?: number;
  custom?: { label: string; amount: number }[];
  items?: { label: string; lines: { allocationKey: string; quantity: number }[] }[];
}): BillAllocation[] {
  const total = round(input.total);
  if (input.mode === "EQUAL") {
    const count = input.customers ?? 0;
    if (!Number.isInteger(count) || count < 2 || count > 50) throw new Error("Equal split requires 2 to 50 customers.");
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / count);
    return Array.from({ length: count }, (_, index) => {
      const amount = (base + (index < cents % count ? 1 : 0)) / 100;
      return { id: `allocation-${index + 1}`, label: `Customer ${index + 1}`, lineAllocations: [], amount, amountPaid: 0, status: "UNPAID" };
    });
  }
  if (input.mode === "CUSTOM") {
    if (!input.custom?.length) throw new Error("Custom split amounts are required.");
    const sum = round(input.custom.reduce((value, row) => value + round(row.amount), 0));
    if (sum !== total) throw new Error("Custom split amounts must equal the bill total.");
    return input.custom.map((row, index) => ({ id: `allocation-${index + 1}`, label: row.label || `Customer ${index + 1}`, lineAllocations: [], amount: round(row.amount), amountPaid: 0, status: "UNPAID" }));
  }
  if (!input.items?.length) throw new Error("Item allocations are required.");
  const lineMap = new Map(input.lines.map((line) => [line.allocationKey, line]));
  const used = new Map<string, number>();
  const raw = input.items.map((group, index) => {
    let baseAmount = 0;
    const lineAllocations = group.lines.map((allocation) => {
      const line = lineMap.get(allocation.allocationKey);
      if (!line || allocation.quantity <= 0 || !Number.isInteger(allocation.quantity)) throw new Error("Invalid item allocation.");
      const next = (used.get(line.allocationKey) ?? 0) + allocation.quantity;
      if (next > line.billableQuantity) throw new Error(`Item ${line.dishNameSnapshot} is allocated more than once.`);
      used.set(line.allocationKey, next);
      const amount = round(line.lineTotal * allocation.quantity / line.billableQuantity);
      baseAmount += amount;
      return { allocationKey: line.allocationKey, quantity: allocation.quantity, amount };
    });
    return { id: `allocation-${index + 1}`, label: group.label || `Customer ${index + 1}`, lineAllocations, baseAmount };
  });
  for (const line of input.lines) if ((used.get(line.allocationKey) ?? 0) !== line.billableQuantity) throw new Error(`Item ${line.dishNameSnapshot} is not fully allocated.`);
  const baseTotal = raw.reduce((sum, row) => sum + row.baseAmount, 0);
  let assigned = 0;
  return raw.map((row, index) => {
    const amount = index === raw.length - 1 ? round(total - assigned) : round(total * row.baseAmount / baseTotal);
    assigned = round(assigned + amount);
    return { id: row.id, label: row.label, lineAllocations: row.lineAllocations, amount, amountPaid: 0, status: "UNPAID" };
  });
}
