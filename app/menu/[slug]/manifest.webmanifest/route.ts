import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,80}$/i;

function hex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

// Per-restaurant web app manifest so a guest can install "<Restaurant> menu" on their phone.
// Icons stay on the TRONX brand set (always same-origin PNGs); name/colours come from branding.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return new Response("Not found", { status: 404 });

  const restaurant = await restaurantService.getBySlug(slug).catch(() => null);
  if (!restaurant || restaurant.isActive === false) return new Response("Not found", { status: 404 });

  const name = restaurant.name?.trim() || "TRONX Menu";
  const base = `/menu/${encodeURIComponent(restaurant.slug || slug)}`;
  const body = {
    id: `${base}/`,
    name,
    short_name: name.length > 14 ? name.slice(0, 13).trimEnd() + "…" : name,
    description: restaurant.tagline?.trim() || restaurant.description?.trim() || `${name} digital menu`,
    start_url: `${base}?source=pwa`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: hex(restaurant.theme?.primaryColor, "#171717"),
    categories: ["food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
