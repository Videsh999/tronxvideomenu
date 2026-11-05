import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";
import { menuImportService } from "@/lib/services/menu-import.service";
import {
  formatImportZodError,
  importPreviewItemsBodySchema,
  normalizeImportItemDraft,
} from "@/lib/menu-import/item-schema";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
    }
    const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });
    }
    const { jobId } = await params;
    const raw = await request.json();
    // Pre-normalize optional nulls before Zod so Excel/Mongo round-trips never dump raw issues.
    if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
      (raw as { items: unknown[] }).items = (raw as { items: unknown[] }).items.map((item) =>
        item && typeof item === "object"
          ? normalizeImportItemDraft(item as Parameters<typeof normalizeImportItemDraft>[0])
          : item,
      );
    }
    const body = importPreviewItemsBodySchema.parse(raw);
    const job = await menuImportService.updatePreviewItems(admin.restaurantId, jobId, body.items);
    return NextResponse.json({ success: true, data: job }, { headers: noStore });
  } catch (cause) {
    if (cause instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: formatImportZodError(cause) },
        { status: 400, headers: noStore },
      );
    }
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to update preview." },
      { status: 400, headers: noStore },
    );
  }
}
