import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardList, Flame, QrCode, Users } from "lucide-react";
import { requireCaptain } from "@/lib/auth-server";
import { getAllRestaurantFeatures } from "@/lib/feature-access";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";

export const dynamic = "force-dynamic";

export default async function CaptainDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !captain || !restaurant) redirect("/captain/login");
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);
  const features = getAllRestaurantFeatures(restaurant);
  const [orders, tables] = await Promise.all([
    features.ORDER_MANAGEMENT ? orderService.listForRestaurant(captain.restaurantId) : Promise.resolve([]),
    features.TABLE_MANAGEMENT ? tableService.list(captain.restaurantId) : Promise.resolve([]),
  ]);
  const activeOrders = orders.filter((order) => !["SERVED", "CANCELLED"].includes(order.status));
  const readyOrders = activeOrders.filter((order) => order.status === "READY").length;
  const pendingOrders = activeOrders.filter((order) => order.status === "PENDING").length;
  const occupiedTables = tables.filter((table) => table.status === "OCCUPIED").length;
  const stats = [
    ...(features.ORDER_MANAGEMENT ? [
      { label: "Active orders", value: activeOrders.length, hint: `${pendingOrders} awaiting acceptance`, icon: Flame },
      { label: "Ready to serve", value: readyOrders, hint: "Pick up from the pass", icon: ClipboardList },
    ] : []),
    ...(features.TABLE_MANAGEMENT ? [{ label: "Tables occupied", value: `${occupiedTables}/${tables.length}`, hint: "Across the floor", icon: Users }] : []),
  ];

  return <div className="space-y-6">
    <header>
      <p className="text-sm text-neutral-500">{restaurant.name}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Hello, {captain.name.split(" ")[0]} 👋</h1>
      <p className="mt-2 text-sm text-neutral-500">{stats.length ? "Here is the current service overview." : "Orders and tables aren't switched on for this restaurant yet. Ask your manager to enable them."}</p>
    </header>

    {stats.length ? <section aria-label="Service overview" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {stats.map(({ label, value, hint, icon: Icon }) => <article key={label} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:block">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-900"><Icon className="h-5 w-5" /></span>
        <div className="sm:mt-4">
          <p className="text-xs font-medium text-neutral-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>
        </div>
      </article>)}
    </section> : null}

    <div className="grid gap-3 sm:grid-cols-2">
      {features.ORDER_MANAGEMENT ? <Link href={`/captain/${slug}/orders`} className="group flex items-center justify-between gap-4 rounded-2xl bg-neutral-900 p-5 text-white transition hover:bg-neutral-800">
        <span className="flex items-center gap-3"><ClipboardList className="h-5 w-5" /><span><span className="block font-bold">Order queue</span><span className="block text-xs text-white/70">Update statuses & record payments</span></span></span>
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </Link> : null}
      {features.TABLE_MANAGEMENT ? <Link href={`/captain/${slug}/tables`} className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-300 bg-white p-5 transition hover:bg-neutral-100">
        <span className="flex items-center gap-3"><QrCode className="h-5 w-5 text-neutral-600" /><span><span className="block font-bold">Tables</span><span className="block text-xs text-neutral-500">Floor status at a glance</span></span></span>
        <ArrowRight className="h-5 w-5 text-neutral-500 transition group-hover:translate-x-1" />
      </Link> : null}
    </div>
  </div>;
}
