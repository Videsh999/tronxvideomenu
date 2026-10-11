import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" };

export async function POST(_request: Request, context: { params: Promise<{ captainId: string }> }) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });
  try {
    const { captainId } = await context.params;
    const credential = await captainService.getSavedPassword({ role: admin.role, restaurantId: admin.restaurantId }, captainId);
    if (!credential) return NextResponse.json({ success: false, error: "Captain not found." }, { status: 404, headers: noStore });
    if (!credential.passwordConfigured) return NextResponse.json({ success: false, error: "This Captain has no recoverable saved password. Set a new password explicitly." }, { status: 409, headers: noStore });
    return NextResponse.json({ success: true, data: { password: credential.password } }, { headers: noStore });
  } catch (cause) {
    const message = cause instanceof CredentialEncryptionConfigurationError
      ? cause.message
      : "Unable to retrieve Captain credentials.";
    return NextResponse.json({ success: false, error: message }, { status: cause instanceof CredentialEncryptionConfigurationError ? 503 : 500, headers: noStore });
  }
}
