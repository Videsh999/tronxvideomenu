import { redirect, notFound } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { resolveStaticMerchantQrUrl } from "@/lib/upi-payment";
import { tableRepository } from "@/lib/repositories/table.repository";
import { orderService } from "@/lib/services/order.service";
import CaptainTableService from "@/components/captain/CaptainTableService";
import { tableSessionService } from "@/lib/services/table-session.service";

export const dynamic = "force-dynamic";

export default async function CaptainTableWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/tables/${tableId}`);

  if (!(captain.assignedTableIds ?? []).includes(tableId)) redirect(`/captain/${slug}/tables`);

  let [table, overview, tableOrders] = await Promise.all([
    tableRepository.findByRestaurantAndId(captain.restaurantId, tableId),
    tableSessionService.overview(captain.restaurantId, tableId),
    orderService.listOpenForTable(captain.restaurantId, tableId),
  ]);
  if (!table) notFound();
  if (!overview.session && tableOrders.some((order) => !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status))) {
    await tableSessionService.ensureActive({ restaurant, table, openedBy: { role: "CAPTAIN", id: captain.id, name: captain.name, email: captain.email } });
    overview = await tableSessionService.overview(captain.restaurantId, table.id);
  }
  const ordersById = new Map([...overview.orders, ...tableOrders].map((order) => [order.id, order]));
  const orders = [...ordersById.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const isTriparna = restaurant.name.toLowerCase().includes("triparna");
  return (
    <CaptainTableService
      slug={slug}
      restaurantName={restaurant.name}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
      upiSettings={{
        enabled: restaurant.billing?.upiEnabled === true || isTriparna,
        upiId: restaurant.billing?.upiId || (isTriparna ? "9133110805@okbizaxis" : ""),
        payeeName: restaurant.billing?.upiPayeeName || restaurant.name,
        staticQrUrl: resolveStaticMerchantQrUrl(restaurant.name, restaurant.billing?.upiStaticQrUrl),
      }}
      table={table}
      initialOrders={orders}
      initialSession={overview.session}
      initialBill={overview.bill}
    />
  );
}
