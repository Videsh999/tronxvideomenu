import Link from "next/link";
import { redirect } from "next/navigation";
import RestaurantsManager from "@/components/super-admin/RestaurantsManager";
import { getSuperAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";

export const dynamic = "force-dynamic";

export default async function SuperAdminRestaurantsPage() {
  const context = await getSuperAdminContext();
  if (!context || context.role !== "SUPER_ADMIN")
    redirect("/super-admin/login");

  const restaurants = await restaurantService.getAll();
  const credentialStatuses = await restaurantAdminService.getCredentialStatuses(restaurants);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Restaurants</h1>
          <p className="mt-1 text-sm text-white/55">
            Create and manage restaurant accounts on TRONX.
          </p>
        </div>
        <Link
          href="/super-admin/restaurants/new"
          className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/85"
        >
          + Add Restaurant
        </Link>
      </header>
      <RestaurantsManager restaurants={restaurants} credentialStatuses={credentialStatuses} />
    </div>
  );
}
