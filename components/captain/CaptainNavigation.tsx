"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Table2, UtensilsCrossed } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

/** Captain nav: only Tables + Order. No extra menus that confuse floor staff. */
export default function CaptainNavigation({
  slug,
  restaurantName,
  captainName,
}: {
  slug: string;
  restaurantName?: string;
  captainName?: string;
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const root = `/captain/${slug}`;
  const links = [
    { href: `${root}/tables`, label: "Tables", icon: Table2 },
    { href: `${root}/take-order`, label: "Order", icon: UtensilsCrossed },
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
        className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <Link href={`${root}/tables`} className="mb-5 px-2">
          <BrandMark subtitle="Captain" />
        </Link>
        {restaurantName ? (
          <div className="mx-1 mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="truncate text-sm font-bold">{restaurantName}</p>
            {captainName ? <p className="truncate text-xs text-neutral-500">{captainName}</p> : null}
          </div>
        ) : null}
        <nav className="space-y-1">
          {links.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 text-lg font-black ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <Icon className="h-6 w-6" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        <Link href={`${root}/tables`}>
          <BrandMark subtitle={restaurantName ?? "Captain"} />
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Logout"
          className="grid h-11 w-11 place-items-center rounded-xl border border-neutral-200"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <nav
        aria-label="Captain navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-3 pt-2 lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-2 gap-2 pb-2">
          {links.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-base font-black ${
                    active ? "bg-neutral-900 text-white" : "bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
