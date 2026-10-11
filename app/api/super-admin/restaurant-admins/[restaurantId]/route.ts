import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";
import { restaurantAdminCredentialSchema, restaurantAdminStatusSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
type Context = { params: Promise<{ restaurantId: string }> };

export async function PUT(request: Request, context: Context) {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { restaurantId } = await context.params;
  if (!await restaurantService.getById(restaurantId)) {
    return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
  }
  const parsed = restaurantAdminCredentialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Enter a valid email and a password with at least 8 characters." }, { status: 400, headers: noStore });
  try {
    const status = await restaurantAdminService.setCredentials(restaurantId, parsed.data);
    return status
      ? NextResponse.json({ success: true, data: status }, { headers: noStore })
      : NextResponse.json({ success: false, error: "Unable to save administrator credentials." }, { status: 500, headers: noStore });
  } catch (cause) {
    const message = cause instanceof CredentialEncryptionConfigurationError
      ? cause.message
      : "Unable to save administrator credentials.";
    return NextResponse.json({ success: false, error: message }, { status: cause instanceof CredentialEncryptionConfigurationError ? 503 : 500, headers: noStore });
  }
}

export async function PATCH(request: Request, context: Context) {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { restaurantId } = await context.params;
  const parsed = restaurantAdminStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid account status." }, { status: 400, headers: noStore });
  const status = await restaurantAdminService.setActive(restaurantId, parsed.data.isActive);
  return status
    ? NextResponse.json({ success: true, data: status }, { headers: noStore })
    : NextResponse.json({ success: false, error: "Administrator account not found." }, { status: 404, headers: noStore });
}
