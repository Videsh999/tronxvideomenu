import { NextResponse } from "next/server";
import { requireRestaurantAdmin, unauthorizedResponse } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminRepository } from "@/lib/repositories/restaurant-admin.repository";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { roleHasPermission } from "@/lib/org-rbac";
import { menuSyncService, MenuSyncServiceError } from "@/lib/services/menu-sync.service";
import { z } from "zod";

const createSchema = z
  .object({
    sourceRestaurantId: z.string().min(1),
    targetRestaurantIds: z.array(z.string().min(1)).min(1),
    preserveBranchFields: z
      .array(z.enum(["price", "isAvailable", "sortOrder", "kitchenStation"]))
      .optional(),
  })
  .strict();

export async function GET() {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return unauthorizedResponse();
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant?.organizationId) {
    return NextResponse.json({ success: false, error: "Restaurant is not in an organization." }, { status: 400 });
  }
  const feature = requireRestaurantFeature(restaurant, "MULTI_OUTLET");
  if (!feature.allowed) {
    return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  }
  const data = await menuSyncService.list(restaurant.organizationId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return unauthorizedResponse();
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant?.organizationId) {
    return NextResponse.json({ success: false, error: "Restaurant is not in an organization." }, { status: 400 });
  }
  const feature = requireRestaurantFeature(restaurant, "MULTI_OUTLET");
  if (!feature.allowed) {
    return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  }

  const account = admin.restaurantAdminAccountId
    ? await restaurantAdminRepository.findById(admin.restaurantAdminAccountId)
    : await restaurantAdminRepository.findByRestaurantId(admin.restaurantId);
  const role = account?.orgRole;
  if (role && !roleHasPermission(role, "ORG_MENU_SYNC")) {
    return NextResponse.json({ success: false, error: "Insufficient organization permissions." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (body?.action === "PREVIEW") {
      const data = await menuSyncService.preview(restaurant.organizationId, String(body.jobId ?? ""));
      return NextResponse.json({ success: true, data });
    }
    if (body?.action === "PUBLISH") {
      const data = await menuSyncService.publish(restaurant.organizationId, String(body.jobId ?? ""));
      return NextResponse.json({ success: true, data });
    }
    if (body?.action === "PREVIEW_ROLLBACK") {
      const data = await menuSyncService.previewRollback(
        restaurant.organizationId,
        String(body.jobId ?? ""),
      );
      return NextResponse.json({ success: true, data });
    }
    if (body?.action === "ROLLBACK") {
      const data = await menuSyncService.rollback(restaurant.organizationId, String(body.jobId ?? ""), {
        forceDishIds: Array.isArray(body.forceDishIds)
          ? body.forceDishIds.map(String)
          : undefined,
        forceAllConflicts: body.forceAllConflicts === true,
        actor: {
          role: "RESTAURANT_ADMIN",
          id: admin.restaurantAdminAccountId ?? admin.email,
          email: admin.email,
        },
      });
      return NextResponse.json({ success: true, data });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await menuSyncService.createJob({
      organizationId: restaurant.organizationId,
      ...parsed.data,
      actor: {
        role: "RESTAURANT_ADMIN",
        id: admin.restaurantAdminAccountId ?? admin.email,
        email: admin.email,
        name: admin.email,
      },
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (cause) {
    if (cause instanceof MenuSyncServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to sync menu." }, { status: 500 });
  }
}
