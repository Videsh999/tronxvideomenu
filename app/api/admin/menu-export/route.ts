import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { categoryRepository } from "@/lib/repositories/category.repository";
import { dishRepository } from "@/lib/repositories/dish.repository";
import { addonRepository } from "@/lib/repositories/addon.repository";
import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import { writeMenuExportBuffer } from "@/lib/menu-export/build-workbook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin?.restaurantId) {
    return error ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const restaurant = await restaurantRepository.findById(admin.restaurantId);
  if (!restaurant || restaurant.isActive === false) {
    return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
  }

  const [categories, dishes, addonGroups] = await Promise.all([
    categoryRepository.findByRestaurantId(admin.restaurantId),
    dishRepository.findByRestaurantId(admin.restaurantId),
    addonRepository.findGroupsByRestaurantId(admin.restaurantId),
  ]);

  const buffer = writeMenuExportBuffer(categories, dishes, addonGroups, format);
  const slug = restaurant.slug || "menu";
  const stamp = new Date().toISOString().slice(0, 10);
  const filename =
    format === "csv"
      ? `tronx-${slug}-menu-${stamp}.csv`
      : `tronx-${slug}-menu-${stamp}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
