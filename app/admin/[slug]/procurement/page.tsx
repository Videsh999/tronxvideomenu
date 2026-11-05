import { notFound } from "next/navigation";
import ProcurementManager from "@/components/admin/ProcurementManager";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function ProcurementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "PROCUREMENT").allowed) notFound();
  return <ProcurementManager restaurantName={restaurant.name} />;
}
