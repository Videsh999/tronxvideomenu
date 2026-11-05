import { notFound } from "next/navigation";
import AiIntelligenceShell from "@/components/admin/ai/AiIntelligenceShell";
import { restaurantService } from "@/lib/services/restaurant.service";
import { hasRestaurantFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant) notFound();
  const anyAi =
    hasRestaurantFeature(restaurant, "AI_BUSINESS_ASSISTANT") ||
    hasRestaurantFeature(restaurant, "AI_SALES_FORECAST") ||
    hasRestaurantFeature(restaurant, "AI_INVENTORY_INTELLIGENCE") ||
    hasRestaurantFeature(restaurant, "AI_MENU_INTELLIGENCE") ||
    hasRestaurantFeature(restaurant, "AI_OPERATIONAL_ALERTS");
  if (!anyAi) notFound();
  return <AiIntelligenceShell slug={slug}>{children}</AiIntelligenceShell>;
}
