import Link from "next/link";
import { redirect } from "next/navigation";
import { getSuperAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import RestaurantsManager from "@/components/super-admin/RestaurantsManager";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const context = await getSuperAdminContext();

  if (!context || context.role !== "SUPER_ADMIN") {
    redirect("/super-admin/login");
  }

  const restaurants = await restaurantService.getAll();
  const credentialStatuses = await restaurantAdminService.getCredentialStatuses(restaurants);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            Platform
          </p>
          <h1 className="mt-1 text-2xl font-bold">TRONX Super Admin</h1>
          <p className="mt-1 text-sm text-white/55">
            Manage restaurant identity and platform availability.
          </p>
        </div>
        <Link
          href="/super-admin/restaurants/new"
          className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/85"
        >
          + Add Restaurant
        </Link>
      </header>
      <section id="restaurants" aria-label="Restaurants">
        <h2 className="border-b border-white/10 pb-3 text-sm font-semibold text-white/80">
          Restaurants
        </h2>
        <RestaurantsManager restaurants={restaurants} credentialStatuses={credentialStatuses} />
      </section>
    </div>
  );
}
