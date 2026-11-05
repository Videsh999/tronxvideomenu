"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { suffix: string; label: string; exact?: boolean }[] = [
  { suffix: "", label: "Overview", exact: true },
  { suffix: "/assistant", label: "Assistant" },
  { suffix: "/forecast", label: "Forecast" },
  { suffix: "/inventory", label: "Inventory" },
  { suffix: "/menu", label: "Menu" },
  { suffix: "/alerts", label: "Alerts" },
  { suffix: "/evaluation", label: "Evaluation" },
];

export default function AiIntelligenceShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/${slug}/ai`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">AI Intelligence</h1>
        <p className="text-sm text-neutral-600">
          Data-grounded insights for this outlet. Figures come from verified analytics — not model guesses.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {LINKS.map((link) => {
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
