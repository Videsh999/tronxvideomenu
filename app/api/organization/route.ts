import { NextResponse } from "next/server";
import { requireRestaurantAdmin, unauthorizedResponse } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import {
  organizationService,
  OrganizationServiceError,
} from "@/lib/services/organization.service";
import { reportingService } from "@/lib/services/reporting.service";
import {
  attachOutletSchema,
  createOrganizationSchema,
  createStockTransferSchema,
} from "@/lib/validations";

export async function GET(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return unauthorizedResponse();
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
  }
  const feature = requireRestaurantFeature(restaurant, "MULTI_OUTLET");
  if (!feature.allowed) {
    return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  }
  if (!restaurant.organizationId) {
    return NextResponse.json({
      success: true,
      data: { organization: null, outlets: [], transfers: [] },
    });
  }
  const url = new URL(request.url);
  const [organization, outlets, transfers, comparison] = await Promise.all([
    organizationService.getOrganization(restaurant.organizationId),
    organizationService.listOutlets(restaurant.organizationId),
    organizationService.listTransfers(restaurant.organizationId),
    reportingService.outletComparison(
      restaurant.organizationId,
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
    ),
  ]);
  return NextResponse.json(
    { success: true, data: { organization, outlets, transfers, comparison } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return unauthorizedResponse();
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
  }
  const feature = requireRestaurantFeature(restaurant, "MULTI_OUTLET");
  if (!feature.allowed) {
    return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (body?.action === "ATTACH_OUTLET") {
      const parsed = attachOutletSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      if (parsed.data.restaurantId !== admin.restaurantId) {
        return NextResponse.json(
          { success: false, error: "Can only attach the current restaurant outlet." },
          { status: 403 },
        );
      }
      const data = await organizationService.attachOutlet(
        parsed.data.restaurantId,
        parsed.data.organizationId,
      );
      return NextResponse.json({ success: true, data });
    }

    if (body?.action === "CREATE_TRANSFER") {
      const parsed = createStockTransferSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      if (parsed.data.organizationId !== restaurant.organizationId) {
        return NextResponse.json(
          { success: false, error: "Organization boundary violation." },
          { status: 403 },
        );
      }
      const data = await organizationService.createStockTransfer(parsed.data);
      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    if (body?.action === "SEND_TRANSFER" || body?.action === "RECEIVE_TRANSFER") {
      const transferId = String(body.transferId ?? "");
      if (!restaurant.organizationId || !transferId) {
        return NextResponse.json({ success: false, error: "Invalid transfer request." }, { status: 400 });
      }
      const actor = {
        role: "RESTAURANT_ADMIN" as const,
        id: admin.restaurantAdminAccountId ?? admin.email,
        email: admin.email,
        name: admin.email,
      };
      const data =
        body.action === "SEND_TRANSFER"
          ? await organizationService.sendTransfer(restaurant.organizationId, transferId, actor)
          : await organizationService.receiveTransfer(restaurant.organizationId, transferId, actor);
      return NextResponse.json({ success: true, data });
    }

    const parsed = createOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const organization = await organizationService.createOrganization(
      parsed.data.name,
      parsed.data.slug,
    );
    await organizationService.attachOutlet(admin.restaurantId, organization.id);
    return NextResponse.json({ success: true, data: organization }, { status: 201 });
  } catch (cause) {
    if (cause instanceof OrganizationServiceError) {
      return NextResponse.json(
        { success: false, error: cause.message },
        { status: cause.statusCode },
      );
    }
    return NextResponse.json({ success: false, error: "Unable to manage organization." }, { status: 500 });
  }
}
