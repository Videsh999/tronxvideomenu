import { notFound } from "next/navigation";
import OrganizationDashboard from "@/components/admin/OrganizationDashboard";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "MULTI_OUTLET").allowed) notFound();
  return <OrganizationDashboard restaurantName={restaurant.name} />;
}
