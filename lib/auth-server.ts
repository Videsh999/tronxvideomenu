import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CAPTAIN_SESSION_COOKIE, RESTAURANT_ADMIN_SESSION_COOKIE, SUPER_ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/auth-core";
import { restaurantService } from "@/lib/services/restaurant.service";
import { captainService } from "@/lib/services/captain.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { restaurantAdminRepository } from "@/lib/repositories/restaurant-admin.repository";
import type { FeatureKey } from "@/types";

export type AdminContext = {
  email: string;
  role: "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN";
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantAdminAccountId?: string;
  restaurantAdminUpdatedAt?: string;
};

async function getContextFromCookie(cookieName: string, expectedRole: AdminContext["role"]): Promise<AdminContext | null> {
  const cookieStore = await cookies();
  const session = await readAdminSession(
    cookieStore.get(cookieName)?.value,
    process.env.AUTH_SECRET,
  );
  if (!session || session.role !== expectedRole) return null;

  return {
    email: session.email,
    role: session.role,
    restaurantId: session.restaurantId,
    restaurantSlug: session.restaurantSlug ?? session.restaurantId,
    restaurantAdminAccountId: session.restaurantAdminAccountId,
    restaurantAdminUpdatedAt: session.restaurantAdminUpdatedAt,
  };
}

export async function getRestaurantAdminContext() {
  const context = await getContextFromCookie(RESTAURANT_ADMIN_SESSION_COOKIE, "RESTAURANT_ADMIN");
  if (!context || !context.restaurantId) return null;
  if (context.restaurantAdminAccountId) {
    if (!context.restaurantAdminUpdatedAt || !await restaurantAdminService.isSessionCurrent(
      context.restaurantId,
      context.restaurantAdminAccountId,
      context.email,
      context.restaurantAdminUpdatedAt,
    )) return null;
  } else {
    // Older signed sessions may have been created before the account was
    // migrated to MongoDB. Once a DB account exists, honor its active state.
    const account = await restaurantAdminRepository.findByRestaurantId(context.restaurantId);
    if (account && (!account.isActive || account.email !== context.email.trim().toLowerCase())) return null;
  }
  return context;
}

export const getSuperAdminContext = () => getContextFromCookie(SUPER_ADMIN_SESSION_COOKIE, "SUPER_ADMIN");

export async function requireCaptain(requiredFeature?: FeatureKey) {
  const cookieStore = await cookies();
  const session = await readAdminSession(cookieStore.get(CAPTAIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  if (session?.role !== "CAPTAIN" || !session.captainId || !session.captainUpdatedAt || !session.restaurantId || !session.restaurantSlug) {
    return { captain: null, restaurant: null, error: unauthorizedResponse() } as const;
  }
  const captain = await captainService.getById(session.captainId);
  if (!captain || !captain.isActive || captain.restaurantId !== session.restaurantId || captain.updatedAt !== session.captainUpdatedAt) {
    return { captain: null, restaurant: null, error: forbiddenResponse() } as const;
  }
  const restaurant = await restaurantService.getById(captain.restaurantId);
  if (!restaurant || restaurant.isActive === false || restaurant.slug !== session.restaurantSlug) {
    return { captain: null, restaurant: null, error: forbiddenResponse() } as const;
  }
  const captainFeature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  const operationalFeature = requiredFeature ? requireRestaurantFeature(restaurant, requiredFeature) : { allowed: true as const };
  if (!captainFeature.allowed || !operationalFeature.allowed) {
    const reason = !captainFeature.allowed ? captainFeature.reason : !operationalFeature.allowed ? operationalFeature.reason : "Feature unavailable.";
    return { captain: null, restaurant: null, error: NextResponse.json({ success: false, error: reason }, { status: 403 }) } as const;
  }
  return { captain, restaurant, error: null } as const;
}

export function canManageRestaurant(
  context: AdminContext | null,
  restaurantId?: string,
): boolean {
  if (!context || !restaurantId) return false;
  if (context.role === "SUPER_ADMIN") return true;
  return (
    context.role === "RESTAURANT_ADMIN" && context.restaurantId === restaurantId
  );
}

export function isRestaurantAdmin(
  context: AdminContext | null,
): context is AdminContext & { restaurantId: string; restaurantSlug: string } {
  return Boolean(
    context?.role === "RESTAURANT_ADMIN" &&
    context.restaurantId &&
    context.restaurantSlug,
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "This account is not permitted to perform this action",
    },
    { status: 403 },
  );
}

export async function requireRestaurantAdmin() {
  const context = await getRestaurantAdminContext();
  if (!context) {
    return { admin: null, error: unauthorizedResponse() } as const;
  }
  if (!isRestaurantAdmin(context)) {
    return { admin: null, error: forbiddenResponse() } as const;
  }
  const restaurant = await restaurantService.getById(context.restaurantId);
  if (
    !restaurant ||
    restaurant.isActive === false ||
    restaurant.slug !== context.restaurantSlug
  ) {
    return { admin: null, error: forbiddenResponse() } as const;
  }
  return { admin: context, error: null } as const;
}

export async function requireSuperAdmin() {
  const context = await getSuperAdminContext();
  if (!context) {
    return { admin: null, error: unauthorizedResponse() } as const;
  }
  if (context.role !== "SUPER_ADMIN") {
    return { admin: null, error: forbiddenResponse() } as const;
  }
  return { admin: context, error: null } as const;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Authentication required" },
    { status: 401 },
  );
}
