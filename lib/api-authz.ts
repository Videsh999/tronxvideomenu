/**
 * Proxy-layer API authorization classes.
 * Handlers still enforce tenant/role checks — this is defense-in-depth at the edge.
 */

export type ApiAuthClass =
  | "public"
  | "captain"
  | "restaurant_admin"
  | "super_admin"
  | "staff"; // restaurant admin or super admin (never captain)

export function classifyApiRequest(method: string, pathname: string): ApiAuthClass {
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/captain/login" ||
    pathname === "/api/captain/logout"
  ) {
    return "public";
  }

  // Local/staging demo seed — handler enforces NODE_ENV / ALLOW_PRODUCTION_SEED / optional token.
  if (method === "POST" && pathname === "/api/dev/seed-demo-kitchen") {
    return "public";
  }

  if (
    method === "POST" &&
    (pathname === "/api/public/reservations/availability" ||
      pathname === "/api/public/reservations" ||
      pathname === "/api/public/orders")
  ) {
    return "public";
  }

  if (method === "GET" && /^\/api\/public\/restaurants\/[^/]+\/(?:wifi|translations)$/.test(pathname)) {
    return "public";
  }

  if (method === "GET" && /^\/api\/orders\/[^/]+\/status$/.test(pathname)) {
    return "public";
  }

  // Customer menu bootstrap (handlers sanitize; fullMenu is intentional public catalog).
  if (method === "GET" && (pathname === "/api/restaurants" || pathname.startsWith("/api/restaurants/"))) {
    return "public";
  }

  if (pathname.startsWith("/api/captain/")) return "captain";
  if (pathname.startsWith("/api/super-admin/")) return "super_admin";
  if (pathname.startsWith("/api/admin/")) return "restaurant_admin";

  return "staff";
}

export function apiSessionAllowed(
  authClass: ApiAuthClass,
  sessions: { restaurantAdmin: boolean; superAdmin: boolean; captain: boolean },
): boolean {
  switch (authClass) {
    case "public":
      return true;
    case "captain":
      return sessions.captain;
    case "super_admin":
      return sessions.superAdmin;
    case "restaurant_admin":
      return sessions.restaurantAdmin;
    case "staff":
      return sessions.restaurantAdmin || sessions.superAdmin;
    default:
      return false;
  }
}
