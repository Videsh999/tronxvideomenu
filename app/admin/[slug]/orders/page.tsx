import { notFound } from "next/navigation";
import OrdersManager from "@/components/admin/OrdersManager";
import { orderService } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function RestaurantOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "ORDER_MANAGEMENT").allowed) notFound();
  const initialOrders = await orderService.listForRestaurant(slug);
  return <OrdersManager restaurantName={restaurant.name} initialOrders={initialOrders} />;
}
