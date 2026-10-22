import { NextResponse } from "next/server";
import { dishService } from "@/lib/services/dish.service";
import { dishSchema } from "@/lib/validations";
import { categoryService } from "@/lib/services/category.service";
import { addonService } from "@/lib/services/addon.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";

export async function GET(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const restaurantId = searchParams.get("restaurantId");

    if (restaurantId !== admin.restaurantId || (!restaurantId && !categoryId)) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }

    if (categoryId) {
      const category = await categoryService.getById(categoryId);
      if (!category || category.restaurantId !== admin.restaurantId) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 },
        );
      }
      const dishes = await dishService.getByCategoryId(categoryId);
      return NextResponse.json({ success: true, data: dishes });
    }

    const dishes = await dishService.getByRestaurantId(admin.restaurantId);
    return NextResponse.json({ success: true, data: dishes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch dishes";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const body = await request.json();
    const validated = dishSchema.parse({
      ...body,
      restaurantId: admin.restaurantId,
    });

    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }

    if (validated.video || validated.videoUrl || validated.gallery?.some((item) => item.type === "VIDEO")) {
      const featureCheck = requireRestaurantFeature(restaurant, "VIDEO_MENU");
      if (!featureCheck.allowed) {
        return NextResponse.json(
          { success: false, error: featureCheck.reason },
          { status: 403 },
        );
      }
    }

    const category = await categoryService.getById(validated.categoryId);
    if (!category || category.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }
    const addonGroups = await Promise.all(
      (validated.addonGroupIds ?? []).map((id) =>
        addonService.getGroupById(id),
      ),
    );
    if (
      addonGroups.some(
        (group) => !group || group.restaurantId !== admin.restaurantId,
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Add-on group not found" },
        { status: 404 },
      );
    }
    const newDish = await dishService.create(validated);
    return NextResponse.json({ success: true, data: newDish }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to create dish";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}
