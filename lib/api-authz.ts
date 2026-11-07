/**
 * Proxy-layer API authorization classes.
 * Handlers still enforce tenant/role checks — this is defense-in-depth at the edge.
 */

export type ApiAuthClass =
  | "public"
  | "customer" // handler-owned guest session; login/register/reset need no session
  | "connector" // pairing code or connector secret, enforced by the handler
  | "local_dev" // loopback demo seed; never a staff or public session
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

  // Demo seed is not a public API. The proxy only forwards loopback, non-production
  // requests, and the handler still refuses without an explicit safe config.
  if (method === "POST" && pathname === "/api/dev/seed-demo-kitchen") {
    return "local_dev";
  }

  // Guest loyalty. Login, register, forgot, and reset are anonymous.
  // /me and logout clear or read the customer cookie inside the handler.
  if (pathname.startsWith("/api/public/loyalty/")) {
    return "customer";
  }

  // Device connector. Pairing uses a one-time code; heartbeat, jobs, and ack
  // use the connector secret. Neither is a staff cookie.
  if (pathname.startsWith("/api/connector/")) {
    return "connector";
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
    case "customer":
    case "connector":
      return true;
    case "local_dev":
      return false;
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
