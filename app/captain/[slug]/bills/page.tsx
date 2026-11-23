import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";
import RememberCaptainScreen from "@/components/captain/RememberCaptainScreen";

export const dynamic = "force-dynamic";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function CaptainBillsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/login?next=/captain/${slug}/bills`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}/bills`);

  const permissions = resolveCaptainPermissions(captain);
  if (!permissions.viewBill && !permissions.requestBill) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-black text-amber-950">Bills locked</h1>
        <p className="mt-2 text-base text-amber-900">Ask the owner to open bill access for you.</p>
      </div>
    );
  }

  const assigned = new Set(captain.assignedTableIds ?? []);
  const orders = (await orderService.listOpenForRestaurant(captain.restaurantId))
    .filter((order) => assigned.has(order.tableId))
    .filter((order) => !["CANCELLED", "REJECTED"].includes(order.status))
    .slice(0, 40);

  const currency = restaurant.currency ?? "INR";

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <RememberCaptainScreen
        path={`/captain/${slug}/bills`}
        snap={{
          kind: "list",
          title: "Bills",
          rows: orders.slice(0, 20).map((order) => ({
            title: `Table ${order.tableNumber}`,
            detail: money(order.total ?? 0, currency),
          })),
        }}
      />
      <header>
        <h1 className="text-3xl font-black tracking-tight">Bills</h1>
        <p className="mt-1 text-base text-neutral-600">Tap a table. Take money. Free table.</p>
      </header>

      {orders.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-base text-neutral-500">
          No open bills. Start from Tables.
        </p>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => {
            const unpaid = (order.payment?.status ?? "UNPAID") !== "PAID";
            return (
              <Link
                key={order.id}
                href={`/captain/${slug}/tables/${encodeURIComponent(order.tableId)}?bill=1`}
                className={`flex min-h-20 items-center justify-between gap-3 rounded-3xl border-2 px-4 py-4 ${
                  unpaid ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div>
                  <p className="text-2xl font-black">Table {order.tableNumber}</p>
                  <p className="text-sm font-semibold text-neutral-600">
                    {unpaid ? "Pay now" : "Paid"} · Order #{order.orderNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">{money(order.total ?? 0, currency)}</p>
                  <p className="text-sm font-bold text-blue-700">Open bill →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
