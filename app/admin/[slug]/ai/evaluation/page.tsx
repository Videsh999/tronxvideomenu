import { notFound } from "next/navigation";
import AiEvaluationPanel from "@/components/admin/ai/AiEvaluationPanel";
import { restaurantService } from "@/lib/services/restaurant.service";
import { hasRestaurantFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AiEvaluationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant) notFound();
  const allowed =
    hasRestaurantFeature(restaurant, "AI_BUSINESS_ASSISTANT") ||
    hasRestaurantFeature(restaurant, "AI_SALES_FORECAST");
  if (!allowed) notFound();
  return <AiEvaluationPanel />;
}
