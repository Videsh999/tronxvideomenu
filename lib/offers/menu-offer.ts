import { roundMoney } from "@/lib/order-pricing";
import type { Dish, MenuOffer, OfferThemePreset, RestaurantTheme } from "@/types";

export function isMenuOfferLive(offer: MenuOffer, now = new Date()): boolean {
  if (!offer.isActive) return false;
  const ts = now.getTime();
  if (offer.startsAt) {
    const start = Date.parse(offer.startsAt);
    if (Number.isFinite(start) && ts < start) return false;
  }
  if (offer.endsAt) {
    const end = Date.parse(offer.endsAt);
    if (Number.isFinite(end) && ts > end) return false;
  }
  return true;
}

export function offerAppliesToDish(offer: MenuOffer, dishId: string): boolean {
  if (offer.scope === "ALL_MENU") return true;
  return offer.dishIds.includes(dishId);
}

export function offerUnitPrice(catalogPrice: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, percentOff));
  return roundMoney(catalogPrice * (1 - pct / 100));
}

/** Stamp display helpers on dishes; catalog `price` stays unchanged for order pricing. */
export function stampDishesWithOffer(dishes: Dish[], offer: MenuOffer | null | undefined): Dish[] {
  if (!offer || !isMenuOfferLive(offer)) return dishes;
  const badge = offer.presentation.badgeText?.trim() || `${offer.percentOff}% OFF`;
  return dishes.map((dish) => {
    if (!offerAppliesToDish(offer, dish.id)) return dish;
    return {
      ...dish,
      listPrice: dish.price,
      offerPrice: offerUnitPrice(dish.price, offer.percentOff),
      offerPercentOff: offer.percentOff,
      offerBadge: badge,
    };
  });
}

export function dishDisplayPrice(dish: Dish): number {
  return typeof dish.offerPrice === "number" && Number.isFinite(dish.offerPrice)
    ? dish.offerPrice
    : dish.price;
}

export type OfferLineLike = {
  dishId: string;
  itemTotal: number;
  itemDiscountAmount?: number;
};

/** Apply active % off as item discounts (catalog unit price stays on the line). */
export function applyMenuOfferToLines<T extends OfferLineLike>(
  items: T[],
  offer: MenuOffer | null | undefined,
): T[] {
  if (!offer || !isMenuOfferLive(offer)) return items;
  return items.map((item) => {
    if (!offerAppliesToDish(offer, item.dishId)) return item;
    const gross =
      item.itemTotal + Math.max(0, item.itemDiscountAmount ?? 0);
    const discount = roundMoney(gross * (offer.percentOff / 100));
    if (discount <= 0) return item;
    const nextDiscount = roundMoney(Math.max(0, item.itemDiscountAmount ?? 0) + discount);
    return {
      ...item,
      itemDiscountAmount: nextDiscount,
      itemTotal: roundMoney(Math.max(0, gross - nextDiscount)),
    };
  });
}

const FESTIVE_THEMES: Record<Exclude<OfferThemePreset, "NONE" | "CUSTOM">, Required<RestaurantTheme>> = {
  CHRISTMAS: {
    primaryColor: "#b91c1c",
    secondaryColor: "#14532d",
    accentColor: "#fbbf24",
    backgroundColor: "#fff7f7",
    textColor: "#1c1917",
    buttonStyle: "filled",
    borderRadius: "rounded",
  },
  NEW_YEAR: {
    primaryColor: "#a16207",
    secondaryColor: "#18181b",
    accentColor: "#facc15",
    backgroundColor: "#fafaf9",
    textColor: "#18181b",
    buttonStyle: "filled",
    borderRadius: "rounded",
  },
  SANKRANTI: {
    primaryColor: "#c2410c",
    secondaryColor: "#9a3412",
    accentColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    textColor: "#431407",
    buttonStyle: "filled",
    borderRadius: "rounded",
  },
  DIWALI: {
    primaryColor: "#7c3aed",
    secondaryColor: "#4c1d95",
    accentColor: "#fbbf24",
    backgroundColor: "#faf5ff",
    textColor: "#1e1b4b",
    buttonStyle: "filled",
    borderRadius: "rounded",
  },
};

export function festiveThemeForOffer(offer: MenuOffer | null | undefined): Required<RestaurantTheme> | null {
  if (!offer || !isMenuOfferLive(offer) || !offer.presentation.applyTheme) return null;
  const preset = offer.presentation.themePreset;
  if (preset === "NONE" || preset === "CUSTOM") return null;
  return FESTIVE_THEMES[preset];
}
