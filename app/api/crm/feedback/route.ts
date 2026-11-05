import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { crmService, CrmServiceError } from "@/lib/services/crm.service";
import { customerFeedbackSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  const data = await crmService.listFeedback(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  try {
    const parsed = customerFeedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await crmService.createFeedback(auth.restaurantId, parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to save feedback." }, { status: 500 });
  }
}
