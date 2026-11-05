import { notFound } from "next/navigation";
import AiMenuPanel from "@/components/admin/ai/AiMenuPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AiMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "AI_MENU_INTELLIGENCE").allowed) {
    notFound();
  }
  return <AiMenuPanel />;
}
