import { notFound } from "next/navigation";
import DevicesManager from "@/components/admin/DevicesManager";
import { restaurantService } from "@/lib/services/restaurant.service";
import { hasRestaurantFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function DevicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant) notFound();
  const allowed =
    hasRestaurantFeature(restaurant, "HARDWARE_SIMULATOR") ||
    hasRestaurantFeature(restaurant, "HARDWARE_PRINTING") ||
    hasRestaurantFeature(restaurant, "HARDWARE_LOCAL_CONNECTOR");
  if (!allowed) notFound();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Hardware registry, simulator controls, and print job queue.
        </p>
      </div>
      <DevicesManager />
    </div>
  );
}
