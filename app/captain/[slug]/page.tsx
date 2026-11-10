import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BellRing,
  ClipboardList,
  Flame,
  ShieldCheck,
  Table2,
  Timer,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { requireCaptain } from "@/lib/auth-server";
import { getAllRestaurantFeatures } from "@/lib/feature-access";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import { serviceRequestService } from "@/lib/services/service-request.service";
import { enrichCaptainTables } from "@/lib/captain-floor";
import { isPendingCaptainApproval } from "@/lib/order-authorization";

export const dynamic = "force-dynamic";

export default async function CaptainDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !captain || !restaurant) redirect("/captain/login");
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const features = getAllRestaurantFeatures(restaurant);
  const assignedIds = new Set(captain.assignedTableIds ?? []);
  const [orders, tables, requests] = await Promise.all([
    features.ORDER_MANAGEMENT ? orderService.listForRestaurant(captain.restaurantId) : Promise.resolve([]),
    features.TABLE_MANAGEMENT ? tableService.list(captain.restaurantId) : Promise.resolve([]),
    serviceRequestService.listOpenForCaptain(captain.restaurantId, [...assignedIds]).catch(() => []),
  ]);

  const myTables = enrichCaptainTables(tables, orders, assignedIds);
  const myOrders = orders.filter(
    (order) =>
      assignedIds.has(order.tableId) &&
      !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status),
  );
  const pendingApprovals = myOrders.filter((order) => isPendingCaptainApproval(order)).length;
  const awaitingKitchen = myOrders.filter((order) => order.status === "PENDING" && !isPendingCaptainApproval(order)).length;
  const preparing = myOrders.filter((order) => ["ACCEPTED", "PREPARING"].includes(order.status)).length;
  const ready = myOrders.filter((order) => order.status === "READY").length;
  const delayed = myOrders.filter((order) => {
    if (["READY", "SERVED", "COMPLETED"].includes(order.status)) return false;
    return Date.now() - new Date(order.createdAt).getTime() > 25 * 60 * 1000;
  }).length;
  const billRequests = myTables.filter((row) =>
    ["BILL_REQUESTED", "PAYMENT_PENDING"].includes(row.table.status),
  ).length;
  const available = myTables.filter((row) => row.table.status === "OPEN").length;
  const occupied = myTables.filter((row) =>
    ["OCCUPIED", "BILL_REQUESTED", "PAYMENT_PENDING"].includes(row.table.status),
  ).length;

  const metrics = [
    { label: "Assigned tables", value: myTables.length, hint: `${available} available`, href: `/captain/${slug}/tables` },
    { label: "In service", value: occupied, hint: "Occupied / bill pending", href: `/captain/${slug}/tables` },
    { label: "Pending approvals", value: pendingApprovals, hint: "QR waiting on you", href: `/captain/${slug}/approvals` },
    { label: "Awaiting kitchen", value: awaitingKitchen, hint: "Authorized, not cooking", href: `/captain/${slug}/orders` },
    { label: "Preparing", value: preparing, hint: `${ready} ready to serve`, href: `/captain/${slug}/kitchen` },
    { label: "Delayed", value: delayed, hint: "> 25 min in kitchen", href: `/captain/${slug}/kitchen` },
    { label: "Bill requests", value: billRequests, hint: "Awaiting cashier", href: `/captain/${slug}/tables` },
    { label: "Guest requests", value: requests.length, hint: "Open assistance", href: `/captain/${slug}/requests` },
  ];

  const quick = [
    { href: `/captain/${slug}/take-order`, label: "New Order", icon: UtensilsCrossed, primary: true },
    { href: `/captain/${slug}/approvals`, label: "Pending Approvals", icon: ShieldCheck },
    { href: `/captain/${slug}/tables`, label: "Open My Tables", icon: Table2 },
    { href: `/captain/${slug}/kitchen`, label: "Kitchen Updates", icon: Flame },
    { href: `/captain/${slug}/requests`, label: "View Requests", icon: BellRing },
  ];

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,#f5f5f4,transparent_55%),linear-gradient(135deg,#111_0%,#404040_100%)] p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">{restaurant.name}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {captain.name.split(" ")[0]} · floor console
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          Two ways to order — you place it for guests without a phone, or tick-approve what they ordered on QR. Only then does kitchen get the ticket.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-sm">
            <p className="font-bold text-white">1 · Guest has no phone</p>
            <p className="mt-1 text-white/70">Open their table → New Order → you enter dishes → Confirm & authorize → KOT goes to kitchen.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-sm">
            <p className="font-bold text-white">2 · Guest ordered on QR</p>
            <p className="mt-1 text-white/70">Opens in Approvals for your tables → review → Approve tick → then KOT. Without your tick, kitchen sees nothing.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {quick.map(({ href, label, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                primary
                  ? "bg-white text-neutral-900 hover:bg-neutral-100"
                  : "border border-white/25 bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      <section aria-label="Live floor metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-900"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {metric.label}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{metric.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{metric.hint}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">My tables</h2>
            <Link href={`/captain/${slug}/tables`} className="text-sm font-semibold text-neutral-600 underline">
              All tables
            </Link>
          </div>
          {myTables.length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              No tables assigned yet. Ask a manager to assign your section in Admin → Captains.
            </p>
          ) : (
            <ul className="space-y-2">
              {myTables.slice(0, 8).map(({ table, activeOrder }) => (
                <li key={table.id}>
                  <Link
                    href={`/captain/${slug}/tables/${table.id}`}
                    className="flex items-center justify-between rounded-2xl border border-neutral-100 px-3 py-2.5 hover:border-neutral-900"
                  >
                    <span className="font-semibold">T{table.tableNumber}</span>
                    <span className="text-xs text-neutral-500">{table.status.replace(/_/g, " ")}</span>
                    <span className="text-xs tabular-nums text-neutral-600">
                      {activeOrder ? `#${activeOrder.orderNumber}` : "Idle"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Needs attention</h2>
            <Link href={`/captain/${slug}/orders`} className="text-sm font-semibold text-neutral-600 underline">
              Active orders
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {ready > 0 ? (
              <li className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-900">
                <ClipboardList className="h-4 w-4" /> {ready} order{ready === 1 ? "" : "s"} ready to serve
              </li>
            ) : null}
            {delayed > 0 ? (
              <li className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-amber-950">
                <Timer className="h-4 w-4" /> {delayed} delayed in kitchen
              </li>
            ) : null}
            {billRequests > 0 ? (
              <li className="flex items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-violet-950">
                <Wallet className="h-4 w-4" /> {billRequests} bill handoff{billRequests === 1 ? "" : "s"}
              </li>
            ) : null}
            {requests.slice(0, 5).map((request) => (
              <li key={request.id} className="rounded-2xl border border-neutral-100 px-3 py-2">
                T{request.tableNumber} · {request.type.replaceAll("_", " ")} · {request.status}
              </li>
            ))}
            {ready === 0 && delayed === 0 && billRequests === 0 && requests.length === 0 ? (
              <li className="text-neutral-500">Floor is clear — no urgent items.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
