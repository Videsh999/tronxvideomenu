import { notFound } from "next/navigation";
import MenuImportWizard from "@/components/admin/MenuImportWizard";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function AdminMenuImportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || restaurant.isActive === false) notFound();
  const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
  if (!feature.allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <h1 className="text-xl font-bold">Menu import unavailable</h1>
        <p className="mt-2">{feature.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Import menu from Excel</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Upload a spreadsheet to create categories, dishes, Half/Full sizes, and add-ons — review everything before it goes live.
        </p>
      </div>
      <MenuImportWizard />
    </div>
  );
}
