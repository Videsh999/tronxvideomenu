import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantBillingSettingsSchema } from "@/lib/validations";
import { restaurantService } from "@/lib/services/restaurant.service";
import { billingAuditRepository } from "@/lib/repositories/billing-audit.repository";

export async function GET() {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      billing: restaurant.billing ?? {},
      currency: restaurant.currency ?? "INR",
      audit: await billingAuditRepository.list(admin.restaurantId, 20),
    },
  });
}

export async function PUT(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  }

  const parsed = restaurantBillingSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const previous = restaurant.billing ?? {};
  const next = {
    ...previous,
    ...parsed.data,
    taxRatePercent:
      parsed.data.gstRatePercent ??
      parsed.data.taxRatePercent ??
      previous.taxRatePercent ??
      0,
    taxLabel: parsed.data.taxLabel ?? previous.taxLabel ?? "GST",
    updatedAt: new Date().toISOString(),
    updatedByEmail: admin.email,
  };

  const updated = await restaurantService.update(admin.restaurantId, {
    billing: next,
    currency: parsed.data.currency ?? restaurant.currency,
  });

  await billingAuditRepository.append({
    restaurantId: admin.restaurantId,
    action: "SETTINGS_SAVE",
    previous,
    next,
    actor: {
      id: admin.restaurantAdminAccountId ?? admin.email,
      email: admin.email,
      role: admin.role,
    },
  });

  return NextResponse.json({ success: true, data: updated?.billing ?? next });
}
