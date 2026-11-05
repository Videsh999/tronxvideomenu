import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import {
  procurementService,
  ProcurementServiceError,
} from "@/lib/services/procurement.service";
import { receivePurchaseOrderSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ poId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireOutletPermission({
    feature: "PROCUREMENT",
    permission: "OUTLET_PROCUREMENT_RECEIVE",
  });
  if (!auth.ok) return auth.response;
  try {
    const { poId } = await params;
    const parsed = receivePurchaseOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await procurementService.receivePurchaseOrder(auth.restaurantId, poId, {
      ...parsed.data,
      actor: {
        role: "RESTAURANT_ADMIN",
        id: auth.accountId,
        email: auth.email,
        name: auth.email,
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ProcurementServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to receive goods." }, { status: 500 });
  }
}
