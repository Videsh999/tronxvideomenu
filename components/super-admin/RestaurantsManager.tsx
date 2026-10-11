"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Restaurant } from "@/types";
import type { RestaurantAdminCredentialStatus } from "@/types";
import RestaurantAdminCredentials from "@/components/super-admin/RestaurantAdminCredentials";

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
  const items = restaurants.filter((restaurant) => !deletedIds.includes(restaurant.id)).map((restaurant) => ({
    ...restaurant,
    ...(activeOverrides[restaurant.id] === undefined ? {} : { isActive: activeOverrides[restaurant.id] }),
  }));

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
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {items.map((restaurant) => (
        <article
          key={restaurant.id}
          className="flex flex-col gap-4 border-b border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">{restaurant.name}</h2>
            <p className="mt-1 text-sm text-white/55">
              Slug: {restaurant.slug}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {restaurant.isActive === false ? "Deactivated" : "Active"}
              {restaurant.isOpen ? " · Open for orders" : " · Closed"}
              {` · Subscription ${restaurant.subscriptionEnabled === false ? "OFF" : "ON"}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/super-admin/restaurants/${restaurant.id}/edit`}
              className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
            >
              Manage
            </Link>
            <Link
              href={`/menu/${restaurant.slug}`}
              target="_blank"
              className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/85"
            >
              View Menu
            </Link>
            <button
              type="button"
              disabled={pendingId === restaurant.id}
              onClick={() => void setActive(restaurant)}
              className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
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
              className="rounded-md border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
          {credentialStatuses.find((status) => status.restaurantId === restaurant.id) && <RestaurantAdminCredentials
            initialStatus={credentialStatuses.find((status) => status.restaurantId === restaurant.id)!}
            restaurantSlug={restaurant.slug}
          />}
        </article>
      ))}
      {items.length === 0 ? (
        <p className="py-8 text-sm text-white/55">No restaurants available.</p>
      ) : null}
    </div>
  );
}
