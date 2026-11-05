import { redirect } from "next/navigation";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import BillingSettingsForm from "@/components/admin/BillingSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminBillingSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin?.restaurantId || !admin.restaurantSlug) {
    redirect(`/admin/login?next=/admin/${slug}/settings/billing`);
  }
  if (admin.restaurantSlug !== slug) redirect(`/admin/${admin.restaurantSlug}/settings/billing`);

  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) redirect(`/admin/${slug}`);

  return (
    <BillingSettingsForm
      restaurantId={restaurant.id}
      initialBilling={{
        currency: restaurant.currency ?? "INR",
        priceMode: "EXCLUSIVE",
        gstEnabled: true,
        gstRatePercent: 5,
        supplyType: "INTRA_STATE",
        taxLabel: "GST",
        packagingEnabled: false,
        packagingMethod: "PER_ORDER",
        packagingAmount: 0,
        serviceChargeEnabled: false,
        serviceChargeType: "PERCENT",
        serviceChargePercent: 0,
        ...(restaurant.billing ?? {}),
      }}
    />
  );
}
