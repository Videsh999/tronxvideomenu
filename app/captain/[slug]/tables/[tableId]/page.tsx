import { redirect, notFound } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { orderService } from "@/lib/services/order.service";
import { serviceRequestService } from "@/lib/services/service-request.service";
import CaptainTableWorkspace from "@/components/captain/CaptainTableWorkspace";

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

  const [activeOrder, requests] = await Promise.all([
    orderService.findActiveForTable(captain.restaurantId, table.tableNumber),
    serviceRequestService.listForTable(captain.restaurantId, tableId),
  ]);

  return (
    <CaptainTableWorkspace
      slug={slug}
      captainName={captain.name}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
      initialTable={table}
      initialOrder={activeOrder}
      initialRequests={requests}
    />
  );
}
