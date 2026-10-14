import { categoryRepository } from "@/lib/repositories/category.repository";
import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import type { Category } from "@/types";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validations";

import { dishRepository } from "@/lib/repositories/dish.repository";

export class CategoryService {
  async getByRestaurantId(restaurantId: string): Promise<Category[]> {
    return categoryRepository.findByRestaurantId(restaurantId);
  }

  async getById(id: string): Promise<Category | null> {
    return categoryRepository.findById(id);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const restaurant = await restaurantRepository.findById(input.restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }
    return categoryRepository.create(input);
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category | null> {
    return categoryRepository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    const dishes = await dishRepository.findByCategoryId(id);
    if (dishes.length > 0) {
      throw new Error("Cannot delete category with active dishes. Reassign or delete dishes first.");
    }
    return categoryRepository.delete(id);
  }
}

export const categoryService = new CategoryService();
