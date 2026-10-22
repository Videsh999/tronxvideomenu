import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CAPTAIN_SESSION_COOKIE, RESTAURANT_ADMIN_SESSION_COOKIE, SUPER_ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/auth-core";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminLoginRoute = pathname === "/admin/login";
  const isSuperAdminLoginRoute = pathname === "/super-admin/login";
  const isAuthLoginRoute = pathname === "/api/auth/login";
  const isLogoutRoute = pathname === "/api/auth/logout";
  const isCaptainAuthRoute = pathname === "/api/captain/login" || pathname === "/api/captain/logout";
  const isPublicReservationRoute = request.method === "POST" && (
    pathname === "/api/public/reservations/availability" ||
    pathname === "/api/public/reservations" ||
    pathname === "/api/public/orders"
  );
  const isPublicWifiRoute = request.method === "GET" && /^\/api\/public\/restaurants\/[^/]+\/(?:wifi|translations)$/.test(pathname);
  const isCustomerOrderStatusRoute = request.method === "GET" && /^\/api\/orders\/[^/]+\/status$/.test(pathname);
  const isApiRequest = pathname.startsWith("/api/");
  const isPublicCustomerRoute =
    pathname === "/" ||
    pathname.startsWith("/menu/") ||
    (request.method === "GET" && pathname.startsWith("/api/restaurants/"));

  if (isAuthLoginRoute || isLogoutRoute || isCaptainAuthRoute || isPublicCustomerRoute || isCustomerOrderStatusRoute || isPublicReservationRoute || isPublicWifiRoute) {
    return NextResponse.next();
  }

  const restaurantSession = await readAdminSession(request.cookies.get(RESTAURANT_ADMIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  const superSession = await readAdminSession(request.cookies.get(SUPER_ADMIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  const captainSession = await readAdminSession(request.cookies.get(CAPTAIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET);

  if (pathname === "/captain/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/captain/")) {
    if (!captainSession || captainSession.role !== "CAPTAIN" || !captainSession.restaurantSlug) {
      const loginUrl = new URL("/captain/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    const requestedRestaurant = pathname.split("/captain/")[1]?.split("/")[0];
    if (requestedRestaurant !== captainSession.restaurantSlug) {
      return NextResponse.redirect(new URL(`/captain/${captainSession.restaurantSlug}`, request.url));
    }
    return NextResponse.next();
  }

  if (isAdminLoginRoute || isSuperAdminLoginRoute) {
    if (isSuperAdminLoginRoute && superSession?.role === "SUPER_ADMIN") return NextResponse.redirect(new URL("/super-admin", request.url));
    if (isAdminLoginRoute && restaurantSession?.role === "RESTAURANT_ADMIN") {
      const targetRestaurant = restaurantSession.restaurantSlug || restaurantSession.restaurantId || "";
      const nextRestaurant = request.nextUrl.searchParams.get("next")?.match(/^\/admin\/([^/?#]+)/)?.[1];
      if (!nextRestaurant || nextRestaurant === targetRestaurant) {
        return NextResponse.redirect(new URL(targetRestaurant ? `/admin/${targetRestaurant}` : "/admin", request.url));
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/super-admin")) {
    if (!superSession || superSession.role !== "SUPER_ADMIN") {
      const loginUrl = new URL("/super-admin/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!restaurantSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    if (restaurantSession.role !== "RESTAURANT_ADMIN") return NextResponse.redirect(new URL("/admin/login", request.url));
    if (pathname === "/admin" || pathname === "/admin/") {
      const redirectSlug = restaurantSession.restaurantSlug || restaurantSession.restaurantId;
      return NextResponse.redirect(
        new URL(
          redirectSlug ? `/admin/${redirectSlug}` : "/admin/login",
          request.url,
        ),
      );
    }
    const requestedRestaurant = pathname.split("/admin/")[1]?.split("/")[0];
    const sessionRestaurant = restaurantSession.restaurantSlug || restaurantSession.restaurantId;
    if (requestedRestaurant && requestedRestaurant !== sessionRestaurant) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!isApiRequest) return NextResponse.next();
  if (pathname.startsWith("/api/captain/")) {
    if (captainSession?.role === "CAPTAIN") return NextResponse.next();
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  if (restaurantSession || superSession || captainSession) return NextResponse.next();

  return NextResponse.json(
    { success: false, error: "Authentication required" },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/admin/:path*", "/super-admin/:path*", "/captain/:path*", "/api/:path*"],
};
