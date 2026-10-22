"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Dish, Restaurant } from "@/types";
import { api } from "@/lib/api";

type AvailabilityManagerProps = {
  initialDishes: Dish[];
  restaurant: Restaurant;
};

export default function AvailabilityManager({
  initialDishes,
  restaurant: initialRestaurant,
}: AvailabilityManagerProps) {
  const router = useRouter();
  const [dishes, setDishes] = useState(initialDishes);
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restaurantPending, setRestaurantPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const toggle = async (dish: Dish) => {
    setPendingId(dish.id);
    try {
      const updated = await api.updateDish(dish.id, {
        isAvailable: !dish.isAvailable,
      });
      setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setFeedback({
        type: "success",
        message: `${dish.name} availability updated.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setPendingId(null);
    }
  };

  const toggleRestaurant = async () => {
    setRestaurantPending(true);
    setFeedback(null);
    try {
      const updated = await api.updateRestaurant(restaurant.id, {
        isOpen: !restaurant.isOpen,
      });
      setRestaurant(updated);
      setFeedback({
        type: "success",
        message: `Restaurant marked ${updated.isOpen ? "open" : "closed"}.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setRestaurantPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Availability & 86 Hub
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Instantly mark sold-out items or hide whole categories from customers
          in real time.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Restaurant status</p>
          <p className="mt-1 text-xs text-neutral-500">
            Controls whether the restaurant is currently open to customers.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleRestaurant}
          disabled={restaurantPending}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            restaurant.isOpen
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
              : "bg-rose-50 text-rose-600 hover:bg-rose-50"
          }`}
        >
          {restaurant.isOpen ? "Open" : "Closed"}
        </button>
      </div>

      {feedback ? (
        <p
          role="status"
          className={`text-sm ${
            feedback.type === "success" ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">
            {dishes.filter((d) => d.isAvailable).length} of {dishes.length}{" "}
            dishes in stock
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          Changes reflect on the customer menu after refresh or tab focus
        </span>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Dishes Stock Status
        </h2>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className="flex items-center justify-between p-4 transition hover:bg-white"
            >
              <div>
                <span className="font-semibold text-neutral-900 text-sm">
                  {dish.name}
                </span>
                <span className="ml-2 text-xs font-mono text-neutral-400">
                  ₹{dish.price}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {dish.isAvailable ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                    <XCircle className="h-3.5 w-3.5" />
                    Sold Out
                  </span>
                )}

                <button
                  type="button"
                  disabled={pendingId === dish.id}
                  onClick={() => toggle(dish)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                >
                  Toggle
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
