import { notFound } from "next/navigation";
import AiInventoryPanel from "@/components/admin/ai/AiInventoryPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AiInventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "AI_INVENTORY_INTELLIGENCE").allowed) {
    notFound();
  }
  return <AiInventoryPanel />;
}
