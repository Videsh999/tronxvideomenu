import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";
import { canManageRestaurantAdminCredentials } from "@/lib/security/credential-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" };

export async function POST(_request: Request, context: { params: Promise<{ restaurantId: string }> }) {
  const { admin, error } = await requireSuperAdmin();
  if (error) return error;
  if (!canManageRestaurantAdminCredentials(admin.role)) return NextResponse.json({ success: false, error: "This account is not permitted to retrieve these credentials." }, { status: 403, headers: noStore });
  try {
    const { restaurantId } = await context.params;
    const credentials = await restaurantAdminService.getPassword(restaurantId);
    if (!credentials) return NextResponse.json({ success: false, error: "A recoverable password is not available. Set a new password explicitly." }, { status: 409, headers: noStore });
    return NextResponse.json({ success: true, data: credentials }, { headers: noStore });
  } catch (cause) {
    const message = cause instanceof CredentialEncryptionConfigurationError
      ? cause.message
      : "Unable to retrieve administrator credentials.";
    return NextResponse.json({ success: false, error: message }, { status: cause instanceof CredentialEncryptionConfigurationError ? 503 : 500, headers: noStore });
  }
}
