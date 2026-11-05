/**
 * One-shot: ensure Triparna Kitchen has tables and assign them to existing captains.
 * Usage: node --env-file=.env.local --import tsx scripts/assign-triparna-captain-tables.ts
 */
import { connectToDatabase } from "@/lib/db/mongodb";
import { CaptainModel, RestaurantModel, TableModel } from "@/lib/db/models";
import { captainAssignmentRepository } from "@/lib/repositories/captain-assignment.repository";

const SLUG = "triparna-kitchen";
const TARGET_TABLE_COUNT = 20;

async function main() {
  await connectToDatabase();
  const restaurant = await RestaurantModel.findOne({ slug: SLUG }).lean();
  if (!restaurant) {
    throw new Error(`Restaurant slug=${SLUG} not found.`);
  }
  const restaurantId = restaurant.id as string;

  let tables = await TableModel.find({ restaurantId }).sort({ tableNumber: 1 }).lean();
  if (tables.length < TARGET_TABLE_COUNT) {
    const existingNumbers = new Set(tables.map((table) => table.tableNumber as number));
    const now = new Date().toISOString();
    const toCreate = [];
    for (let n = 1; n <= TARGET_TABLE_COUNT; n += 1) {
      if (existingNumbers.has(n)) continue;
      toCreate.push({
        id: `table-${restaurantId}-${n}`,
        restaurantId,
        tableNumber: n,
        label: `Table ${n}`,
        capacity: 4,
        isActive: true,
        status: "OPEN",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (toCreate.length) {
      await TableModel.insertMany(toCreate, { ordered: false }).catch(() => null);
      tables = await TableModel.find({ restaurantId }).sort({ tableNumber: 1 }).lean();
    }
  }

  const activeTables = tables.filter((table) => table.isActive !== false);
  const captains = await CaptainModel.find({ restaurantId, isActive: true }).sort({ createdAt: 1 }).lean();
  if (!captains.length) {
    throw new Error("No active captains found for Triparna Kitchen.");
  }

  const chunkSize = Math.max(1, Math.ceil(activeTables.length / captains.length));
  console.log(
    JSON.stringify(
      {
        restaurantId,
        slug: SLUG,
        tableCount: activeTables.length,
        captainCount: captains.length,
        chunkSize,
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < captains.length; index += 1) {
    const captain = captains[index];
    const slice = activeTables.slice(index * chunkSize, (index + 1) * chunkSize);
    // Last captain gets any remainder
    const tableIds =
      index === captains.length - 1
        ? activeTables.slice(index * chunkSize).map((table) => table.id as string)
        : slice.map((table) => table.id as string);

    const previous = (captain.assignedTableIds as string[] | undefined) ?? [];
    await CaptainModel.updateOne(
      { restaurantId, id: captain.id },
      {
        $set: {
          assignedTableIds: tableIds,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    // Clear these tables from other captains
    await CaptainModel.updateMany(
      { restaurantId, id: { $ne: captain.id } },
      {
        $pull: { assignedTableIds: { $in: tableIds } },
        $set: { updatedAt: new Date().toISOString() },
      },
    );

    await captainAssignmentRepository.append({
      restaurantId,
      captainId: captain.id as string,
      tableIdsAdded: tableIds.filter((id) => !previous.includes(id)),
      tableIdsRemoved: previous.filter((id) => !tableIds.includes(id)),
      resultingTableIds: tableIds,
      changedBy: { role: "SUPER_ADMIN", id: "script-assign-triparna", email: "script@local" },
      note: "Auto-assign Triparna Kitchen captain sections",
    });

    const numbers = activeTables
      .filter((table) => tableIds.includes(table.id as string))
      .map((table) => table.tableNumber);
    console.log(`${captain.name} (${captain.email}) → tables ${numbers.join(", ") || "(none)"}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
