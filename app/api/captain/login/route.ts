import { NextResponse } from "next/server";
import { createAdminSession, isSecureRequest, SESSION_TTL_SECONDS, sessionCookieForRole } from "@/lib/auth-core";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { captainLoginSchema } from "@/lib/validations";
import { restaurantService } from "@/lib/services/restaurant.service";
import { captainService } from "@/lib/services/captain.service";
import type { Restaurant } from "@/types";

export const runtime = "nodejs";

import { loginRateLimiter } from "@/lib/security/login-rate-limiter";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown-ip";
}

export async function POST(request: Request) {
  try {
    const input = captainLoginSchema.parse(await request.json());
    const secret = process.env.AUTH_SECRET;
    if (!secret) return NextResponse.json({ success: false, error: "Authentication is not configured" }, { status: 503 });

    const clientIp = getClientIp(request);
    const normalizedEmail = input.email.trim().toLowerCase();
    const rateLimitKey = `captain-login:${normalizedEmail}:${clientIp}`;

    const rateLimit = await loginRateLimiter.check(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please try again in ${rateLimit.retryAfterSeconds ?? 900} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds ?? 900),
          },
        },
      );
    }

    let restaurant: Restaurant | null = null;
    let captain: Awaited<ReturnType<typeof captainService.authenticate>> = null;
    if (input.restaurantSlug) {
      restaurant = await restaurantService.getBySlug(input.restaurantSlug);
      captain = restaurant && restaurant.isActive !== false
        ? await captainService.authenticate(restaurant.id, input.email, input.password)
        : null;
    } else {
      const result = await captainService.authenticateByEmail(input.email, input.password);
      if (result.ambiguous) {
        await loginRateLimiter.recordFailure(rateLimitKey);
        return NextResponse.json({ success: false, error: "This email and password match more than one restaurant. Ask your admin to give each captain a unique email or use the restaurant sign-in link." }, { status: 409 });
      }
      captain = result.captain;
      restaurant = captain ? await restaurantService.getById(captain.restaurantId) : null;
      if (restaurant?.isActive === false) {
        captain = null;
        restaurant = null;
      }
    }
    if (!restaurant || !captain) {
      await loginRateLimiter.recordFailure(rateLimitKey);
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }
    const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
    if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });

    await loginRateLimiter.reset(rateLimitKey);

    const session = await createAdminSession(captain.email, secret, "CAPTAIN", restaurant.id, restaurant.slug, captain.id, captain.updatedAt);
    const response = NextResponse.json({ success: true, data: { role: "CAPTAIN", name: captain.name, restaurantSlug: restaurant.slug } });
    response.cookies.set({ name: sessionCookieForRole("CAPTAIN"), value: session, httpOnly: true, secure: isSecureRequest(request), sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS });
    return response;
  } catch (error) {
    const validation = error && typeof error === "object" && "issues" in error;
    return NextResponse.json({ success: false, error: validation ? "Invalid login details" : "Unable to sign in" }, { status: validation ? 400 : 500 });
  }
}
