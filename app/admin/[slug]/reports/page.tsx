import { notFound } from "next/navigation";
import ReportsDashboard from "@/components/admin/ReportsDashboard";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant) notFound();
  const analytics = requireRestaurantFeature(restaurant, "ANALYTICS").allowed;
  const orders = requireRestaurantFeature(restaurant, "ORDER_MANAGEMENT").allowed;
  if (!analytics && !orders) notFound();
  return <ReportsDashboard restaurantName={restaurant.name} />;
}
