import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import CaptainApprovals from "@/components/captain/CaptainApprovals";

export const dynamic = "force-dynamic";

export default async function CaptainApprovalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/approvals`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const tables = await tableService.list(captain.restaurantId);
  const tableNumbers = tables
    .filter((table) => assigned.has(table.id))
    .map((table) => table.tableNumber);
  const pending = await orderService.listPendingCaptainApprovals(
    captain.restaurantId,
    tableNumbers,
  );

  return (
    <CaptainApprovals
      initialOrders={pending}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
    />
  );
}
