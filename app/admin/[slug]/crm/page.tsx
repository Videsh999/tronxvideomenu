import { notFound } from "next/navigation";
import CrmManager from "@/components/admin/CrmManager";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "CRM_LOYALTY").allowed) notFound();
  return <CrmManager restaurantName={restaurant.name} />;
}
