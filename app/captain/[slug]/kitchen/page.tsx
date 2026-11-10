import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import CaptainKitchenBoard from "@/components/captain/CaptainKitchenBoard";

export const dynamic = "force-dynamic";

export default async function CaptainKitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/kitchen`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const kitchen = await orderService.listKitchen(captain.restaurantId);
  const scoped = kitchen.filter((order) => assigned.has(order.tableId));

  return (
    <CaptainKitchenBoard
      slug={slug}
      restaurantName={restaurant.name}
      initialOrders={scoped}
    />
  );
}
