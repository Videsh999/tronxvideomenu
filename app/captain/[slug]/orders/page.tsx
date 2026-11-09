import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import CaptainOrders from "@/components/captain/CaptainOrders";
import { resolveStaticMerchantQrUrl } from "@/lib/upi-payment";

export const dynamic = "force-dynamic";

export default async function CaptainOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const [orders, tables] = await Promise.all([
    orderService.listForRestaurant(captain.restaurantId),
    tableService.list(captain.restaurantId),
  ]);
  const assignedNumbers = new Set(
    tables.filter((table) => assigned.has(table.id)).map((table) => table.tableNumber),
  );
  const scoped = orders.filter(
    (order) =>
      assignedNumbers.has(order.tableNumber) &&
      !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status),
  );

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Service</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Active orders</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Orders on your assigned tables only. Prefer the table workspace for add-items and bill handoff.
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
