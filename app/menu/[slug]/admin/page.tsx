import { notFound, redirect } from "next/navigation";
import RestaurantPortalLogin from "@/components/auth/RestaurantPortalLogin";
import { getRestaurantAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

export default async function RestaurantAdminPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || restaurant.isActive === false) notFound();

  const context = await getRestaurantAdminContext();
  if (context?.role === "RESTAURANT_ADMIN" && context.restaurantSlug === slug) {
    redirect(`/admin/${slug}`);
  }

  return (
    <RestaurantPortalLogin
      kind="admin"
      slug={restaurant.slug}
      restaurantName={restaurant.name}
    />
  );
}
