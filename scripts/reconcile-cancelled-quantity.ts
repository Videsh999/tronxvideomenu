/**
 * Fill cancelledQuantity on lines where strict mode stripped it.
 * Dry-run unless --apply is passed. A non-loopback database, including production,
 * is not written unless --allow-production is also passed.
 *
 *   node --import tsx scripts/reconcile-cancelled-quantity.ts
 *   node --import tsx scripts/reconcile-cancelled-quantity.ts --apply
 *   node --import tsx scripts/reconcile-cancelled-quantity.ts --apply --allow-production
 */
import mongoose from "mongoose";
import { plannedCancelledQuantity } from "../lib/billing/reconcile-cancelled-quantity";
import { isLoopbackMongoUri } from "../lib/security/mongo-target";

const apply = process.argv.includes("--apply");
const allowProduction = process.argv.includes("--allow-production");

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }
  const production = process.env.NODE_ENV === "production" || !isLoopbackMongoUri(uri);
  if (apply && production && !allowProduction) {
    console.error("Refusing to write. Pass --allow-production to write outside a loopback database.");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection.");
  const orders = db.collection("orders");
  const cancellations = db.collection("orderLineCancellations");
  const cursor = orders.find({ "items.cancelledQuantity": { $exists: false } });
  let ordersSeen = 0;
  let linesPlanned = 0;
  let linesWritten = 0;

  for await (const order of cursor) {
    ordersSeen += 1;
    const rows = await cancellations
      .find({ restaurantId: order.restaurantId, orderId: order.id, orderLineId: { $ne: "*" } })
      .toArray();
    const items = Array.isArray(order.items) ? order.items : [];
    let changed = false;
    const nextItems = items.map((item: { lineId?: string; cancelledQuantity?: number }) => {
      const planned = plannedCancelledQuantity(item, rows.map((row) => ({
        orderLineId: String(row.orderLineId),
        quantityCancelled: Number(row.quantityCancelled) || 0,
      })));
      if (planned == null) return item;
      linesPlanned += 1;
      changed = true;
      console.log(`${apply ? "write" : "dry-run"} ${order.id} ${item.lineId ?? "(no line)"} cancelledQuantity=${planned}`);
      return { ...item, cancelledQuantity: planned };
    });
    if (changed && apply) {
      await orders.updateOne({ _id: order._id }, { $set: { items: nextItems } });
      linesWritten += 1;
    }
  }

  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      production,
      ordersSeen,
      linesPlanned,
      ordersWritten: linesWritten,
    }),
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
