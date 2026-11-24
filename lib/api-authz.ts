/**
 * Proxy-layer API authorization classes.
 * Handlers still enforce tenant/role checks — this is defense-in-depth at the edge.
 */

export type ApiAuthClass =
  | "public"
  | "captain"
  | "restaurant_admin"
  | "super_admin"
  | "staff" // restaurant admin or super admin (never captain)
  | "floor"; // restaurant admin, super admin, or captain — shared floor ops

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
  if (
    method === "POST" &&
    (pathname === "/api/dev/seed-demo-kitchen" || pathname === "/api/dev/seed-cheese")
  ) {
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

  // Guest loyalty: anonymous at the edge. Handlers set/clear the customer cookie.
  // Do not require a customer session here — register/login/forgot/reset must work without one.
  if (
    pathname === "/api/public/loyalty/me" ||
    pathname === "/api/public/loyalty/login" ||
    pathname === "/api/public/loyalty/register" ||
    pathname === "/api/public/loyalty/forgot-password" ||
    pathname === "/api/public/loyalty/reset-password" ||
    pathname === "/api/public/loyalty/logout"
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

  // Shared floor ops: handlers still enforce tenant + role (captain vs admin).
  if (
    (method === "POST" && pathname === "/api/pos/orders") ||
    (method === "POST" && /^\/api\/orders\/[^/]+\/payment$/.test(pathname)) ||
    (method === "POST" && /^\/api\/orders\/[^/]+\/cancel-lines$/.test(pathname))
  ) {
    return "floor";
  }

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
    case "floor":
      return sessions.restaurantAdmin || sessions.superAdmin || sessions.captain;
    default:
      return false;
  }
}
