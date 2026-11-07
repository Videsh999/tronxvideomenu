"use client";

import type { OrderSummary } from "@/types";
import KitchenKanban from "@/components/kitchen/KitchenKanban";

export default function KitchenDisplay({
  restaurantName,
  initialOrders,
}: {
  restaurantName: string;
  initialOrders: OrderSummary[];
}) {
  return (
    <KitchenKanban
      restaurantName={restaurantName}
      initialOrders={initialOrders}
      pollUrl="/api/kitchen/orders"
      statusUrl={(orderId) => `/api/orders/${orderId}`}
    />
  );
}
