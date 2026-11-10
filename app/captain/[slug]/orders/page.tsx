import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import CaptainOrders from "@/components/captain/CaptainOrders";
import { resolveStaticMerchantQrUrl } from "@/lib/upi-payment";

export const dynamic = "force-dynamic";

export default async function CaptainOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const [activeOrders, doneOrders] = await Promise.all([
    orderService.listForRestaurant(captain.restaurantId),
    orderService.listDoneHistory(captain.restaurantId, 500),
  ]);
  const orders = [...activeOrders, ...doneOrders];
  const scoped = orders.filter(
    (order) => assigned.has(order.tableId),
  );

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Service</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Full table order history, items, status and visit duration.
        </p>
      </header>
      <CaptainOrders
        restaurantName={restaurant.name}
        initialOrders={scoped}
        upiSettings={{
          enabled: restaurant.billing?.upiEnabled === true || restaurant.name.toLowerCase().includes("triparna"),
          upiId: restaurant.billing?.upiId ?? "",
          payeeName: restaurant.billing?.upiPayeeName || restaurant.name,
          staticQrUrl: resolveStaticMerchantQrUrl(restaurant.name, restaurant.billing?.upiStaticQrUrl),
        }}
      />
    </div>
  );
}
