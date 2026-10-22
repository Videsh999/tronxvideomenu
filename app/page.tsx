import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  ChefHat,
  Clapperboard,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { restaurantService } from "@/lib/services/restaurant.service";
import { hasRestaurantFeature } from "@/lib/feature-access";
import BrandMark from "@/components/shared/BrandMark";
import SmartImage from "@/components/shared/SmartImage";

export const dynamic = "force-dynamic";

const features = [
  { icon: Clapperboard, title: "Video-first menus", body: "Dishes come alive with autoplaying, bandwidth-aware video previews that make guests hungry." },
  { icon: QrCode, title: "QR table ordering", body: "Guests scan, customise add-ons, and order straight from their table — no app download." },
  { icon: BellRing, title: "Live order tracking", body: "Orders flow to the kitchen instantly and guests watch every status update in real time." },
  { icon: CalendarCheck, title: "Table reservations", body: "Real-time availability by party size and time slot, confirmed by the restaurant team." },
  { icon: Wifi, title: "One-tap Wi-Fi", body: "Share network details securely with seated guests — encrypted at rest, revealed on demand." },
  { icon: ChefHat, title: "Captain workspace", body: "Floor staff get a focused view of tables and orders to keep service moving." },
];

const steps = [
  { title: "Scan", body: "Guests scan the QR code on their table to open your branded menu." },
  { title: "Choose", body: "Rich video previews, filters, and add-ons make deciding effortless." },
  { title: "Enjoy", body: "Orders reach your team instantly and guests track progress live." },
];

const portals = [
  {
    href: "/super-admin/login",
    icon: ShieldCheck,
    title: "Platform Admin",
    eyebrow: "TRONX team",
    body: "Our control room — onboard every restaurant, set plans and features, and open any venue from one place.",
  },
  {
    href: "/menu/moai-kitchen/admin",
    icon: Store,
    title: "Restaurant Admin",
    eyebrow: "Owner / manager",
    body: "Each venue has its own link — /menu/your-restaurant/admin — for menu, tables, orders, and captain access.",
  },
  {
    href: "/menu/moai-kitchen/captain",
    icon: UtensilsCrossed,
    title: "Captain portal",
    eyebrow: "Waiter / floor",
    body: "Each venue has /menu/your-restaurant/captain — accept orders, print KOT, serve, and take payment.",
  },
];

export default async function Home() {
  const restaurants = (await restaurantService.getAll()).filter(
    (restaurant) => restaurant.isActive !== false,
  );
  const showcase = restaurants.find((restaurant) => restaurant.coverUrl) ?? restaurants[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-neutral-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-grid" />
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main">
          <Link href="/" aria-label="TRONX home"><BrandMark subtitle="Digital video menus" /></Link>
          <div className="hidden items-center gap-8 text-sm text-neutral-500 md:flex">
            <a href="#restaurants" className="transition hover:text-neutral-900">Restaurants</a>
            <a href="#features" className="transition hover:text-neutral-900">Features</a>
            <a href="#how" className="transition hover:text-neutral-900">How it works</a>
          </div>
          <a href="#portals" className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100">
            Team portals <ArrowRight className="h-4 w-4" />
          </a>
        </nav>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-28">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
              <Sparkles className="h-3.5 w-3.5" /> The menu guests remember
            </span>
            <h1 className="font-display mt-6 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Menus that make <span className="text-brand-gradient italic">guests hungry.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-500 sm:text-lg">
              TRONX turns every table into a cinematic, video-rich ordering experience — with live order tracking,
              reservations, and a clear kitchen flow for captains and owners.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#restaurants" className="bg-brand-gradient inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold text-white shadow-[0_12px_40px_-12px_rgb(0_0_0/0.22)] transition hover:brightness-110">
                Explore restaurants <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#how" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-7 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100">
                How it works
              </a>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-neutral-200 pt-8">
              <div><dt className="text-xs text-neutral-500">Partner venues</dt><dd className="mt-1 text-2xl font-bold">{restaurants.length}</dd></div>
              <div><dt className="text-xs text-neutral-500">Order updates</dt><dd className="mt-1 text-2xl font-bold">Live</dd></div>
              <div><dt className="text-xs text-neutral-500">App install</dt><dd className="mt-1 text-2xl font-bold">None</dd></div>
            </dl>
          </div>

          {/* Showcase card */}
          <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:120ms] lg:max-w-none">
            <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-100 shadow-2xl">
              <div className="relative aspect-[4/5] sm:aspect-[5/5]">
                {showcase?.coverUrl ? (
                  <SmartImage src={showcase.coverUrl} alt={showcase.name} sizes="(max-width: 1024px) 100vw, 560px" priority className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-neutral-100" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/75">Now serving</p>
                  <p className="font-display mt-2 text-3xl font-semibold text-white sm:text-4xl">{showcase?.name ?? "Your restaurant"}</p>
                  <p className="mt-1 text-sm text-white/75">{showcase?.tagline || "Digital video menu"}</p>
                  {showcase ? (
                    <Link href={`/menu/${showcase.slug}`} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-neutral-900 transition hover:bg-neutral-100">
                      Open menu <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="absolute -left-4 top-10 hidden items-center gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BellRing className="h-4 w-4" /></span>
              <span><span className="block text-xs font-semibold">Order #128 ready</span><span className="block text-[11px] text-neutral-500">Table 4 · just now</span></span>
            </div>
            <div className="absolute -right-3 bottom-28 hidden items-center gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-neutral-900"><Clapperboard className="h-4 w-4" /></span>
              <span><span className="block text-xs font-semibold">Video preview</span><span className="block text-[11px] text-neutral-500">Autoplays in view</span></span>
            </div>
          </div>
        </section>

        {/* Restaurants */}
        <section id="restaurants" className="scroll-mt-20 border-t border-neutral-200 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">Explore</p>
                <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Partner restaurants</h2>
                <p className="mt-3 max-w-xl text-sm text-neutral-500 sm:text-base">Browse a live TRONX menu. Scan a table QR in-venue to order.</p>
              </div>
            </div>

            {restaurants.length > 0 ? (
              <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {restaurants.map((restaurant) => {
                  const badges = [
                    hasRestaurantFeature(restaurant, "VIDEO_MENU") && "Video menu",
                    hasRestaurantFeature(restaurant, "TABLE_ORDERING") && "Table ordering",
                    hasRestaurantFeature(restaurant, "RESERVATIONS") && "Reservations",
                  ].filter((badge): badge is string => Boolean(badge));
                  return (
                    <li key={restaurant.id}>
                      <Link href={`/menu/${restaurant.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.22)]">
                        <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                          {restaurant.coverUrl ? (
                            <SmartImage src={restaurant.coverUrl} alt={restaurant.name} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-700 group-hover:scale-105" />
                          ) : (
                            <div className="absolute inset-0 bg-neutral-100" />
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-white to-transparent" />
                          <span className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${restaurant.isOpen ? "bg-white text-emerald-700" : "bg-white text-neutral-600"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${restaurant.isOpen ? "bg-emerald-400" : "bg-neutral-300"}`} />
                            {restaurant.isOpen ? "Open now" : "Closed"}
                          </span>
                        </div>
                        <div className="relative -mt-8 flex flex-1 flex-col px-5 pb-5">
                          <div className="relative h-14 w-14 overflow-hidden rounded-2xl border-2 border-white bg-neutral-200 shadow-lg">
                            {restaurant.logoUrl ? (
                              <SmartImage src={restaurant.logoUrl} alt={`${restaurant.name} logo`} sizes="56px" className="object-cover" />
                            ) : (
                              <span className="grid h-full w-full place-items-center text-lg font-bold">{restaurant.name.charAt(0)}</span>
                            )}
                          </div>
                          <h3 className="mt-3 text-lg font-bold tracking-tight">{restaurant.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{restaurant.tagline || restaurant.description || "Digital video menu"}</p>
                          {restaurant.address ? (
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-400"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-1">{restaurant.address}</span></p>
                          ) : null}
                          {badges.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {badges.map((badge) => <span key={badge} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-600">{badge}</span>)}
                            </div>
                          ) : null}
                          <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-neutral-900 transition group-hover:gap-2.5">
                            View menu <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-10 rounded-3xl border border-dashed border-neutral-300 px-6 py-16 text-center">
                <Store className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-3 text-sm text-neutral-500">No restaurants are live yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">Platform</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything your dining room needs</h2>
              <p className="mt-4 text-sm text-neutral-500 sm:text-base">From the first scan to the final bill — one connected platform for guests, captains, and owners.</p>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <article key={title} className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-300 hover:bg-neutral-50">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-neutral-100 opacity-0 blur-2xl transition group-hover:opacity-100" />
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-neutral-400 bg-neutral-100 text-neutral-900"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-neutral-200 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-4xl">Three steps to dinner</h2>
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="relative rounded-3xl border border-neutral-200 bg-white p-7">
                  <span className="font-display text-brand-gradient text-5xl font-semibold">0{index + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Portals */}
        <section id="portals" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">TRONX OS</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Three portals. One restaurant OS.</h2>
              <p className="mt-3 text-sm text-neutral-500">Guests only see menus. Your team signs in here — platform, restaurant, or captain.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {portals.map(({ href, icon: Icon, title, eyebrow, body }) => (
                <Link key={href} href={href} className="group flex flex-col rounded-3xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-neutral-50">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-white"><Icon className="h-5 w-5" /></span>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">{eyebrow}</p>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">{body}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 transition group-hover:gap-2.5 group-hover:text-neutral-900">
                    Open portal <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-neutral-400 sm:flex-row sm:px-6 lg:px-8">
          <BrandMark size="sm" subtitle="Digital video menus" />
          <p>© {new Date().getFullYear()} TRONX. Crafted for great dining.</p>
        </div>
      </footer>
    </div>
  );
}
