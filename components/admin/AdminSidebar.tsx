"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  LayoutDashboard,
  UtensilsCrossed,
  FolderTree,
  Sliders,
  Store,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  QrCode,
  ClipboardList,
  Users,
  CalendarDays,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FeatureKey } from "@/types";
import BrandMark from "@/components/shared/BrandMark";
import SmartImage from "@/components/shared/SmartImage";

type AdminSidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  features: Record<FeatureKey, boolean>;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  restaurantIsOpen?: boolean;
};

type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean };

export default function AdminSidebar({
  isOpen = false,
  onClose,
  features,
  restaurantName,
  restaurantLogoUrl,
  restaurantIsOpen = false,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const restaurantSlug = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)?.[1] ?? "";

  const buildRoute = (suffix: string) =>
    restaurantSlug ? `/admin/${restaurantSlug}${suffix}` : `/admin${suffix}`;

  const isActive = (path: string, exact = false) => {
    if (exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Overview",
      items: [{ label: "Dashboard", href: restaurantSlug ? `/admin/${restaurantSlug}` : "/admin", icon: LayoutDashboard, exact: true }],
    },
    {
      title: "Menu",
      items: [
        { label: "Menu hub", href: buildRoute("/menu"), icon: BookOpen, exact: true },
        { label: "Categories", href: buildRoute("/menu/categories"), icon: FolderTree },
        { label: "Dishes", href: buildRoute("/menu/dishes"), icon: UtensilsCrossed },
        { label: "Add-ons", href: buildRoute("/menu/addons"), icon: Sliders },
      ],
    },
    {
      title: "Operations",
      items: [
        ...(features.ORDER_MANAGEMENT ? [{ label: "Orders", href: buildRoute("/orders"), icon: ClipboardList }] : []),
        ...(features.TABLE_MANAGEMENT ? [{ label: "Tables & QR", href: buildRoute("/tables"), icon: QrCode }] : []),
        ...(features.RESERVATIONS ? [{ label: "Reservations", href: buildRoute("/reservations"), icon: CalendarDays }] : []),
        ...(features.CAPTAIN_ACCESS ? [{ label: "Captains", href: buildRoute("/captains"), icon: Users }] : []),
      ],
    },
    {
      title: "Restaurant",
      items: [
        { label: "Profile", href: buildRoute("/profile"), icon: Store },
        { label: "Availability", href: buildRoute("/availability"), icon: Clock },
        ...(features.MEDIA_LIBRARY ? [{ label: "Media library", href: buildRoute("/media"), icon: ImageIcon }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-neutral-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href={restaurantSlug ? `/admin/${restaurantSlug}` : "/admin"} onClick={onClose}>
            <BrandMark subtitle="Restaurant console" />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {restaurantName ? (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
              {restaurantLogoUrl ? (
                <SmartImage src={restaurantLogoUrl} alt="" sizes="40px" className="object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-sm font-bold">{restaurantName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{restaurantName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${restaurantIsOpen ? "bg-emerald-400" : "bg-rose-400"}`} />
                {restaurantIsOpen ? "Open for orders" : "Closed for orders"}
              </p>
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-none">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          active ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                        }`}
                      >
                        {active ? <span className="bg-brand-gradient absolute inset-y-2 left-0 w-[3px] rounded-full" /> : null}
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-700"}`} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-200 p-4">
          <Link
            href={restaurantSlug ? `/menu/${restaurantSlug}` : "/admin/login"}
            target="_blank"
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <span>Open customer menu</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </div>
      </aside>
    </>
  );
}
