import AvailabilityManager from "@/components/admin/AvailabilityManager";
import { dishService } from "@/lib/services/dish.service";
import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

export default async function RestaurantAvailabilitySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [dishes, restaurant] = await Promise.all([
    dishService.getByRestaurantId(slug),
    restaurantService.getById(slug),
  ]);

  if (!restaurant) {
    return <p className="text-sm text-neutral-500">Restaurant not found.</p>;
  }

  return <AvailabilityManager initialDishes={dishes} restaurant={restaurant} />;
}
