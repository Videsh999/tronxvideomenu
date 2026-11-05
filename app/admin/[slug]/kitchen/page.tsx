import { notFound } from "next/navigation";
import KitchenDisplay from "@/components/admin/KitchenDisplay";
import { restaurantService } from "@/lib/services/restaurant.service";
import { orderService } from "@/lib/services/order.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function KitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "KITCHEN_DISPLAY").allowed) {
    notFound();
  }
  const initialOrders = await orderService.listKitchen(restaurant.id);
  return (
    <KitchenDisplay
      restaurantName={restaurant.name}
      initialOrders={initialOrders}
    />
  );
}
