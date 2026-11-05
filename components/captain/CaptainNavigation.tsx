"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  ClipboardList,
  Flame,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Table2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

export default function CaptainNavigation({
  slug,
  restaurantName,
  captainName,
  pendingApprovals = 0,
}: {
  slug: string;
  restaurantName?: string;
  captainName?: string;
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const root = `/captain/${slug}`;
  const links = [
    { href: root, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${root}/tables`, label: "My Tables", icon: Table2, exact: false },
    { href: `${root}/take-order`, label: "New Order", icon: UtensilsCrossed, exact: false },
    {
      href: `${root}/approvals`,
      label: "Approvals",
      icon: ShieldCheck,
      exact: false,
      badge: pendingApprovals,
    },
    { href: `${root}/orders`, label: "Active", icon: ClipboardList, exact: false },
    { href: `${root}/kitchen`, label: "Kitchen", icon: Flame, exact: false },
    { href: `${root}/requests`, label: "Requests", icon: BellRing, exact: false },
    { href: `${root}/shift`, label: "Shift", icon: Wallet, exact: false },
  ] as const;
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const logout = async () => {
    await fetch("/api/captain/logout", { method: "POST" });
    window.location.replace(`/menu/${slug}/captain`);
  };

  return (
    <>
      <aside
        aria-label="Captain navigation"
        className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-[linear-gradient(180deg,#fff_0%,#fafafa_100%)] px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <Link href={root} className="mb-5 px-2">
          <BrandMark subtitle="Captain console" />
        </Link>
        {restaurantName ? (
          <div className="mx-1 mb-4 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">On floor</p>
            <p className="mt-0.5 truncate text-sm font-semibold">{restaurantName}</p>
            {captainName ? <p className="truncate text-xs text-neutral-500">{captainName}</p> : null}
          </div>
        ) : null}
        <nav className="space-y-0.5">
          {links.map((link) => {
            const active = isActive(link.href, link.exact);
            const badge = "badge" in link ? link.badge : 0;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-neutral-500"}`} />
                <span className="flex-1">{link.label}</span>
                {badge && badge > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? "bg-white text-neutral-900" : "bg-amber-500 text-white"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href={root}>
          <BrandMark subtitle={restaurantName ?? "Captain"} />
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Sign out"
          className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 text-neutral-500"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <nav
        aria-label="Captain navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-1 pt-1.5 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-8 gap-0.5">
          {links.map((link) => {
            const active = isActive(link.href, link.exact);
            const badge = "badge" in link ? link.badge : 0;
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1 text-[9px] font-semibold transition ${
                    active ? "text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  <span
                    className={`grid h-7 w-9 place-items-center rounded-full ${active ? "bg-neutral-900 text-white" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {link.label.split(" ")[0]}
                  {badge && badge > 0 ? (
                    <span className="absolute right-1 top-0 rounded-full bg-amber-500 px-1 text-[8px] font-bold text-white">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
