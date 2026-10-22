import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import CaptainOrders from "@/components/captain/CaptainOrders";

export const dynamic = "force-dynamic";

export default async function CaptainOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);
  return (
    <CaptainOrders
      restaurantName={restaurant.name}
      initialOrders={await orderService.listForRestaurant(captain.restaurantId)}
    />
  );
}
