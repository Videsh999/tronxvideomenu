"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X, Check, Clock, Minus, Plus } from "lucide-react";
import type { Dish, AddonGroup, Addon } from "@/types";
import { getDishMedia } from "@/lib/dish-media";
import DishMediaGallery from "./DishMediaGallery";
import { VegMark } from "./DishCard";
import SpeakButton from "./SpeakButton";
import { useI18n } from "./I18nProvider";

type DishDetailModalProps = {
  dish: Dish | null;
  onClose: () => void;
  canOrder: boolean;
  orderingEnabled?: boolean;
  videoMenuEnabled?: boolean;
  categoryName?: string;
  onAddToCart: (entry: { dishId: string; quantity: number; selections: { groupId: string; addonIds: string[] }[] }) => void;
};

function createInitialAddonSelections(dish: Dish | null) {
  const selections: Record<string, string[]> = {};
  for (const group of dish?.addonGroups ?? []) {
    if (group.isActive === false) continue;
    const firstAvailableAddon = group.addons.find(
      (addon) => addon.isActive !== false && addon.isAvailable !== false,
    );
    selections[group.id] =
      group.isRequired && group.maxSelect === 1 && group.addons.length > 0
        ? (firstAvailableAddon ? [firstAvailableAddon.id] : [])
        : [];
  }
  return selections;
}

export default function DishDetailModal({
  dish,
  onClose,
  canOrder,
  orderingEnabled = true,
  videoMenuEnabled = true,
  categoryName,
  onAddToCart,
}: DishDetailModalProps) {
  const { t, tc } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);

  const [selectionState, setSelectionState] = useState<{
    dishId: string | null;
    values: Record<string, string[]>;
  }>({ dishId: null, values: {} });
  const [quantity, setQuantity] = useState(1);
  const selectedAddons =
    dish && selectionState.dishId === dish.id
      ? selectionState.values
      : createInitialAddonSelections(dish);

  // Reset scroll to top when a new dish is opened.
  useEffect(() => {
    if (!dish?.id) return;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [dish?.id]); // Only re-run when the dish ID actually changes, not on every render

  const updateGroupSelection = (
    group: AddonGroup,
    update: (current: string[]) => string[],
  ) => {
    if (!dish) return;
    setSelectionState((previous) => {
      const currentValues =
        previous.dishId === dish.id
          ? previous.values
          : createInitialAddonSelections(dish);
      return {
        dishId: dish.id,
        values: {
          ...currentValues,
          [group.id]: update(currentValues[group.id] ?? []),
        },
      };
    });
  };

  // Body scroll lock and Escape key listener
  useEffect(() => {
    if (!dish) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open for accessibility without scrolling viewport
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dish, onClose]);

  // Calculate total price based on base price and selected addons
  const addonsTotal = useMemo(() => {
    if (!dish || !dish.addonGroups) return 0;
    let total = 0;

    dish.addonGroups.forEach((group) => {
      if (group.isActive === false) return;
      const selectedIds = selectedAddons[group.id] || [];
      group.addons.forEach((addon) => {
        if (selectedIds.includes(addon.id)) {
          total += addon.price;
        }
      });
    });

    return total;
  }, [dish, selectedAddons]);

  const totalPrice = (dish?.price ?? 0) + addonsTotal;
  const hasValidSelections = (dish?.addonGroups ?? []).every((group) => {
    if (group.isActive === false) return true;
    const ids = selectedAddons[group.id] ?? [];
    const count = ids.length;
    if (ids.some((id) => !group.addons.some((addon) => addon.id === id && addon.isActive !== false && addon.isAvailable !== false))) return false;
    return count >= (group.isRequired ? Math.max(1, group.minSelect) : group.minSelect) && count <= group.maxSelect;
  });

  // Toggle selection for single-select (radio) and multi-select (checkbox)
  // Maintains strictly stable scroll position across re-renders
  const handleToggleAddon = (group: AddonGroup, addon: Addon) => {
    // 1. Capture exact current scroll position before state update
    if (scrollContainerRef.current) {
      savedScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }

    const current = selectedAddons[group.id] || [];
    const isSelected = current.includes(addon.id);

    if (group.maxSelect === 1) {
      // Radio mode: selection replaces previous choice
      if (isSelected) {
        // If optional, allow unchecking; if required, keep selected
        if (!group.isRequired) {
          updateGroupSelection(group, () => []);
        }
      } else {
        updateGroupSelection(group, () => [addon.id]);
      }
    } else {
      // Checkbox mode: toggle up to maxSelect
      if (isSelected) {
        updateGroupSelection(group, (previous) =>
          previous.filter((id) => id !== addon.id),
        );
      } else {
        if (current.length < group.maxSelect) {
          updateGroupSelection(group, (previous) => [...previous, addon.id]);
        }
      }
    }

    // 2. Restore exact scroll position on the next animation frame to prevent browser focus jumping
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = savedScrollTopRef.current;
      }
    });
  };

  if (!dish) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-modal-title"
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/55 backdrop-blur-md sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[94dvh] w-full max-w-full animate-sheet-up flex-col overflow-hidden rounded-t-[2rem] bg-white text-[var(--restaurant-text)] shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:animate-scale-in sm:rounded-[2rem]">
        {/* Mobile Swipe / Drag Pill Handle */}
        <div className="absolute inset-x-0 top-0 z-20 flex w-full items-center justify-center pt-2.5 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/70 shadow" />
        </div>

        {/* Accessible Close Button */}
        <div className="absolute right-4 top-4 z-20">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("closeDetails")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[var(--restaurant-text)] shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 
          PRIMARY SCROLLABLE CONTENT CONTAINER:
          - Single scrollable region for all modal content
          - scrollbar-none hides the visible scrollbar on Chrome, Edge, Firefox, and Safari
          - mouse wheel, touch, and trackpad scrolling remain completely functional
        */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain scrollbar-none"
        >
          {/* 1. MEDIA AREA */}
          <DishMediaGallery media={getDishMedia(dish, videoMenuEnabled)} title={tc(dish.name)} />

          {/* 2. DISH INFORMATION & CONTENT */}
          <div className="space-y-6 px-5 pb-8 pt-5 sm:px-7">
            {/* Dish Info: Name, Price, Veg/Non-veg & Customisable badge */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--customer-border)] py-1 pl-1 pr-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--restaurant-text-muted)]">
                  <VegMark isVeg={dish.isVeg} className="h-4 w-4" />
                  {dish.isVeg ? t("pureVeg") : t("nonVeg")}
                </span>

                {dish.preparationTime ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--customer-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--restaurant-text-muted)]">
                    <Clock className="h-3 w-3" /> {t("minutes", { count: dish.preparationTime })}
                  </span>
                ) : null}

                {dish.addonGroups && dish.addonGroups.length > 0 && (
                  <span className="rounded-full bg-[var(--restaurant-primary)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--restaurant-primary)]">
                    {t("customisable")}
                  </span>
                )}
              </div>

              {/* Title & Price */}
              <div>
                {categoryName ? <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{tc(categoryName)}</p> : null}
                <div className="mt-1 flex items-start gap-3">
                  <h2
                    id="dish-modal-title"
                    className="font-serif min-w-0 flex-1 text-4xl uppercase text-[var(--restaurant-text)] sm:text-5xl"
                  >
                    {tc(dish.name)}
                  </h2>
                  <SpeakButton text={tc(dish.name)} originalText={dish.name} size="md" className="mt-0.5" />
                </div>
              </div>

              {/* Description */}
              {dish.description && (
                <p className="text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
                  {tc(dish.description)}
                </p>
              )}

              <p className="text-2xl font-bold tabular-nums text-[var(--restaurant-text)]">₹{dish.price}</p>
            </div>

            {/* 3. ADD-ONS SECTION */}
            {dish.addonGroups && dish.addonGroups.some((group) => group.isActive !== false) && (
              <div className="space-y-5 border-t border-[var(--customer-border)] pt-6">
                <div>
                  <h3 className="font-serif text-2xl uppercase text-[var(--restaurant-text)]">
                    {t("customiseTitle")}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--restaurant-text-muted)]">
                    {t("customiseHint")}
                  </p>
                </div>

                <div className="space-y-5">
                  {dish.addonGroups.filter((group) => group.isActive !== false).map((group) => {
                    const currentSelections = selectedAddons[group.id] || [];
                    const isSingleSelect = group.maxSelect === 1;
                    const isMaxReached =
                      !isSingleSelect &&
                      currentSelections.length >= group.maxSelect;

                    return (
                      <div
                        key={group.id}
                        className="overflow-hidden rounded-2xl border border-[var(--customer-border)] bg-white"
                      >
                        {/* Group Header (Stable height) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--customer-border)] bg-[var(--customer-cream)]/60 px-4 py-3 sm:px-5">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-[var(--restaurant-text)]">
                              {tc(group.name)}
                            </span>
                            {group.isRequired ? (
                              <span className="rounded-full bg-[var(--restaurant-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--restaurant-primary)]">
                                {t("required")}
                              </span>
                            ) : (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--restaurant-text-muted)] ring-1 ring-inset ring-[var(--customer-border)]">
                                {t("optional")}
                              </span>
                            )}
                          </div>

                          {/* Rule hints */}
                          <div className="text-xs font-medium text-[var(--restaurant-text-muted)]">
                            {isSingleSelect
                              ? t("chooseOne")
                              : group.minSelect > 0
                                ? t("chooseRange", { min: group.minSelect, max: group.maxSelect })
                                : t("upTo", { max: group.maxSelect })}
                          </div>
                        </div>

                        {/* Add-on Options List */}
                        <div className="divide-y divide-[var(--customer-border)]/70 px-2 py-1 sm:px-3">
                          {group.addons.length === 0 ? (
                            <p className="px-2 py-4 text-sm text-[var(--restaurant-text-muted)]">
                              {t("noOptions")}
                            </p>
                          ) : group.addons.map((addon) => {
                            const isSelected = currentSelections.includes(
                              addon.id,
                            );
                            const isDisabled =
                              addon.isActive === false || addon.isAvailable === false || (!isSelected && isMaxReached && !isSingleSelect);
                            const inputId = `addon-${group.id}-${addon.id}`;

                            return (
                              <label
                                key={addon.id}
                                className={`relative flex items-center justify-between rounded-xl px-2 py-3 transition select-none ${
                                  isDisabled
                                    ? "cursor-not-allowed opacity-40"
                                    : "cursor-pointer hover:bg-[var(--customer-cream)]"
                                } ${isSelected ? "bg-[var(--restaurant-primary)]/[0.06]" : ""}`}
                              >
                                {/* 
                                  Controlled Accessible Input:
                                  Occupies full row (absolute inset-0) so focus never creates an offset scroll delta
                                */}
                                <input
                                  id={inputId}
                                  type={isSingleSelect ? "radio" : "checkbox"}
                                  name={`addon-group-${group.id}`}
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() =>
                                    handleToggleAddon(group, addon)
                                  }
                                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                  aria-label={`${tc(addon.name)}, ${
                                    addon.price > 0 ? `₹${addon.price}` : t("free")
                                  }`}
                                />

                                <div className="flex items-center gap-3">
                                  {/* Visual radio/checkbox indicator */}
                                  <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center transition ${
                                      isSingleSelect
                                        ? "rounded-full border"
                                        : "rounded-md border"
                                    } ${
                                      isSelected
                                        ? "border-[var(--restaurant-primary)] bg-[var(--restaurant-primary)] text-white shadow-xs"
                                        : "border-[#bfaea3] bg-transparent"
                                    }`}
                                  >
                                    {isSelected &&
                                      (isSingleSelect ? (
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      ))}
                                  </div>

                                  <span
                                    className={`text-sm sm:text-base ${
                                      isSelected
                                        ? "font-medium text-[var(--restaurant-text)]"
                                        : "text-[var(--restaurant-text-muted)]"
                                    }`}
                                  >
                                    {tc(addon.name)}
                                  </span>
                                </div>

                                <span className="text-sm font-semibold text-[var(--restaurant-primary)]">
                                  {addon.price > 0
                                    ? `+₹${addon.price}`
                                    : t("free")}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 
          4. FIXED/STICKY BOTTOM ACTION BAR:
          - Does not scroll with modal content
          - Always visible at the bottom of the modal card
        */}
        {orderingEnabled && <div className="safe-bottom shrink-0 border-t border-[var(--customer-border)] bg-white px-4 pt-3 sm:px-8 sm:pt-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex shrink-0 items-center rounded-full border border-[var(--customer-border)] bg-[var(--customer-cream)]/60">
              <button type="button" aria-label={t("decrease")} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-12 w-11 place-items-center rounded-full text-[var(--restaurant-primary)] hover:bg-[var(--customer-border)]/60"><Minus className="h-4 w-4" /></button>
              <span className="min-w-6 text-center text-base font-bold tabular-nums">{quantity}</span>
              <button type="button" aria-label={t("increase")} onClick={() => setQuantity((value) => Math.min(99, value + 1))} className="grid h-12 w-11 place-items-center rounded-full text-[var(--restaurant-primary)] hover:bg-[var(--customer-border)]/60"><Plus className="h-4 w-4" /></button>
            </div>
            <button
              type="button"
              disabled={!canOrder || !hasValidSelections || !dish.isAvailable}
              onClick={() => {
                if (!dish) return;
                onAddToCart({
                  dishId: dish.id,
                  quantity,
                  selections: (dish.addonGroups ?? []).filter((group) => group.isActive !== false).map((group) => ({ groupId: group.id, addonIds: selectedAddons[group.id] ?? [] })),
                });
                onClose();
              }}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-full bg-[var(--restaurant-primary)] px-5 text-sm font-bold text-white shadow-[0_12px_28px_-12px_var(--restaurant-primary)] transition hover:bg-[var(--restaurant-primary-dark)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none sm:ml-auto sm:max-w-sm"
            >
              <span className="truncate">{dish.isAvailable ? canOrder ? hasValidSelections ? t("addToCart") : t("chooseRequired") : t("scanQrToOrder") : t("unavailable")}</span>
              {dish.isAvailable && canOrder ? <span className="shrink-0 tabular-nums">₹{totalPrice * quantity}</span> : null}
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
