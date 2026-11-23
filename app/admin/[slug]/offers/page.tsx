import { notFound } from "next/navigation";
import OffersManager from "@/components/admin/OffersManager";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function OffersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "MENU_OFFERS").allowed) notFound();
  return <OffersManager restaurantName={restaurant.name} restaurantId={restaurant.id} />;
}
