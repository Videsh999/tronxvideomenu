"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FeatureKey } from "@/types";

type AiNavLink = {
  suffix: string;
  label: string;
  exact?: boolean;
  /** When set, tab shows only if that feature is entitled. Overview has no gate. */
  feature?: FeatureKey;
};

const LINKS: AiNavLink[] = [
  { suffix: "", label: "Overview", exact: true },
  { suffix: "/assistant", label: "Assistant", feature: "AI_BUSINESS_ASSISTANT" },
  { suffix: "/forecast", label: "Forecast", feature: "AI_SALES_FORECAST" },
  { suffix: "/inventory", label: "Inventory", feature: "AI_INVENTORY_INTELLIGENCE" },
  { suffix: "/menu", label: "Menu", feature: "AI_MENU_INTELLIGENCE" },
  { suffix: "/alerts", label: "Alerts", feature: "AI_OPERATIONAL_ALERTS" },
  { suffix: "/evaluation", label: "Evaluation", feature: "AI_BUSINESS_ASSISTANT" },
];

export default function AiIntelligenceShell({
  slug,
  features,
  children,
}: {
  slug: string;
  features: Partial<Record<FeatureKey, boolean>>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/${slug}/ai`;
  const visible = LINKS.filter((link) => !link.feature || features[link.feature]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">AI Intelligence</h1>
        <p className="text-sm text-neutral-600">
          Data-grounded insights for this outlet. Figures come from verified analytics — not model guesses.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {visible.map((link) => {
          const href = `${base}${link.suffix}`;
          const active = link.exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
