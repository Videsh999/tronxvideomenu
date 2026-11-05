import { notFound } from "next/navigation";
import InventoryManager from "@/components/admin/InventoryManager";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "INVENTORY").allowed) notFound();
  return <InventoryManager restaurantName={restaurant.name} restaurantSlug={restaurant.slug} />;
}
