"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import type { FeatureKey } from "@/types";

type AdminShellProps = {
  children: React.ReactNode;
  features: Record<FeatureKey, boolean>;
  restaurantIsOpen: boolean;
  restaurantName?: string;
  restaurantLogoUrl?: string;
};

export default function AdminShell({ children, features, restaurantIsOpen, restaurantName, restaurantLogoUrl }: AdminShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const restaurantSlug = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)?.[1] ?? "";
  if (pathname === "/admin/login") return <>{children}</>;
  return <div className="console flex min-h-screen text-neutral-900 selection:bg-neutral-200">
    <AdminSidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      features={features}
      restaurantName={restaurantName}
      restaurantLogoUrl={restaurantLogoUrl}
      restaurantIsOpen={restaurantIsOpen}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} restaurantSlug={restaurantSlug || undefined} restaurantName={restaurantName} restaurantIsOpen={restaurantIsOpen} />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10"><div className="mx-auto max-w-6xl animate-fade-up">{children}</div></main>
    </div>
  </div>;
}
