import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";
import { menuImportService } from "@/lib/services/menu-import.service";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

const mappingSchema = z.object({
  strategy: z.enum(["CREATE_ONLY", "UPDATE_MATCHING", "SMART_MERGE"]),
  columnMappings: z.array(z.object({
    sourceHeader: z.string(),
    columnIndex: z.number().int().min(0),
    canonical: z.enum([
      "itemName", "category", "description", "price", "compareAtPrice", "dietary",
      "prepTime", "sku", "tags", "availability", "addonGroup", "addonName", "addonPrice", "ignore",
    ]),
    confidence: z.number().min(0).max(1),
    variantName: z.preprocess(
      (value) => (value === null || value === undefined || value === "" ? undefined : value),
      z.string().optional(),
    ),
  })),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
    const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
    if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });
    const { jobId } = await params;
    const body = mappingSchema.parse(await request.json());
    const job = await menuImportService.updateMapping(admin.restaurantId, jobId, body.columnMappings, body.strategy);
    return NextResponse.json({ success: true, data: job }, { headers: noStore });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to save mapping." },
      { status: 400, headers: noStore },
    );
  }
}
