"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  ClipboardList,
  LogOut,
  Menu,
  ShieldCheck,
  Table2,
  UtensilsCrossed,
  Wallet,
  X,
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
  const [moreOpen, setMoreOpen] = useState(false);
  const root = `/captain/${slug}`;

  const primary = [
    { href: `${root}/tables`, label: "Tables", icon: Table2 },
    { href: `${root}/take-order`, label: "Order", icon: UtensilsCrossed },
    { href: `${root}/bills`, label: "Bill", icon: Wallet },
  ] as const;

  const more = [
    { href: `${root}/orders`, label: "All orders", icon: ClipboardList },
    {
      href: `${root}/approvals`,
      label: "Approvals",
      icon: ShieldCheck,
      badge: pendingApprovals,
    },
    { href: `${root}/requests`, label: "Calls", icon: BellRing },
  ] as const;

  const isActive = (href: string) => pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/captain/logout", { method: "POST" });
    window.location.replace(`/menu/${slug}/captain`);
  };

  return (
    <>
      <aside
        aria-label="Captain navigation"
        className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <Link href={`${root}/tables`} className="mb-5 px-2">
          <BrandMark subtitle="Captain" />
        </Link>
        {restaurantName ? (
          <div className="mx-1 mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">Working at</p>
            <p className="mt-0.5 truncate text-sm font-semibold">{restaurantName}</p>
            {captainName ? <p className="truncate text-xs text-neutral-500">{captainName}</p> : null}
          </div>
        ) : null}
        <nav className="space-y-1">
          {[...primary, ...more].map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            const badge = "badge" in link && typeof link.badge === "number" ? link.badge : 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold transition ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{link.label}</span>
                {badge > 0 ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white text-neutral-900" : "bg-amber-500 text-white"}`}>
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
          className="mt-auto inline-flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur-xl lg:hidden">
        <Link href={`${root}/tables`}>
          <BrandMark subtitle={restaurantName ?? "Captain"} />
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Logout"
          className="grid h-11 w-11 place-items-center rounded-xl border border-neutral-200 text-neutral-600"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <nav
        aria-label="Captain navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-2 pt-2 lg:hidden"
      >
        {moreOpen ? (
          <div className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-bold text-neutral-700">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2">
              {more.map((link) => {
                const Icon = link.icon;
                const badge = "badge" in link && typeof link.badge === "number" ? link.badge : 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-base font-bold ${
                      isActive(link.href) ? "bg-neutral-900 text-white" : "bg-neutral-50 text-neutral-800"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{link.label}</span>
                    {badge > 0 ? (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 pb-1">
          {primary.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold ${
                    active ? "bg-neutral-900 text-white" : "text-neutral-600"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className={`relative flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold ${
                moreOpen ? "bg-neutral-900 text-white" : "text-neutral-600"
              }`}
            >
              <Menu className="h-6 w-6" />
              More
              {pendingApprovals > 0 ? (
                <span className="absolute right-3 top-2 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
