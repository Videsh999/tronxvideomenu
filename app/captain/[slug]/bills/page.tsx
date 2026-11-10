import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";

export const dynamic = "force-dynamic";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-bold text-amber-950">Bills locked</h1>
        <p className="mt-2 text-sm text-amber-900/80">
          Your captain account does not have bill view permission. Ask a manager to enable VIEW_BILL.
        </p>
      </div>
    );
  }

  const assigned = new Set(captain.assignedTableIds ?? []);
  const orders = (await orderService.listForRestaurant(captain.restaurantId))
    .filter((order) => assigned.has(order.tableId))
    .filter((order) => !["CANCELLED", "REJECTED"].includes(order.status))
    .slice(0, 40);

  const currency = restaurant.currency ?? "INR";

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bills & payments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Open bills on your assigned tables. Record payment from Active Orders or Captain POS when permitted.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No open bills on your tables.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-semibold">#{order.orderNumber}</td>
                  <td className="px-4 py-3">T{order.tableNumber}</td>
                  <td className="px-4 py-3">{order.status}</td>
                  <td className="px-4 py-3">{order.payment?.status ?? "UNPAID"}</td>
                  <td className="px-4 py-3 font-semibold">{money(order.total ?? 0, currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/captain/${slug}/orders`}
                      className="text-xs font-semibold text-neutral-900 underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
