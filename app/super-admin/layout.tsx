"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, LayoutDashboard, Menu, PlusCircle, Store, X } from "lucide-react";
import LogoutButton from "@/components/shared/LogoutButton";
import BrandMark from "@/components/shared/BrandMark";

const navItems = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/restaurants", label: "Restaurants", icon: Store, exact: true },
  { href: "/super-admin/restaurants/new", label: "Add restaurant", icon: PlusCircle, exact: true },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pathname === "/super-admin/login") return children;

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const current = navItems.find((item) => isActive(item.href, item.exact))?.label
    ?? (pathname.endsWith("/edit") ? "Manage restaurant" : "Super Admin");

  return (
    <div className="console flex min-h-screen text-neutral-900 selection:bg-neutral-200">
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-sm transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-label="Super admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-neutral-200 bg-white/95 px-3 py-4 backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/super-admin" onClick={() => setOpen(false)}><BrandMark subtitle="Super Admin" /></Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">Platform</p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"}`}
              >
                {active ? <span className="bg-brand-gradient absolute inset-y-2 left-0 w-[3px] rounded-full" /> : null}
                <Icon className={`h-4 w-4 ${active ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-700"}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-neutral-200 pt-4">
          <Link href="/" target="_blank" className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900">
            Public site <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <LogoutButton
            redirectTo="/super-admin/login"
            role="SUPER_ADMIN"
            showLabel
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation menu" className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] text-neutral-500">Super Admin</p>
            <p className="truncate text-sm font-semibold">{current}</p>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-6xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
