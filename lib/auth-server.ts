import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CAPTAIN_SESSION_COOKIE, RESTAURANT_ADMIN_SESSION_COOKIE, SUPER_ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/auth-core";
import { restaurantService } from "@/lib/services/restaurant.service";
import { captainService } from "@/lib/services/captain.service";
import { tableService } from "@/lib/services/table.service";
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

export const getRestaurantAdminContext = cache(async () => {
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
});

export const getSuperAdminContext = () => getContextFromCookie(SUPER_ADMIN_SESSION_COOKIE, "SUPER_ADMIN");

type CaptainSessionOk = {
  status: "ok";
  captain: Awaited<ReturnType<typeof captainService.getById>> & object;
  restaurant: NonNullable<Awaited<ReturnType<typeof restaurantService.getById>>>;
};

const captainAuthCache = new Map<string, { at: number; value: CaptainSessionOk }>();
const locationIdCache = new Map<string, { at: number; ids: string[] }>();
const AUTH_CACHE_MS = 20_000;

async function activeLocationIds(restaurantId: string) {
  const hit = locationIdCache.get(restaurantId);
  if (hit && Date.now() - hit.at < AUTH_CACHE_MS) return hit.ids;
  const locations = await tableService.list(restaurantId);
  const ids = locations.filter((location) => location.isActive && location.status !== "CLOSED").map((location) => location.id);
  locationIdCache.set(restaurantId, { at: Date.now(), ids });
  return ids;
}

/** One captain + restaurant lookup per request, shared by layout and page. */
const loadCaptainSession = cache(async () => {
  const cookieStore = await cookies();
  const session = await readAdminSession(cookieStore.get(CAPTAIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  if (session?.role !== "CAPTAIN" || !session.captainId || !session.captainUpdatedAt || !session.restaurantId || !session.restaurantSlug) {
    return { status: "unauthorized" as const };
  }
  const cacheKey = `${session.captainId}:${session.captainUpdatedAt}:${session.restaurantSlug}`;
  const cached = captainAuthCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AUTH_CACHE_MS) return cached.value;

  const [captain, restaurant] = await Promise.all([
    captainService.getById(session.captainId),
    restaurantService.getById(session.restaurantId),
  ]);
  if (!captain || !captain.isActive || captain.restaurantId !== session.restaurantId || captain.updatedAt !== session.captainUpdatedAt) {
    return { status: "forbidden" as const };
  }
  if (!restaurant || restaurant.isActive === false || restaurant.slug !== session.restaurantSlug) {
    return { status: "forbidden" as const };
  }
  // Floor staff serve any active location in their outlet; stale manual assignments must not hide tables.
  const accessibleIds = await activeLocationIds(captain.restaurantId);
  const value: CaptainSessionOk = { status: "ok", captain: { ...captain, assignedTableIds: accessibleIds }, restaurant };
  captainAuthCache.set(cacheKey, { at: Date.now(), value });
  return value;
});

export async function requireCaptain(requiredFeature?: FeatureKey) {
  const loaded = await loadCaptainSession();
  if (loaded.status === "unauthorized") {
    return { captain: null, restaurant: null, error: unauthorizedResponse() } as const;
  }
  if (loaded.status === "forbidden") {
    return { captain: null, restaurant: null, error: forbiddenResponse() } as const;
  }
  const { captain, restaurant } = loaded;
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
