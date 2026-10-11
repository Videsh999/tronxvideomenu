import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { resetCaptainPasswordSchema } from "@/lib/validations";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";

export async function POST(request: Request, context: { params: Promise<{ captainId: string }> }) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  try {
    const input = resetCaptainPasswordSchema.parse(await request.json());
    const { captainId } = await context.params;
    const captain = await captainService.resetPassword(admin.restaurantId, captainId, input.password);
    return captain ? NextResponse.json({ success: true, data: captain }) : NextResponse.json({ success: false, error: "Captain not found" }, { status: 404 });
  } catch (cause) {
    const encryptionUnavailable = cause instanceof CredentialEncryptionConfigurationError;
    return NextResponse.json({ success: false, error: encryptionUnavailable ? cause.message : "Invalid password reset" }, { status: encryptionUnavailable ? 503 : 400 });
  }
}
