import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  sessionCookieForRole,
  createAdminSession,
  SESSION_TTL_SECONDS,
} from "@/lib/auth-core";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { restaurantAdminLoginSchema } from "@/lib/validations";

export const runtime = "nodejs";

function matchesSecret(value: string, expected: string): boolean {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function normalizeRestaurantId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
    const { email, password, role, restaurantSlug } =
      (await request.json()) as {
        email?: unknown;
        password?: unknown;
        role?: unknown;
        restaurantSlug?: unknown;
      };

    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
      return NextResponse.json(
        { success: false, error: "Authentication is not configured" },
        { status: 503 },
      );
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 },
      );
    }

    if (
      role === "SUPER_ADMIN" &&
      process.env.SUPER_ADMIN_EMAIL &&
      process.env.SUPER_ADMIN_PASSWORD &&
      matchesSecret(email, process.env.SUPER_ADMIN_EMAIL) &&
      matchesSecret(password, process.env.SUPER_ADMIN_PASSWORD)
    ) {
      const session = await createAdminSession(
        email,
        authSecret,
        "SUPER_ADMIN",
      );
      const response = NextResponse.json({
        success: true,
        data: { email, role: "SUPER_ADMIN" },
      });
      response.cookies.set({
        name: sessionCookieForRole("SUPER_ADMIN"),
        value: session,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
      });
      return response;
    }

    if (role !== "RESTAURANT_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const clientIp = getClientIp(request);
    const normalizedAttemptEmail = email.trim().toLowerCase();
    const rateLimitKey = `admin-login:${normalizedAttemptEmail}:${clientIp}`;

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

    const parsedLogin = restaurantAdminLoginSchema.safeParse({ email, password, restaurantSlug });
    if (!parsedLogin.success) {
      await loginRateLimiter.recordFailure(rateLimitKey);
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }
    const normalizedEmail = parsedLogin.data.email;
    const requestedRestaurantSlug = parsedLogin.data.restaurantSlug
      ? normalizeRestaurantId(parsedLogin.data.restaurantSlug)
      : undefined;
    let identity;
    if (requestedRestaurantSlug) {
      const restaurant = await restaurantService.getBySlug(requestedRestaurantSlug);
      identity = restaurant
        ? await restaurantAdminService.authenticateForRestaurant(restaurant, normalizedEmail, parsedLogin.data.password)
        : null;
    } else {
      identity = await restaurantAdminService.authenticateWithoutRestaurant(normalizedEmail, parsedLogin.data.password);
    }

    if (!identity) {
      await loginRateLimiter.recordFailure(rateLimitKey);
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 },
      );
    }

    await loginRateLimiter.reset(rateLimitKey);

    const session = await createAdminSession(
      identity.email,
      authSecret,
      "RESTAURANT_ADMIN",
      identity.restaurantId,
      identity.restaurantSlug,
      undefined,
      undefined,
      identity.accountId,
      identity.accountUpdatedAt,
    );
    const response = NextResponse.json({
      success: true,
      data: {
        email: identity.email,
        role: "RESTAURANT_ADMIN",
        restaurantId: identity.restaurantId,
        restaurantSlug: identity.restaurantSlug,
      },
    });
    response.cookies.set({
      name: sessionCookieForRole("RESTAURANT_ADMIN"),
      value: session,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid login request" },
      { status: 400 },
    );
  }
}
