"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import type { MenuOffer, Restaurant } from "@/types";
import { getRestaurantTheme, getThemeCSSVariables } from "@/lib/theme";
import { festiveThemeForOffer } from "@/lib/offers/menu-offer";

type ThemeProviderProps = {
  restaurant: Restaurant;
  activeOffer?: MenuOffer | null;
  children: React.ReactNode;
};

export default function ThemeProvider({ restaurant, activeOffer, children }: ThemeProviderProps) {
  const cssVars = useMemo(() => {
    const festive = festiveThemeForOffer(activeOffer);
    return getThemeCSSVariables(festive ?? getRestaurantTheme(restaurant));
  }, [restaurant, activeOffer]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => root.style.setProperty(key, value));

    return () => {
      Object.keys(cssVars).forEach((key) => root.style.removeProperty(key));
    };
  }, [cssVars]);

  // Apply on the wrapper too so first paint (and SSR) already has readable card text,
  // instead of waiting for the documentElement effect after hydration.
  return (
    <div className="contents" style={cssVars as CSSProperties}>
      {children}
    </div>
  );
}
