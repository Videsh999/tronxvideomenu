import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";
import { menuImportService } from "@/lib/services/menu-import.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
  const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
  if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });
  const jobs = await menuImportService.list(admin.restaurantId);
  return NextResponse.json({ success: true, data: jobs }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
    const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
    if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Upload a spreadsheet file." }, { status: 400, headers: noStore });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const job = await menuImportService.upload({
      restaurantId: admin.restaurantId,
      email: admin.email,
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });
    return NextResponse.json({ success: true, data: job }, { status: 201, headers: noStore });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to upload spreadsheet." },
      { status: 400, headers: noStore },
    );
  }
}
