import type { MetadataRoute } from "next";

// Global manifest (admin, Super Admin, captain, marketing site).
// Guest menus link to a per-restaurant manifest instead: /menu/[slug]/manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TRONX",
    short_name: "TRONX",
    description: "TRONX video menus, table ordering and restaurant operations.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["food", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
