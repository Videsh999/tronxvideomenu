"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/types";
import { useI18n } from "./I18nProvider";

type CategoryNavProps = {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  totalDishCount?: number;
};

const chipBase =
  "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition-all duration-200";
const chipActive =
  "bg-[var(--restaurant-text)] text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]";
const chipIdle =
  "text-[var(--restaurant-text)]/60 hover:bg-[var(--customer-cream)] hover:text-[var(--restaurant-text)]";

export default function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  totalDishCount = 0,
}: CategoryNavProps) {
  const { t, tc } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const sortedCategories = categories
    .filter((category) => category.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Auto-scroll the active category button horizontally inside the container ONLY
  // Never call button.scrollIntoView() as that scrolls the entire page window and causes freezing
  useEffect(() => {
    if (!activeCategory) return;
    const container = containerRef.current;
    const button = buttonRefs.current[activeCategory];
    if (!container || !button) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const scrollOffset =
      buttonRect.left -
      containerRect.left -
      containerRect.width / 2 +
      buttonRect.width / 2;

    container.scrollBy({
      left: scrollOffset,
      behavior: "smooth",
    });
  }, [activeCategory]);

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);

    const targetSection = document.getElementById(categoryId === "all" ? "menu-content" : `category-${categoryId}`);
    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <nav aria-label="Menu categories" className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={containerRef}
          className="flex gap-1 overflow-x-auto py-2 scrollbar-none [-webkit-overflow-scrolling:touch] [mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-24px),transparent)] md:[&>*:first-child]:ms-auto md:[&>*:last-child]:me-auto"
        >
          <button
            type="button"
            ref={(el) => { buttonRefs.current.all = el; }}
            onClick={() => handleCategoryClick("all")}
            aria-pressed={!activeCategory}
            className={`${chipBase} ${!activeCategory ? chipActive : chipIdle}`}
          >
            {t("all")} <span className="ml-1 tabular-nums opacity-60">{totalDishCount}</span>
          </button>
          {sortedCategories.map((category) => {
            const isActive = category.id === activeCategory;

            return (
              <button
                key={category.id}
                ref={(el) => {
                  buttonRefs.current[category.id] = el;
                }}
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                aria-pressed={isActive}
                aria-current={isActive ? "true" : undefined}
                className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
              >
                {tc(category.name)}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
