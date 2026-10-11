import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { createCaptainSchema } from "@/lib/validations";
import { CredentialEncryptionConfigurationError } from "@/lib/security/credential-crypto";

async function authorize() {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return { admin: null, error } as const;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return { admin: null, error: NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 }) } as const;
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) return { admin: null, error: NextResponse.json({ success: false, error: feature.reason }, { status: 403 }) } as const;
  return { admin, error: null } as const;
}

export async function GET() {
  const { admin, error } = await authorize();
  if (error) return error;
  try {
    return NextResponse.json({ success: true, data: await captainService.list(admin.restaurantId) });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load Captains" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { admin, error } = await authorize();
  if (error) return error;
  try {
    const input = createCaptainSchema.parse(await request.json());
    const captain = await captainService.create(admin.restaurantId, input);
    return NextResponse.json({ success: true, data: captain }, { status: 201 });
  } catch (cause) {
    const validation = cause && typeof cause === "object" && "issues" in cause;
    const duplicate = cause && typeof cause === "object" && "code" in cause && cause.code === 11000;
    const encryptionUnavailable = cause instanceof CredentialEncryptionConfigurationError;
    return NextResponse.json({ success: false, error: validation ? "Validation failed" : duplicate ? "A Captain with this email already exists for this restaurant." : encryptionUnavailable ? cause.message : "Unable to create Captain" }, { status: validation ? 400 : duplicate ? 409 : encryptionUnavailable ? 503 : 500 });
  }
}
