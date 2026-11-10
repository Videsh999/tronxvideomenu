import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import CaptainApprovals from "@/components/captain/CaptainApprovals";

export const dynamic = "force-dynamic";

export default async function CaptainApprovalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/approvals`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const pending = await orderService.listPendingCaptainApprovals(
    captain.restaurantId,
    [...assigned],
  );

  return (
    <CaptainApprovals
      initialOrders={pending}
      currency={restaurant.currency ?? restaurant.billing?.currency ?? "INR"}
    />
  );
}
