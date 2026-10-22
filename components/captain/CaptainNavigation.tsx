"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut, QrCode } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

export default function CaptainNavigation({ slug, restaurantName }: { slug: string; restaurantName?: string }) {
  const pathname = usePathname();
  const root = `/captain/${slug}`;
  const links = [
    { href: root, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${root}/orders`, label: "Orders", icon: ClipboardList, exact: false },
    { href: `${root}/tables`, label: "Tables", icon: QrCode, exact: false },
  ];
  const isActive = (href: string, exact: boolean) => exact ? pathname === href : pathname.startsWith(href);
  const logout = async () => {
    await fetch("/api/captain/logout", { method: "POST" });
    window.location.replace(`/menu/${slug}/captain`);
  };

  return <>
    {/* Desktop sidebar */}
    <aside aria-label="Captain navigation" className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white/95 px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <Link href={root} className="mb-6 px-2"><BrandMark subtitle="Captain / waiter" /></Link>
      {restaurantName ? <div className="mx-1 mb-5 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">On shift at</p><p className="mt-0.5 truncate text-sm font-semibold">{restaurantName}</p></div> : null}
      <nav className="space-y-0.5">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"}`}>
            {active ? <span className="bg-brand-gradient absolute inset-y-2 left-0 w-[3px] rounded-full" /> : null}
            <Icon className={`h-4 w-4 ${active ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-700"}`} />{label}
          </Link>;
        })}
      </nav>
      <button type="button" onClick={() => void logout()} className="mt-auto inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-4 w-4" />Sign out</button>
    </aside>

    {/* Mobile top bar */}
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white/85 px-4 backdrop-blur-xl lg:hidden">
      <Link href={root}><BrandMark subtitle={restaurantName ?? "Captain workspace"} /></Link>
      <button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-4 w-4" /></button>
    </header>

    {/* Mobile bottom tab bar */}
    <nav aria-label="Captain navigation" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-2 pt-2 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-3 gap-1">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}>
            <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? "bg-neutral-100" : ""}`}><Icon className="h-5 w-5" /></span>
            {label}
          </Link></li>;
        })}
      </ul>
    </nav>
  </>;
}
