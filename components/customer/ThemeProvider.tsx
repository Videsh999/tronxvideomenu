"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import type { Restaurant } from "@/types";
import { getRestaurantTheme, getThemeCSSVariables } from "@/lib/theme";

type ThemeProviderProps = {
  restaurant: Restaurant;
  children: React.ReactNode;
};

export default function ThemeProvider({ restaurant, children }: ThemeProviderProps) {
  const cssVars = useMemo(
    () => getThemeCSSVariables(getRestaurantTheme(restaurant)),
    [restaurant],
  );

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
