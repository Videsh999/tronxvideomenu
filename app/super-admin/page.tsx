import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, CircleDot, Plus, Power, Store } from "lucide-react";
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
  const stats = [
    { label: "Restaurants", value: restaurants.length, icon: Store, tone: "text-neutral-900" },
    { label: "Active", value: restaurants.filter((restaurant) => restaurant.isActive !== false).length, icon: BadgeCheck, tone: "text-emerald-700" },
    { label: "Open now", value: restaurants.filter((restaurant) => restaurant.isActive !== false && restaurant.isOpen).length, icon: CircleDot, tone: "text-sky-700" },
    { label: "Subscriptions on", value: restaurants.filter((restaurant) => restaurant.subscriptionEnabled !== false).length, icon: Power, tone: "text-neutral-900" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Platform</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">TRONX Super Admin</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage restaurant identity, plans, credentials, and platform availability.
          </p>
        </div>
        <Link
          href="/super-admin/restaurants/new"
          className="bg-brand-gradient inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.22)] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Add restaurant
        </Link>
      </header>

      <section aria-label="Platform metrics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500">{label}</p>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
          </article>
        ))}
      </section>

      <section id="restaurants" aria-label="Restaurants" className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-700">Restaurants</h2>
        <RestaurantsManager restaurants={restaurants} credentialStatuses={credentialStatuses} />
      </section>
    </div>
  );
}
