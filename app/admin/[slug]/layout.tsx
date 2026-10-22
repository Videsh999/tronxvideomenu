import { redirect } from "next/navigation";
import { getRestaurantAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";

export default async function RestaurantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getRestaurantAdminContext();
  if (!context || context.role !== "RESTAURANT_ADMIN") {
    redirect(`/api/auth/logout?role=RESTAURANT_ADMIN&next=${encodeURIComponent(`/admin/${slug}`)}`);
  }

  const restaurant = await restaurantService.getBySlug(slug);
  if (
    !restaurant ||
    restaurant.isActive === false ||
    restaurant.id !== context.restaurantId ||
    restaurant.slug !== context.restaurantSlug
  ) {
    redirect(`/api/auth/logout?role=RESTAURANT_ADMIN&next=${encodeURIComponent(`/admin/${slug}`)}`);
  }

  return children;
}
