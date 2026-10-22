import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  FolderTree,
  IndianRupee,
  QrCode,
  Sliders,
  Store,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { restaurantService } from "@/lib/services/restaurant.service";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
import { reservationService } from "@/lib/services/reservation.service";
import { captainService } from "@/lib/services/captain.service";
import { getAllRestaurantFeatures } from "@/lib/feature-access";
import { getReservationLocalDate } from "@/lib/reservations/time";

export const dynamic = "force-dynamic";

const orderStatusStyle: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-sky-50 text-sky-700",
  PREPARING: "bg-neutral-100 text-neutral-900",
  READY: "bg-emerald-50 text-emerald-700",
  SERVED: "bg-neutral-100 text-neutral-500",
  CANCELLED: "bg-rose-50 text-rose-600",
};

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AdminRestaurantDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await restaurantService.getById(slug);

  if (!restaurant) {
    notFound();
  }

  const features = getAllRestaurantFeatures(restaurant);
  const today = getReservationLocalDate();
  const [menu, orders, tables, reservations, captains, wifi] = await Promise.all([
    restaurantService.getFullMenu(restaurant.id),
    features.ORDER_MANAGEMENT ? orderService.listForRestaurant(restaurant.id) : Promise.resolve([]),
    features.TABLE_MANAGEMENT ? tableService.list(restaurant.id) : Promise.resolve([]),
    features.RESERVATIONS ? reservationService.list(restaurant.id, today) : Promise.resolve([]),
    features.CAPTAIN_ACCESS ? captainService.list(restaurant.id).catch(() => []) : Promise.resolve([]),
    features.WIFI ? restaurantService.getWifiCustomerDetails(restaurant.slug).catch(() => null) : Promise.resolve(null),
  ]);

  const dishes = menu?.dishes ?? [];
  const categories = menu?.categories ?? [];
  const activeOrders = orders.filter((order) => order.status !== "SERVED" && order.status !== "CANCELLED");
  const todaysOrders = orders.filter((order) => order.createdAt && getReservationLocalDate(new Date(order.createdAt)) === today && order.status !== "CANCELLED");
  const todaysRevenue = todaysOrders.reduce((sum, order) => sum + order.total, 0);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5);
  const occupiedTables = tables.filter((table) => table.status === "OCCUPIED").length;
  const pendingReservations = reservations.filter((reservation) => reservation.status === "PENDING").length;

  const stats: { label: string; value: string; hint: string; icon: LucideIcon; href: string }[] = [
    ...(features.ORDER_MANAGEMENT ? [
      { label: "Active orders", value: String(activeOrders.length), hint: `${todaysOrders.length} placed today`, icon: ClipboardList, href: `/admin/${slug}/orders` },
      { label: "Today’s sales", value: `₹${todaysRevenue.toLocaleString("en-IN")}`, hint: "Excludes cancelled", icon: IndianRupee, href: `/admin/${slug}/orders` },
    ] : []),
    { label: "Dishes", value: String(dishes.length), hint: `${dishes.filter((dish) => dish.isAvailable).length} available now`, icon: UtensilsCrossed, href: `/admin/${slug}/menu/dishes` },
    ...(features.TABLE_MANAGEMENT ? [
      { label: "Tables", value: String(tables.length), hint: `${occupiedTables} occupied`, icon: QrCode, href: `/admin/${slug}/tables` },
    ] : [
      { label: "Categories", value: String(categories.length), hint: "Active menu sections", icon: FolderTree, href: `/admin/${slug}/menu/categories` },
    ]),
    ...(features.RESERVATIONS ? [
      { label: "Reservations today", value: String(reservations.length), hint: `${pendingReservations} awaiting confirmation`, icon: CalendarDays, href: `/admin/${slug}/reservations` },
    ] : []),
  ];

  const setupSteps: { label: string; body: string; href: string; done: boolean }[] = [
    { label: "Add your logo and cover photo", body: "They appear at the top of your guest menu.", href: `/admin/${slug}/profile`, done: Boolean((restaurant.logoUrl ?? restaurant.logo) && (restaurant.coverUrl ?? restaurant.coverImage)) },
    { label: "Add contact details and opening hours", body: "Phone, address and hours power the Call, Directions and Open now buttons.", href: `/admin/${slug}/profile`, done: Boolean(restaurant.phone && restaurant.address && restaurant.openingHours) },
    { label: "Create menu categories", body: "For example Starters, Mains, Desserts and Drinks.", href: `/admin/${slug}/menu/categories`, done: categories.length > 0 },
    { label: "Add dishes with photos", body: "Add a price, a photo, and a short video if you have one.", href: `/admin/${slug}/menu/dishes`, done: dishes.some((dish) => dish.imageUrl) },
    ...(features.TABLE_MANAGEMENT ? [{ label: "Add tables and print QR codes", body: "Add all your tables at once, then print a QR card for each.", href: `/admin/${slug}/tables`, done: tables.length > 0 }] : []),
    ...(features.WIFI ? [{ label: "Share your Wi-Fi", body: "Guests can copy the password straight from the menu.", href: `/admin/${slug}/profile`, done: Boolean(wifi) }] : []),
    ...(features.CAPTAIN_ACCESS ? [{ label: "Invite your floor staff", body: "Captains get their own login for orders and tables.", href: `/admin/${slug}/captains`, done: captains.length > 0 }] : []),
  ];
  const stepsDone = setupSteps.filter((step) => step.done).length;
  const nextStep = setupSteps.find((step) => !step.done);

  const quickActions: { label: string; body: string; href: string; icon: LucideIcon }[] = [
    { label: "Dishes", body: "Prices, videos, availability", href: `/admin/${slug}/menu/dishes`, icon: UtensilsCrossed },
    { label: "Categories", body: "Sections & display order", href: `/admin/${slug}/menu/categories`, icon: FolderTree },
    { label: "Add-ons", body: "Extras & required choices", href: `/admin/${slug}/menu/addons`, icon: Sliders },
    { label: "Profile", body: "Branding, contact, Wi-Fi", href: `/admin/${slug}/profile`, icon: Store },
    { label: "Availability", body: "Open hours & items", href: `/admin/${slug}/availability`, icon: Clock },
    ...(features.CAPTAIN_ACCESS ? [{ label: "Captains", body: "Floor staff accounts", href: `/admin/${slug}/captains`, icon: Users }] : []),
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">{greeting()} 👋</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{restaurant.name}</h1>
            <p className="mt-2 max-w-lg text-sm text-neutral-500">Here’s what’s happening at your restaurant today.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {features.ORDER_MANAGEMENT ? (
              <Link href={`/admin/${slug}/orders`} className="bg-brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.22)] transition hover:brightness-110">
                <ClipboardList className="h-4 w-4" /> Live orders
              </Link>
            ) : null}
            <Link href={`/admin/${slug}/menu/dishes`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-sm font-semibold transition hover:bg-neutral-100">
              <UtensilsCrossed className="h-4 w-4" /> Edit menu
            </Link>
          </div>
        </div>
      </section>

      {nextStep ? (
        <section aria-labelledby="setup-heading" className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Getting started</p>
              <h2 id="setup-heading" className="mt-1 text-lg font-bold">Get {restaurant.name} ready for guests</h2>
            </div>
            <p className="text-sm font-semibold tabular-nums text-neutral-600">{stepsDone} of {setupSteps.length} done</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
            <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${(stepsDone / setupSteps.length) * 100}%` }} />
          </div>
          <ol className="mt-5 divide-y divide-neutral-100">
            {setupSteps.map((step, index) => (
              <li key={step.label}>
                <Link href={step.href} className="group flex items-center gap-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-600 text-white" : step === nextStep ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                    {step.done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${step.done ? "text-neutral-400 line-through" : "text-neutral-900"}`}>{step.label}</span>
                    {!step.done ? <span className="block text-xs text-neutral-500">{step.body}</span> : null}
                  </span>
                  {!step.done ? <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${step === nextStep ? "rounded-full bg-neutral-900 px-3 py-1.5 text-white" : "text-neutral-500 group-hover:text-neutral-900"}`}>{step === nextStep ? "Start" : "Set up"}<ArrowRight className="h-3.5 w-3.5" /></span> : null}
                </Link>
              </li>
            ))}
          </ol>
          <Link href={`/menu/${restaurant.slug}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">Preview the guest menu <ArrowRight className="h-3.5 w-3.5" /></Link>
        </section>
      ) : null}

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.slice(0, 4).map(({ label, value, hint, icon: Icon, href }) => (
          <Link key={label} href={href} className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50 sm:p-5">
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-neutral-500">{label}</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-100 text-neutral-700"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="relative mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
            <p className="relative mt-1 truncate text-xs text-neutral-400">{hint}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {features.ORDER_MANAGEMENT ? (
          <section className="rounded-3xl border border-neutral-200 bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent orders</h2>
              <Link href={`/admin/${slug}/orders`} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 hover:text-neutral-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </header>
            {recentOrders.length ? (
              <ul className="divide-y divide-neutral-100">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/${slug}/orders#order-${order.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-white">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-50 text-xs font-bold tabular-nums">T{order.tableNumber}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">Order #{order.orderNumber}</span>
                        <span className="block truncate text-xs text-neutral-500">{order.items.map((item) => `${item.quantity}× ${item.dishNameSnapshot}`).join(", ")}</span>
                      </span>
                      <span className="hidden text-right sm:block">
                        <span className="block text-sm font-semibold tabular-nums">₹{order.total}</span>
                        {order.createdAt ? <span className="block text-[11px] text-neutral-400">{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span> : null}
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${orderStatusStyle[order.status] ?? "bg-neutral-100 text-neutral-500"}`}>{order.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-14 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-neutral-300" />
                <p className="mt-3 text-sm text-neutral-500">No orders yet. They’ll appear here the moment guests order.</p>
              </div>
            )}
          </section>
        ) : null}

        <section className={features.ORDER_MANAGEMENT ? "" : "lg:col-span-2"}>
          <h2 className="mb-3 px-1 text-sm font-semibold">Quick actions</h2>
          <div className={`grid gap-3 ${features.ORDER_MANAGEMENT ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {quickActions.map(({ label, body, href, icon: Icon }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:bg-neutral-50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-50 text-neutral-700 transition group-hover:bg-neutral-100 group-hover:text-neutral-900"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-neutral-500">{body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
