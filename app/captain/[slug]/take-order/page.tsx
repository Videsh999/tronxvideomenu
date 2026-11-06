import { requireCaptain } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import CaptainOrderPad from "@/components/captain/CaptainOrderPad";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CaptainTakeOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  const { slug } = await params;
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain) redirect(`/captain/login?next=/captain/${slug}/take-order`);

  const menu = await restaurantService.getFullMenu(slug);
  if (!menu || menu.restaurant.id !== captain.restaurantId) redirect(`/captain/${slug}`);

  const assignedIds = new Set(captain.assignedTableIds ?? []);
  const allTables = await tableRepository.findByRestaurantId(captain.restaurantId);
  const tables = allTables.filter(
    (table) => table.isActive && table.status !== "CLOSED" && assignedIds.has(table.id),
  );

  const rawTable = (await searchParams).table;
  const tableValue = Array.isArray(rawTable) ? rawTable[0] : rawTable;
  const initialTableNumber =
    tableValue && /^\d{1,4}$/.test(tableValue) ? Number(tableValue) : null;

  return (
    <CaptainOrderPad
      slug={slug}
      currency={menu.restaurant.currency ?? "INR"}
      taxRatePercent={
        menu.restaurant.billing?.gstRatePercent ??
        menu.restaurant.billing?.taxRatePercent ??
        0
      }
      taxLabel={menu.restaurant.billing?.taxLabel ?? "Tax"}
      categories={menu.categories.filter((category) => category.isActive)}
      dishes={menu.dishes}
      tables={tables}
      initialTableNumber={initialTableNumber}
      permissions={captain.permissions}
    />
  );
}
