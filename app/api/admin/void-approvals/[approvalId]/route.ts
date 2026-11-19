import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { floorTransferService } from "@/lib/services/floor-transfer.service";
import { OrderServiceError } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";

/** A restaurant admin approves a captain void. The approver and the reason are stored. */
export async function POST(_request: Request, context: { params: Promise<{ approvalId: string }> }) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return error ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { approvalId } = await context.params;
  try {
    const data = await floorTransferService.approveVoid({
      restaurantId: admin.restaurantId,
      approvalId,
      approver: {
        role: "RESTAURANT_ADMIN",
        id: admin.restaurantAdminAccountId ?? admin.email,
        name: admin.email,
        email: admin.email,
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to approve the void." }, { status: 500 });
  }
}
