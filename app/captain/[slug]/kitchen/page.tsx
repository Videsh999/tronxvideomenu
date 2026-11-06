import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import CaptainKitchenBoard from "@/components/captain/CaptainKitchenBoard";

export const dynamic = "force-dynamic";

export default async function CaptainKitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/kitchen`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const [kitchen, tables] = await Promise.all([
    orderService.listKitchen(captain.restaurantId),
    tableService.list(captain.restaurantId),
  ]);
  const assignedNumbers = new Set(
    tables.filter((table) => assigned.has(table.id)).map((table) => table.tableNumber),
  );
  const scoped = kitchen.filter((order) => assignedNumbers.has(order.tableNumber));

  return (
    <CaptainKitchenBoard
      slug={slug}
      restaurantName={restaurant.name}
      initialOrders={scoped}
    />
  );
}
