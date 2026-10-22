import { NextResponse } from "next/server";
import { dishService } from "@/lib/services/dish.service";
import { updateDishSchema } from "@/lib/validations";
import { categoryService } from "@/lib/services/category.service";
import { addonService } from "@/lib/services/addon.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { dishId } = await params;
    const dish = await dishService.getById(dishId);
    if (!dish || dish.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Dish not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: dish });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch dish";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { dishId } = await params;
    const existing = await dishService.getById(dishId);
    if (!existing || existing.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Dish not found" },
        { status: 404 },
      );
    }
    const body = await request.json();
    const validated = updateDishSchema.parse(body);

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

    if (validated.categoryId) {
      const category = await categoryService.getById(validated.categoryId);
      if (!category || category.restaurantId !== admin.restaurantId) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 },
        );
      }
    }
    if (validated.addonGroupIds) {
      const groups = await Promise.all(
        validated.addonGroupIds.map((id) => addonService.getGroupById(id)),
      );
      if (
        groups.some(
          (group) => !group || group.restaurantId !== admin.restaurantId,
        )
      ) {
        return NextResponse.json(
          { success: false, error: "Add-on group not found" },
          { status: 404 },
        );
      }
    }
    const updated = await dishService.update(dishId, validated);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Dish not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to update dish";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { dishId } = await params;
    const existing = await dishService.getById(dishId);
    if (!existing || existing.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Dish not found" },
        { status: 404 },
      );
    }
    const deleted = await dishService.delete(dishId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Dish not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "Dish deleted successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete dish";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
