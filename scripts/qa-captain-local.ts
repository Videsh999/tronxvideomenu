/** Isolated, repeatable Captain workflow exercise. Never accepts a remote database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { restaurantService } from "../lib/services/restaurant.service";
import { tableRepository } from "../lib/repositories/table.repository";
import { orderService } from "../lib/services/order.service";
import { orderRepository } from "../lib/repositories/order.repository";
import { tableSessionService } from "../lib/services/table-session.service";

const uri = process.env.MONGODB_URI ?? "";
const parsed = new URL(uri);
if (parsed.hostname !== "127.0.0.1" || parsed.port !== "27019" || parsed.pathname !== "/tronx_qa") {
  throw new Error("Refusing to run: use the isolated mongodb://127.0.0.1:27019/tronx_qa database.");
}

const restaurantId = "tronx-demo-kitchen";
const actor = { role: "CAPTAIN" as const, id: "local-qa-captain", name: "Demo Captain" };

async function main() {
  const started = performance.now();
  const menu = await restaurantService.getFullMenu(restaurantId);
  assert.ok(menu, "Seed the local demo kitchen first.");
  const dishes = menu.dishes.filter((dish) => dish.isAvailable && dish.price > 0 && !(dish.variants ?? []).length && !(dish.addonGroupIds ?? []).length);
  assert.ok(dishes.length >= 2, "Demo menu needs two simple dishes.");

  const suffix = randomUUID().slice(0, 8);
  const tableNumber = 6000 + Math.floor(Math.random() * 1000);
  const roomNumber = 8000 + Math.floor(Math.random() * 1000);
  const table = await tableRepository.create({ restaurantId, locationType: "TABLE", tableNumber, label: `QA dinner ${suffix}`, capacity: 4, isActive: true, status: "OPEN" });
  const room = await tableRepository.create({ restaurantId, locationType: "ROOM", tableNumber: roomNumber, label: `QA guest room ${suffix}`, capacity: 2, isActive: true, status: "OPEN" });

  const first = await orderService.createPosOrder(restaurantId, restaurantId, {
    channel: "POS_DINE_IN", tableId: table.id, tableNumber, idempotencyKey: randomUUID(),
    items: [{ dishId: dishes[0].id, quantity: 2, selections: [] }],
  }, actor);
  assert.equal(first.tableId, table.id);
  assert.equal(first.locationType, "TABLE");
  const firstKot = await orderService.sendKot(restaurantId, first.id, actor);
  assert.equal(firstKot.kotLineIds.length, 1, "Captain response must report the sent KOT line.");
  assert.equal((await orderRepository.findByRestaurantAndId(restaurantId, firstKot.id))?.kotLineIds?.length, 1);

  const appended = await orderService.createPosOrder(restaurantId, restaurantId, {
    channel: "POS_DINE_IN", tableId: table.id, tableNumber, idempotencyKey: randomUUID(),
    items: [{ dishId: dishes[1].id, quantity: 1, selections: [] }],
  }, actor);
  assert.equal(appended.id, first.id, "Repeat Captain order should reuse the running table order.");
  assert.equal(appended.items.length, 2);
  assert.equal((await orderRepository.findByRestaurantAndId(restaurantId, appended.id))?.kotLineIds?.length, 1, "New item must wait for the second KOT.");
  const secondKot = await orderService.sendKot(restaurantId, appended.id, actor);
  assert.equal(secondKot.kotLineIds.length, 2, "Captain response must include both sent KOT lines.");
  assert.equal((await orderRepository.findByRestaurantAndId(restaurantId, secondKot.id))?.kotLineIds?.length, 2);

  const roomOrder = await orderService.createPosOrder(restaurantId, restaurantId, {
    channel: "POS_DINE_IN", tableId: room.id, tableNumber: roomNumber, idempotencyKey: randomUUID(),
    items: [{ dishId: dishes[0].id, quantity: 1, selections: [] }],
  }, actor);
  assert.equal(roomOrder.tableId, room.id);
  assert.equal(roomOrder.locationType, "ROOM");
  assert.notEqual(roomOrder.tableSessionId, secondKot.tableSessionId);

  const bill = await tableSessionService.generateBill({ restaurantId, tableSessionId: secondKot.tableSessionId!, actor, tipAmount: 20 });
  assert.ok(bill);
  assert.deepEqual(bill.orderIds, [first.id]);
  assert.equal(bill.outstandingAmount, Math.round((secondKot.total + 20) * 100) / 100);
  const partial = Math.floor(bill.total * 50) / 100;
  const firstPayment = await tableSessionService.recordPayment({ restaurantId, billId: bill.id, amount: partial, method: "CASH", actor, idempotencyKey: randomUUID() });
  assert.equal(firstPayment.status, "PARTIALLY_PAID");
  const finalPayment = await tableSessionService.recordPayment({ restaurantId, billId: bill.id, amount: firstPayment.outstandingAmount, method: "CARD", actor, idempotencyKey: randomUUID() });
  assert.equal(finalPayment.status, "PAID");
  assert.equal(finalPayment.outstandingAmount, 0);

  const closed = await tableSessionService.close(restaurantId, secondKot.tableSessionId!, actor);
  assert.equal(closed.status, "CLOSED", "Paid table must finish in one action.");
  assert.equal((await orderRepository.findByRestaurantAndId(restaurantId, first.id))?.status, "COMPLETED", "Finished table must clear its order from active views.");
  assert.equal((await tableRepository.findByRestaurantAndId(restaurantId, table.id))?.status, "OPEN", "Finished table must be ready for the next guest.");
  assert.equal((await tableSessionService.overview(restaurantId, table.id)).session, null, "No active session should remain after finishing.");

  console.log(JSON.stringify({ success: true, table: tableNumber, room: roomNumber, dishes: dishes.slice(0, 2).map((dish) => dish.name), orderNumber: first.orderNumber, kotBatches: 2, billTotal: bill.total, paymentMethods: ["CASH", "CARD"], tableFinished: true, elapsedMs: Math.round(performance.now() - started) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
