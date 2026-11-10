import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import { enrichCaptainTables } from "@/lib/captain-floor";

export const dynamic = "force-dynamic";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function CaptainShiftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);

  const assigned = new Set(captain.assignedTableIds ?? []);
  const [orders, tables] = await Promise.all([
    orderService.listForRestaurant(captain.restaurantId),
    tableService.list(captain.restaurantId),
  ]);
  const myTables = enrichCaptainTables(tables, orders, assigned);
  const today = new Date().toISOString().slice(0, 10);
  const mineToday = orders.filter(
    (order) => assigned.has(order.tableId) && order.createdAt.startsWith(today),
  );
  const paid = mineToday.filter((order) => order.payment?.status === "PAID");
  const sales = paid.reduce((sum, order) => sum + order.total, 0);
  const cancelled = mineToday.filter((order) =>
    ["CANCELLED", "REJECTED"].includes(order.status),
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Shift summary</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Today on your floor</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Read-only snapshot for {captain.name}. Payment settlement stays with authorized POS/cashier roles.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Orders today", value: String(mineToday.length) },
          { label: "Paid checks", value: String(paid.length) },
          { label: "Sales (paid)", value: money(sales, restaurant.currency ?? "INR") },
          { label: "Cancelled", value: String(cancelled) },
        ].map((card) => (
          <article key={card.label} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Assigned section</h2>
        <p className="mt-1 text-sm text-neutral-500">{myTables.length} tables under your name.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {myTables.map(({ table }) => (
            <li
              key={table.id}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm font-semibold"
            >
              T{table.tableNumber} · {table.status.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
