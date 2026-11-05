import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { dishRepository } from "@/lib/repositories/dish.repository";
import { billingAuditRepository } from "@/lib/repositories/billing-audit.repository";

const schema = z
  .object({
    gstRatePercent: z.number().min(0).max(100),
    scope: z.enum(["ALL", "CATEGORIES", "DISHES"]),
    categoryIds: z.array(z.string()).optional(),
    dishIds: z.array(z.string()).optional(),
    replaceOverrides: z.boolean().default(false),
    previewOnly: z.boolean().default(false),
  })
  .strict();

export async function POST(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid bulk tax request" }, { status: 400 });
  }

  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  }

  const dishes = await dishRepository.findByRestaurantId(admin.restaurantId);
  let candidates = dishes;
  if (parsed.data.scope === "CATEGORIES") {
    const ids = new Set(parsed.data.categoryIds ?? []);
    candidates = dishes.filter((dish) => ids.has(dish.categoryId));
  } else if (parsed.data.scope === "DISHES") {
    const ids = new Set(parsed.data.dishIds ?? []);
    candidates = dishes.filter((dish) => ids.has(dish.id));
  }

  const withOverride = candidates.filter(
    (dish) => dish.taxRatePercent != null && dish.taxRatePercent !== parsed.data.gstRatePercent,
  );
  const toUpdate = parsed.data.replaceOverrides
    ? candidates
    : candidates.filter((dish) => dish.taxRatePercent == null);

  if (parsed.data.previewOnly) {
    return NextResponse.json({
      success: true,
      data: {
        affectedCount: toUpdate.length,
        preservedOverrideCount: withOverride.length,
        sampleNames: toUpdate.slice(0, 12).map((dish) => dish.name),
      },
    });
  }

  let updatedCount = 0;
  for (const dish of toUpdate) {
    await dishRepository.update(dish.id, {
      taxRatePercent: parsed.data.gstRatePercent,
    });
    updatedCount += 1;
  }

  await billingAuditRepository.append({
    restaurantId: admin.restaurantId,
    action: "BULK_TAX_APPLY",
    meta: {
      gstRatePercent: parsed.data.gstRatePercent,
      scope: parsed.data.scope,
      updatedCount,
      preservedOverrideCount: parsed.data.replaceOverrides ? 0 : withOverride.length,
    },
    actor: {
      id: admin.restaurantAdminAccountId ?? admin.email,
      email: admin.email,
      role: admin.role,
    },
  });

  return NextResponse.json({
    success: true,
    data: { updatedCount, preservedOverrideCount: parsed.data.replaceOverrides ? 0 : withOverride.length },
  });
}
