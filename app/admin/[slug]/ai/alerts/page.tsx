import { notFound } from "next/navigation";
import AiAlertsPanel from "@/components/admin/ai/AiAlertsPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AiAlertsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "AI_OPERATIONAL_ALERTS").allowed) {
    notFound();
  }
  return <AiAlertsPanel />;
}
