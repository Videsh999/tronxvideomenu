import AdminShell from "@/components/admin/AdminShell";
import { getRestaurantAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { getAllRestaurantFeatures } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getRestaurantAdminContext();
  const restaurant = context?.role === "RESTAURANT_ADMIN" && context.restaurantId
    ? await restaurantService.getById(context.restaurantId)
    : null;
  const features = restaurant
    ? getAllRestaurantFeatures(restaurant)
    : getAllRestaurantFeatures({
        id: "",
        name: "",
        slug: "",
        isOpen: false,
        subscriptionEnabled: false,
      });
  return (
    <AdminShell
      features={features}
      restaurantIsOpen={restaurant?.isOpen ?? false}
      restaurantName={restaurant?.name}
      restaurantLogoUrl={restaurant?.logoUrl ?? restaurant?.logo}
    >
      {children}
    </AdminShell>
  );
}
