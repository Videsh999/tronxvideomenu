import type { Restaurant, RestaurantTheme } from "@/types";
import { hasRestaurantFeature } from "@/lib/features";

export const DEFAULT_THEME: Required<RestaurantTheme> = {
  primaryColor: "#602e31",
  secondaryColor: "#2d1719",
  accentColor: "#602e31",
  backgroundColor: "#ffffff",
  textColor: "#241416",
  buttonStyle: "filled",
  borderRadius: "rounded",
};

/** Customer menu cards and chrome are light surfaces — text must stay readable on them. */
const LIGHT_SURFACE = "#ffffff";

export function getRestaurantTheme(restaurant: Restaurant): Required<RestaurantTheme> {
  if (!hasRestaurantFeature(restaurant, "CUSTOM_THEME")) {
    return DEFAULT_THEME;
  }

  const color = (value: string | undefined, fallback: string) =>
    value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
  return {
    primaryColor: color(restaurant.theme?.primaryColor, DEFAULT_THEME.primaryColor),
    secondaryColor: color(restaurant.theme?.secondaryColor, DEFAULT_THEME.secondaryColor),
    accentColor: color(restaurant.theme?.accentColor, DEFAULT_THEME.accentColor),
    backgroundColor: color(restaurant.theme?.backgroundColor, DEFAULT_THEME.backgroundColor),
    textColor: color(restaurant.theme?.textColor, DEFAULT_THEME.textColor),
    buttonStyle: restaurant.theme?.buttonStyle || DEFAULT_THEME.buttonStyle,
    borderRadius: restaurant.theme?.borderRadius || DEFAULT_THEME.borderRadius,
  };
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick a foreground that stays readable on a known surface (WCAG AA ~4.5). */
export function ensureReadableOn(
  foreground: string,
  background: string,
  fallbacks: string[] = [],
  minimum = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minimum) return foreground;
  for (const candidate of fallbacks) {
    if (/^#[0-9A-Fa-f]{6}$/.test(candidate) && contrastRatio(candidate, background) >= minimum) {
      return candidate;
    }
  }
  return DEFAULT_THEME.textColor;
}

export function getThemeCSSVariables(theme: Required<RestaurantTheme>): Record<string, string> {
  const { primaryColor, secondaryColor, accentColor, backgroundColor, textColor, buttonStyle, borderRadius } =
    theme;

  const borderRadiusMap = {
    sharp: "0px",
    rounded: "0.75rem",
    pill: "9999px",
  };

  // Dish cards, search bar, and body copy sit on light surfaces. A custom theme that
  // pairs white text with a dark page background must not paint white text onto white cards.
  const surfaceText = ensureReadableOn(textColor, LIGHT_SURFACE, [
    secondaryColor,
    primaryColor,
    DEFAULT_THEME.textColor,
    "#111111",
  ]);
  const surfaceMuted = ensureReadableOn(adjustColor(surfaceText, 55), LIGHT_SURFACE, [
    "#6b5a5c",
    "#667085",
    DEFAULT_THEME.textColor,
  ], 3);

  return {
    "--restaurant-primary": primaryColor,
    "--restaurant-primary-light": adjustColor(primaryColor, 20),
    "--restaurant-primary-dark": adjustColor(primaryColor, -20),
    "--restaurant-secondary": secondaryColor,
    "--restaurant-accent": accentColor,
    "--restaurant-background": backgroundColor,
    "--restaurant-text": surfaceText,
    "--restaurant-text-muted": surfaceMuted,
    "--restaurant-on-primary": ensureReadableOn("#ffffff", primaryColor, ["#ffffff", "#111111"]),
    "--restaurant-border-radius": borderRadiusMap[borderRadius],
    "--restaurant-button-style": buttonStyle,
  };
}

function adjustColor(hex: string, amount: number): string {
  const color = hex.replace("#", "");
  const num = Number.parseInt(color, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
