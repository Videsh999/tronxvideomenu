import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ReceiptText } from "lucide-react";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

export default async function RestaurantSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin?.restaurantId || !admin.restaurantSlug) redirect(`/admin/login?next=/admin/${slug}/settings`);
  if (admin.restaurantSlug !== slug) redirect(`/admin/${admin.restaurantSlug}/settings`);
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) redirect(`/admin/${slug}`);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Central configuration</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Restaurant settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">One saved configuration powers customer QR checkout, Captain billing, Admin POS, invoices, and reports. Delivery settings are intentionally not included.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href={`/admin/${slug}/profile`} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-900">
          <Building2 className="h-5 w-5 text-neutral-500" />
          <h2 className="mt-4 text-lg font-bold">Restaurant profile</h2>
          <p className="mt-1 text-sm text-neutral-500">Name, logo, contact details, address, hours, and customer-facing brand information.</p>
        </Link>
        <Link href={`/admin/${slug}/settings/billing`} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-900">
          <ReceiptText className="h-5 w-5 text-neutral-500" />
          <h2 className="mt-4 text-lg font-bold">Tax & charges</h2>
          <p className="mt-1 text-sm text-neutral-500">GST, inclusive/exclusive pricing, packaging, service charge, UPI, and a live bill preview.</p>
        </Link>
      </div>
    </div>
  );
}
