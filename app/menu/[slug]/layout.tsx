import type { Metadata } from "next";
import { restaurantService } from "@/lib/services/restaurant.service";

// Guests who install from a menu get an app named after the restaurant, scoped to that menu.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug).catch(() => null);
  if (!restaurant || restaurant.isActive === false) return {};
  const name = restaurant.name?.trim();
  return {
    manifest: `/menu/${encodeURIComponent(restaurant.slug || slug)}/manifest.webmanifest`,
    ...(name ? { applicationName: name, appleWebApp: { capable: true, title: name, statusBarStyle: "default" } } : {}),
  };
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
