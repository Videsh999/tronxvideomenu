"use client";

import { Menu, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/shared/LogoutButton";

type AdminHeaderProps = {
  onToggleSidebar: () => void;
  restaurantSlug?: string;
  restaurantName?: string;
  restaurantIsOpen: boolean;
};

const sectionTitles: Record<string, string> = {
  menu: "Menu",
  categories: "Categories",
  dishes: "Dishes",
  addons: "Add-ons",
  orders: "Orders",
  tables: "Tables & QR",
  reservations: "Reservations",
  captains: "Captains",
  profile: "Restaurant profile",
  availability: "Availability",
  media: "Media library",
};

export default function AdminHeader({
  onToggleSidebar,
  restaurantSlug,
  restaurantName,
  restaurantIsOpen,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const displayName = restaurantName ?? (restaurantSlug
    ? restaurantSlug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Restaurant Admin");
  const lastSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const pageTitle = sectionTitles[lastSegment] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open navigation menu"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-neutral-500">{displayName}</p>
          <h2 className="truncate text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">{pageTitle}</h2>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 md:flex ${restaurantIsOpen ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <span className={`h-2 w-2 rounded-full ${restaurantIsOpen ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
          <span className={`text-xs font-medium ${restaurantIsOpen ? "text-emerald-700" : "text-rose-600"}`}>
            {restaurantIsOpen ? "Open for orders" : "Closed for orders"}
          </span>
        </div>

        <Link
          href={restaurantSlug ? `/menu/${restaurantSlug}` : "/"}
          target="_blank"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 sm:px-3.5"
        >
          <span className="hidden sm:inline">Preview menu</span>
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only sm:hidden">Preview menu</span>
        </Link>
        <LogoutButton
          redirectTo={restaurantSlug ? `/menu/${restaurantSlug}/admin` : "/admin/login"}
          role="RESTAURANT_ADMIN"
          className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        />
      </div>
    </header>
  );
}
