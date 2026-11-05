import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCaptain } from "@/lib/auth-server";
import { tableService } from "@/lib/services/table.service";
import CaptainTables from "@/components/captain/CaptainTables";

export const dynamic = "force-dynamic";

export default async function CaptainTablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("TABLE_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const assignedIds = new Set(captain.assignedTableIds ?? []);
  const allTables = await tableService.list(captain.restaurantId);
  const tables =
    assignedIds.size === 0
      ? []
      : allTables.filter((table) => assignedIds.has(table.id));

  return (
    <div className="space-y-4">
      {assignedIds.size === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No tables are assigned to you yet. Ask a manager to assign tables in Admin → Captains.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-500">
            Showing {tables.length} assigned table{tables.length === 1 ? "" : "s"}.
          </p>
          <Link
            href={`/captain/${slug}/take-order`}
            className="inline-flex min-h-11 items-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white"
          >
            Take order
          </Link>
        </div>
      )}
      <CaptainTables initialTables={tables} assignedOnly />
    </div>
  );
}
