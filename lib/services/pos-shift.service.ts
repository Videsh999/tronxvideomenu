import { randomUUID } from "node:crypto";
import { posShiftRepository } from "@/lib/repositories/pos-shift.repository";
import { orderRepository } from "@/lib/repositories/order.repository";
import { OrderServiceError } from "@/lib/services/order.service";
import { roundMoney } from "@/lib/order-pricing";
import type { PaymentAuditActor, PosShift } from "@/types";

export class PosShiftService {
  async getOpen(restaurantId: string) {
    return posShiftRepository.findOpen(restaurantId);
  }

  async open(restaurantId: string, openingFloat: number, actor: PaymentAuditActor): Promise<PosShift> {
    const existing = await posShiftRepository.findOpen(restaurantId);
    if (existing) throw new OrderServiceError("A POS shift is already open.", 409);
    return posShiftRepository.create({
      id: `shift-${randomUUID()}`,
      restaurantId,
      openedBy: actor,
      openedAt: new Date().toISOString(),
      openingFloat: roundMoney(openingFloat),
      status: "OPEN",
    });
  }

  async close(
    restaurantId: string,
    closingCashCounted: number,
    actor: PaymentAuditActor,
    notes?: string,
  ): Promise<PosShift> {
    const open = await posShiftRepository.findOpen(restaurantId);
    if (!open) throw new OrderServiceError("No open POS shift to close.", 409);

    const orders = await orderRepository.findByRestaurantId(restaurantId);
    const shiftOrders = orders.filter((order) => order.shiftId === open.id);
    const cashCollected = shiftOrders.reduce((sum, order) => {
      const ledger = order.payment?.ledger ?? [];
      return (
        sum +
        ledger.reduce((inner, entry) => {
          if (entry.method !== "CASH") return inner;
          return inner + (entry.kind === "CHARGE" ? entry.amount : -entry.amount);
        }, 0)
      );
    }, 0);
    const expectedCash = roundMoney(open.openingFloat + cashCollected);

    const closed = await posShiftRepository.close(restaurantId, open.id, {
      closedAt: new Date().toISOString(),
      closedBy: actor,
      closingCashCounted: roundMoney(closingCashCounted),
      expectedCash,
      notes,
    });
    if (!closed) throw new OrderServiceError("Could not close the POS shift.", 409);
    return closed;
  }
}

export const posShiftService = new PosShiftService();
