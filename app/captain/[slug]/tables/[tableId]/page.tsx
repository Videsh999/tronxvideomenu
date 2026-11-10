import { redirect, notFound } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { serviceRequestService } from "@/lib/services/service-request.service";
import CaptainTableWorkspace from "@/components/captain/CaptainTableWorkspace";
import { tableSessionService } from "@/lib/services/table-session.service";
import { resolveStaticMerchantQrUrl } from "@/lib/upi-payment";

export const dynamic = "force-dynamic";

export default async function CaptainTableWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = await params;
  const { captain, restaurant, error } = await requireCaptain("TABLE_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/tables/${tableId}`);

  try {
    await captainService.assertCaptainMayServeTable(captain.id, captain.restaurantId, tableId);
  } catch {
    redirect(`/captain/${slug}/tables`);
  }

  const table = await tableRepository.findByRestaurantAndId(captain.restaurantId, tableId);
  if (!table) notFound();
  const availableTables = (await tableRepository.findByRestaurantId(captain.restaurantId)).filter((row) => captain.assignedTableIds?.includes(row.id));

  let overview = await tableSessionService.overview(captain.restaurantId, table.id);
  if (!overview.session && table.status !== "OPEN") {
    await tableSessionService.ensureActive({ restaurant, table, openedBy: { role: "CAPTAIN", id: captain.id, name: captain.name, email: captain.email } });
    overview = await tableSessionService.overview(captain.restaurantId, table.id);
  }
  const activeOrder = [...overview.orders].reverse().find((order) => !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)) ?? null;
  const requests = await serviceRequestService.listForTable(captain.restaurantId, tableId);

  return (
    <CaptainTableWorkspace
      slug={slug}
      restaurantName={restaurant.name}
      captainName={captain.name}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
      initialTable={table}
      availableTables={availableTables}
      initialOrder={activeOrder}
      initialOrders={overview.orders}
      initialSession={overview.session}
      initialBill={overview.bill}
      initialRequests={requests}
      upiSettings={{ enabled: restaurant.billing?.upiEnabled === true || restaurant.name.toLowerCase().includes("triparna"), upiId: restaurant.billing?.upiId ?? "", payeeName: restaurant.billing?.upiPayeeName || restaurant.name, staticQrUrl: resolveStaticMerchantQrUrl(restaurant.name, restaurant.billing?.upiStaticQrUrl) }}
    />
  );
}
