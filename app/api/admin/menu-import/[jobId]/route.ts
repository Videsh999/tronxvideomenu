import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";
import { menuImportService } from "@/lib/services/menu-import.service";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function gate() {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return { admin: null, error } as const;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return { admin: null, error: NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore }) } as const;
  const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
  if (!feature.allowed) return { admin: null, error: NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore }) } as const;
  return { admin, error: null } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { admin, error } = await gate();
  if (error) return error;
  const { jobId } = await params;
  const job = await menuImportService.get(admin.restaurantId, jobId);
  if (!job) return NextResponse.json({ success: false, error: "Import job not found." }, { status: 404, headers: noStore });
  return NextResponse.json({ success: true, data: job }, { headers: noStore });
}
