import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { crmService, CrmServiceError } from "@/lib/services/crm.service";
import { upsertCustomerSchema } from "@/lib/validations";
import { sessionOwnsOutlet } from "@/lib/security/outlet-scope";

export async function GET(request: Request) {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const requestedOutlet = url.searchParams.get("restaurantId");
  if (requestedOutlet && !sessionOwnsOutlet(auth.restaurantId, requestedOutlet)) {
    return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  }
  const query = url.searchParams.get("q") ?? undefined;
  const data = await crmService.listCustomers(auth.restaurantId, query);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  try {
    const parsed = upsertCustomerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await crmService.upsertCustomer(auth.restaurantId, {
      ...parsed.data,
      email: parsed.data.email || undefined,
      organizationId: auth.restaurant.organizationId,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to save customer." }, { status: 500 });
  }
}
