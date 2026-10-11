import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(_request: Request, context: { params: Promise<{ restaurantId: string }> }) {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  try {
    const { restaurantId } = await context.params;
    const status = await restaurantAdminService.migrateLegacyCredentials(restaurantId);
    if (!status) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
    if (status.credentialSource !== "DATABASE") {
      return NextResponse.json({ success: false, error: "No complete legacy credentials are configured for this restaurant." }, { status: 409, headers: noStore });
    }
    return NextResponse.json({ success: true, data: status }, { headers: noStore });
  } catch (cause) {
    const message = cause instanceof CredentialEncryptionConfigurationError
      ? cause.message
      : "Unable to migrate administrator credentials.";
    return NextResponse.json({ success: false, error: message }, { status: cause instanceof CredentialEncryptionConfigurationError ? 503 : 500, headers: noStore });
  }
}
