"use client";

import type { OrderSummary } from "@/types";
import KitchenKanban from "@/components/kitchen/KitchenKanban";

export default function CaptainKitchenBoard({
  restaurantName,
  initialOrders,
}: {
  slug: string;
  restaurantName: string;
  initialOrders: OrderSummary[];
}) {
  return (
    <KitchenKanban
      restaurantName={restaurantName}
      initialOrders={initialOrders}
      pollUrl="/api/captain/kitchen"
      statusUrl={(orderId) => `/api/captain/orders/${orderId}`}
    />
  );
}
