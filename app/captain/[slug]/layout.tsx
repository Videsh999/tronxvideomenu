import { redirect } from "next/navigation";
import CaptainNavigation from "@/components/captain/CaptainNavigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";

export default async function CaptainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !restaurant || !captain) redirect("/captain/login");
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  let pendingApprovals = 0;
  if (assigned.size > 0) {
    try {
      pendingApprovals = (
        await orderService.listPendingCaptainApprovals(captain.restaurantId, [...assigned])
      ).length;
    } catch {
      pendingApprovals = 0;
    }
  }

  return (
    <div className="console min-h-screen bg-[#f4f4f2] text-neutral-900 selection:bg-neutral-200 lg:flex">
      <CaptainNavigation
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        captainName={captain.name}
        pendingApprovals={pendingApprovals}
      />
      <main className="min-w-0 flex-1 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
