import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import CaptainTables from "@/components/captain/CaptainTables";

export const dynamic = "force-dynamic";

export default async function CaptainTablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const [tables, orders] = await Promise.all([
    tableService.list(captain.restaurantId),
    orderService.listForRestaurant(captain.restaurantId),
  ]);

  return (
    <CaptainTables
      slug={slug}
      initialTables={tables}
      initialOrders={orders}
      assignedTableIds={captain.assignedTableIds ?? []}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
    />
  );
}
