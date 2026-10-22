import Link from "next/link";
import { Plus } from "lucide-react";
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Restaurants</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create and manage restaurant accounts on TRONX.
          </p>
        </div>
        <Link
          href="/super-admin/restaurants/new"
          className="bg-brand-gradient inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.22)] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Add restaurant
        </Link>
      </header>
      <RestaurantsManager restaurants={restaurants} credentialStatuses={credentialStatuses} />
    </div>
  );
}
