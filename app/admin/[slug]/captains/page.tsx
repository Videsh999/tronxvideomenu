import { notFound, redirect } from "next/navigation";
import CaptainManagement from "@/components/admin/CaptainManagement";
import { getRestaurantAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function CaptainsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getRestaurantAdminContext();
  if (context?.role !== "RESTAURANT_ADMIN" || !context.restaurantId) redirect("/admin/login");
  const restaurant = await restaurantService.getById(context.restaurantId);
  if (!restaurant || restaurant.slug !== slug) redirect("/admin/login");
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) notFound();
  const tables = await tableRepository.findByRestaurantId(restaurant.id);
  return <CaptainManagement restaurantSlug={restaurant.slug} tables={tables} />;
}
