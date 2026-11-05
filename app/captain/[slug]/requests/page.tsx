import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCaptain } from "@/lib/auth-server";
import { serviceRequestService } from "@/lib/services/service-request.service";
import CaptainRequestsClient from "@/components/captain/CaptainRequestsClient";

export const dynamic = "force-dynamic";

export default async function CaptainRequestsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);

  const requests = await serviceRequestService.listOpenForCaptain(
    captain.restaurantId,
    captain.assignedTableIds ?? [],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Floor care</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Customer requests</h1>
          <p className="mt-1 text-sm text-neutral-500">Water, cutlery, bill, cleaning — acknowledge and close.</p>
        </div>
        <Link
          href={`/captain/${slug}/tables`}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold"
        >
          Open My Tables
        </Link>
      </header>
      <CaptainRequestsClient initialRequests={requests} />
    </div>
  );
}
