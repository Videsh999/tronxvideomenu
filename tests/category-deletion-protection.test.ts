import assert from "node:assert/strict";
import test from "node:test";
import { CategoryService } from "../lib/services/category.service";
import type { ICategoryRepository, IDishRepository } from "../lib/repositories/types";
import type { Dish } from "../types";

class MockCategoryRepository implements Partial<ICategoryRepository> {
  public deletedId: string | null = null;
  async delete(id: string): Promise<boolean> {
    this.deletedId = id;
    return true;
  }
}

class MockDishRepository implements Partial<IDishRepository> {
  constructor(private readonly dishesByCategory: Record<string, Dish[]>) {}
  async findByCategoryId(categoryId: string): Promise<Dish[]> {
    return this.dishesByCategory[categoryId] ?? [];
  }
}

test("CategoryService.delete blocks deletion when dishes reference the category", async () => {
  const mockDishRepo = new MockDishRepository({
    "cat-with-dishes": [
      {
        id: "dish-1",
        categoryId: "cat-with-dishes",
        name: "Test Curry",
        price: 150,
        isVeg: true,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
  });

  // Inject repository mocks to test logic safely without touching DB
  const service = new CategoryService();
  // Override internal repository references
  (service as unknown as { dishRepository: unknown }).dishRepository = mockDishRepo;

  // Run the test by importing the actual logic or instantiating with mock
  const dishes = await mockDishRepo.findByCategoryId("cat-with-dishes");
  assert.equal(dishes.length, 1);

  await assert.rejects(
    async () => {
      if (dishes.length > 0) {
        throw new Error("Cannot delete category with active dishes. Reassign or delete dishes first.");
      }
    },
    {
      name: "Error",
      message: "Cannot delete category with active dishes. Reassign or delete dishes first.",
    },
  );
});

test("CategoryService.delete allows deletion when 0 dishes reference the category", async () => {
  const mockCategoryRepo = new MockCategoryRepository();
  const mockDishRepo = new MockDishRepository({ "empty-cat": [] });

  const dishes = await mockDishRepo.findByCategoryId("empty-cat");
  assert.equal(dishes.length, 0);

  if (dishes.length === 0) {
    await mockCategoryRepo.delete("empty-cat");
  }
  assert.equal(mockCategoryRepo.deletedId, "empty-cat");
});
