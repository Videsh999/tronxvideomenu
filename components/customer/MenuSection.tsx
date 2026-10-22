"use client";

import type { Category, Dish } from "@/types";
import DishCard from "./DishCard";
import { useI18n } from "./I18nProvider";

export type DishSort = "recommended" | "price-asc" | "price-desc";

type MenuSectionProps = {
  category: Category;
  dishes: Dish[];
  onDishClick: (dish: Dish) => void;
  isFirstCategory?: boolean;
  videoMenuEnabled?: boolean;
  canOrder?: boolean;
  sort?: DishSort;
};

export default function MenuSection({
  category,
  dishes,
  onDishClick,
  isFirstCategory = false,
  videoMenuEnabled = true,
  canOrder = false,
  sort = "recommended",
}: MenuSectionProps) {
  const { tc, tn } = useI18n();
  const categoryDishes = dishes
    .filter((dish) => dish.categoryId === category.id)
    .sort((a, b) =>
      sort === "price-asc" ? a.price - b.price
        : sort === "price-desc" ? b.price - a.price
          : a.sortOrder - b.sortOrder,
    );

  if (categoryDishes.length === 0) {
    return null;
  }

  return (
    <section
      id={`category-${category.id}`}
      data-category-id={category.id}
      aria-labelledby={`category-heading-${category.id}`}
      className="scroll-mt-36"
    >
      <header className="mb-7 text-center sm:mb-9">
        <h2 id={`category-heading-${category.id}`} className="section-rule font-condensed justify-center text-4xl uppercase text-[var(--restaurant-text)] sm:text-5xl">
          {tc(category.name)}
        </h2>
        <p className="mt-2 text-xs font-medium text-neutral-500">
          {tn("itemCount", categoryDishes.length)}
          {category.description ? <span className="hidden sm:inline"> · {tc(category.description)}</span> : null}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4">
        {categoryDishes.map((dish, index) => (
          <DishCard
            key={dish.id}
            dish={dish}
            onClick={onDishClick}
            priority={isFirstCategory && index < 2}
            videoMenuEnabled={videoMenuEnabled}
            canOrder={canOrder}
          />
        ))}
      </div>
    </section>
  );
}
