"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Restaurant, SubscriptionPlan } from "@/types";
import type { RestaurantAdminCredentialStatus } from "@/types";
import { ExternalLink, Power, Search, Settings2, Trash2 } from "lucide-react";
import RestaurantAdminCredentials from "@/components/super-admin/RestaurantAdminCredentials";
import SmartImage from "@/components/shared/SmartImage";

type PlanFilter = "ALL" | SubscriptionPlan;
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function RestaurantsManager({
  restaurants,
  credentialStatuses,
}: {
  restaurants: Restaurant[];
  credentialStatuses: RestaurantAdminCredentialStatus[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");

  const items = restaurants
    .filter((restaurant) => !deletedIds.includes(restaurant.id))
    .map((restaurant) => ({
      ...restaurant,
      ...(activeOverrides[restaurant.id] === undefined ? {} : { isActive: activeOverrides[restaurant.id] }),
    }));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((restaurant) => {
      if (planFilter !== "ALL" && (restaurant.subscriptionPlan ?? "PRO") !== planFilter) return false;
      const isActive = restaurant.isActive !== false;
      if (activeFilter === "ACTIVE" && !isActive) return false;
      if (activeFilter === "INACTIVE" && isActive) return false;
      if (!needle) return true;
      const haystack = [
        restaurant.name,
        restaurant.slug,
        restaurant.address,
        restaurant.phone,
        restaurant.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, planFilter, activeFilter]);

  const setActive = async (restaurant: Restaurant) => {
    setPendingId(restaurant.id);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: restaurant.isActive === false }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Restaurant update failed");
      }
      setActiveOverrides((current) => ({ ...current, [restaurant.id]: restaurant.isActive === false }));
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Restaurant update failed",
      );
    } finally {
      setPendingId(null);
    }
  };

  const deleteRestaurant = async (restaurant: Restaurant) => {
    if (
      !window.confirm(
        `Permanently delete ${restaurant.name} and its menu and media records? This cannot be undone.`,
      )
    ) {
      return;
    }

    setPendingId(restaurant.id);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Restaurant could not be deleted");
      }
      setDeletedIds((current) => [...new Set([...current, restaurant.id])]);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Restaurant could not be deleted",
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="relative min-w-0 flex-1 space-y-1 text-xs font-medium text-neutral-600">
          Search restaurants
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, slug, address, phone…"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="space-y-1 text-xs font-medium text-neutral-600">
            Plan
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value as PlanFilter)}
              className="block rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900"
            >
              <option value="ALL">All plans</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">
            Status
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
              className="block rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Deactivated</option>
            </select>
          </label>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Showing {filtered.length} of {items.length} restaurants · Manage → Plan & features includes Offers & Discounts
      </p>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
      {filtered.map((restaurant) => {
        const credentialStatus = credentialStatuses.find((status) => status.restaurantId === restaurant.id);
        const logo = restaurant.logoUrl ?? restaurant.logo;
        return (
          <article
            key={restaurant.id}
            id={`restaurant-${restaurant.slug}`}
            className="scroll-mt-24 overflow-hidden rounded-3xl border border-neutral-200 bg-white target:border-neutral-900 target:ring-2 target:ring-neutral-900/10"
          >
            <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                  {logo ? <SmartImage src={logo} alt="" sizes="56px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-lg font-bold">{restaurant.name.charAt(0)}</span>}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{restaurant.name}</h2>
                  <p className="mt-0.5 truncate font-mono text-xs text-neutral-500">/{restaurant.slug}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className={`rounded-full px-2 py-0.5 ${restaurant.isActive === false ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>{restaurant.isActive === false ? "Deactivated" : "Active"}</span>
                    <span className={`rounded-full px-2 py-0.5 ${restaurant.isOpen ? "bg-sky-50 text-sky-700" : "bg-neutral-100 text-neutral-500"}`}>{restaurant.isOpen ? "Open for orders" : "Closed"}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">Subscription {restaurant.subscriptionEnabled === false ? "off" : "on"}{restaurant.subscriptionPlan ? ` · ${restaurant.subscriptionPlan}` : ""}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Link
                  href={`/super-admin/restaurants/${restaurant.id}/edit`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Manage
                </Link>
                <Link
                  href={`/menu/${restaurant.slug}`}
                  target="_blank"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View menu
                </Link>
                <button
                  type="button"
                  disabled={pendingId === restaurant.id}
                  onClick={() => void setActive(restaurant)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
                >
                  <Power className="h-3.5 w-3.5" />
                  {pendingId === restaurant.id
                    ? "Saving..."
                    : restaurant.isActive === false
                      ? "Reactivate"
                      : "Deactivate"}
                </button>
                <button
                  type="button"
                  disabled={pendingId === restaurant.id}
                  onClick={() => void deleteRestaurant(restaurant)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
            {credentialStatus && (
              <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:px-6">
                <RestaurantAdminCredentials
                  initialStatus={credentialStatus}
                  restaurantSlug={restaurant.slug}
                />
              </div>
            )}
          </article>
        );
      })}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 px-6 py-14 text-center">
          <p className="text-sm text-neutral-500">
            {items.length === 0 ? "No restaurants available." : "No restaurants match this search."}
          </p>
          {items.length === 0 ? (
            <Link href="/super-admin/restaurants/new" className="mt-4 inline-flex h-10 items-center rounded-xl bg-neutral-900 px-4 text-xs font-bold text-white">Add your first restaurant</Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPlanFilter("ALL");
                setActiveFilter("ALL");
              }}
              className="mt-4 inline-flex h-10 items-center rounded-xl border border-neutral-300 px-4 text-xs font-bold text-neutral-700"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
