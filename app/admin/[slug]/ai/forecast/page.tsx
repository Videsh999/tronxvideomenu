import { notFound } from "next/navigation";
import AiForecastPanel from "@/components/admin/ai/AiForecastPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AiForecastPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "AI_SALES_FORECAST").allowed) {
    notFound();
  }
  return <AiForecastPanel />;
}
