import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { canManageRestaurantAdminCredentials } from "@/lib/security/credential-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" };

export async function POST(_request: Request, context: { params: Promise<{ restaurantId: string }> }) {
  const { admin, error } = await requireSuperAdmin();
  if (error) return error;
  if (!canManageRestaurantAdminCredentials(admin.role)) return NextResponse.json({ success: false, error: "This account is not permitted to verify these credentials." }, { status: 403, headers: noStore });
  try {
    const { restaurantId } = await context.params;
    const verification = await restaurantAdminService.verifyDatabaseCredentials(restaurantId);
    return NextResponse.json({ success: true, data: verification }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to verify database credentials." },
      { status: 500, headers: noStore },
    );
  }
}
