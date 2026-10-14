import { NextResponse } from "next/server";
import { categoryService } from "@/lib/services/category.service";
import { updateCategorySchema } from "@/lib/validations";
import { requireRestaurantAdmin } from "@/lib/auth-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { categoryId } = await params;
    const category = await categoryService.getById(categoryId);
    if (!category || category.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch category";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { categoryId } = await params;
    const existing = await categoryService.getById(categoryId);
    if (!existing || existing.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }
    const body = await request.json();
    const validated = updateCategorySchema.parse(body);
    const updated = await categoryService.update(categoryId, validated);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
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
      error instanceof Error ? error.message : "Failed to update category";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const { categoryId } = await params;
    const existing = await categoryService.getById(categoryId);
    if (!existing || existing.restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }
    const deleted = await categoryService.delete(categoryId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete category";
    const isConflict = message.includes("Cannot delete category with active dishes");
    return NextResponse.json(
      { success: false, error: message },
      { status: isConflict ? 409 : 500 },
    );
  }
}
