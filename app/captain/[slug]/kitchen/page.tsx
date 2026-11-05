import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";

export default async function CaptainKitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const [kitchen, tables] = await Promise.all([
    orderService.listKitchen(captain.restaurantId),
    import("@/lib/services/table.service").then((mod) => mod.tableService.list(captain.restaurantId)),
  ]);
  const assignedNumbers = new Set(
    tables.filter((table) => assigned.has(table.id)).map((table) => table.tableNumber),
  );
  const scoped = kitchen.filter((order) => assignedNumbers.has(order.tableNumber));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Kitchen tracking</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">KOT status</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Station-routed tickets for your tables. Printer failures never drop the KDS ticket.
        </p>
      </header>

      {scoped.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No kitchen tickets for your assigned tables right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {scoped.map((order) => (
            <li key={order.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">
                    Order #{order.orderNumber} · Table {order.tableNumber}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">{order.status}</p>
                </div>
                <Link
                  href={`/captain/${slug}/tables`}
                  className="text-sm font-semibold underline"
                >
                  Open tables
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <li
                    key={item.lineId ?? `${item.dishId}-${item.variantNameSnapshot}`}
                    className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {item.quantity}× {item.dishNameSnapshot}
                      {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}
                    </span>
                    <span className="text-xs font-bold uppercase text-neutral-500">
                      {item.kitchenStation ?? "MAIN"} · {item.preparationStatus ?? "QUEUED"}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
