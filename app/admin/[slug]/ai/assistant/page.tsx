import { notFound } from "next/navigation";
import AiAssistantPanel from "@/components/admin/ai/AiAssistantPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "AI_BUSINESS_ASSISTANT").allowed) {
    notFound();
  }
  return <AiAssistantPanel />;
}
