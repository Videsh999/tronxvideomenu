import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  try {
    const restaurants = await restaurantService.getAll();
    const statuses = await restaurantAdminService.getCredentialStatuses(restaurants);
    return NextResponse.json({ success: true, data: statuses }, { headers: noStore });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load administrator account status." }, { status: 500, headers: noStore });
  }
}
