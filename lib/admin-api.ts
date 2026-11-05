import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { restaurantAdminRepository } from "@/lib/repositories/restaurant-admin.repository";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import { requireRestaurantFeature } from "@/lib/feature-access";
import {
  assertOutletPermission,
  type AccessPrincipal,
  type OrgPermission,
} from "@/lib/org-rbac";
import type { FeatureKey, Restaurant } from "@/types";

export async function requireAdminRestaurantFeature(feature: FeatureKey): Promise<
  | {
      ok: true;
      restaurantId: string;
      restaurant: Restaurant;
      email: string;
      accountId: string;
      principal: AccessPrincipal;
    }
  | { ok: false; response: NextResponse }
> {
  const { admin, error } = await requireRestaurantAdmin();
  if (error || !admin) return { ok: false, response: unauthorizedResponse() };
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 }),
    };
  }
  const featureCheck = requireRestaurantFeature(restaurant, feature);
  if (!featureCheck.allowed) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: featureCheck.reason }, { status: 403 }),
    };
  }

  const account = admin.restaurantAdminAccountId
    ? await restaurantAdminRepository.findById(admin.restaurantAdminAccountId)
    : await restaurantAdminRepository.findByRestaurantId(admin.restaurantId);

  const principal: AccessPrincipal = {
    sessionRestaurantId: admin.restaurantId,
    account: account
      ? {
          id: account.id,
          restaurantId: account.restaurantId,
          organizationId: account.organizationId,
          orgRole: account.orgRole,
          outletIds: account.outletIds,
        }
      : null,
  };

  return {
    ok: true,
    restaurantId: admin.restaurantId,
    restaurant,
    email: admin.email,
    accountId: admin.restaurantAdminAccountId ?? admin.email,
    principal,
  };
}

/**
 * Enforce outlet-scoped permission. Target outlet defaults to session restaurant.
 * Client-supplied outlet IDs are accepted only after server-side access check.
 */
export async function requireOutletPermission(params: {
  feature: FeatureKey;
  permission: OrgPermission;
  /** Optional client-requested outlet — verified against session/org membership. */
  requestedOutletId?: string;
}): Promise<
  | {
      ok: true;
      restaurantId: string;
      restaurant: Restaurant;
      email: string;
      accountId: string;
      principal: AccessPrincipal;
    }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAdminRestaurantFeature(params.feature);
  if (!auth.ok) return auth;

  const outletId = params.requestedOutletId ?? auth.restaurantId;
  // Never allow switching away from session restaurant unless org membership grants it.
  let orgOutlets: Restaurant[] = [];
  if (auth.restaurant.organizationId) {
    orgOutlets = await organizationRepository.listOutlets(auth.restaurant.organizationId);
  } else {
    orgOutlets = [auth.restaurant];
  }

  const check = assertOutletPermission({
    principal: auth.principal,
    outletId,
    permission: params.permission,
    orgOutlets,
  });
  if (!check.ok) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: check.error }, { status: check.status }),
    };
  }

  if (outletId !== auth.restaurantId) {
    const target = await restaurantService.getById(outletId);
    if (!target) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: "Outlet not found." }, { status: 404 }),
      };
    }
    return {
      ok: true,
      restaurantId: outletId,
      restaurant: target,
      email: auth.email,
      accountId: auth.accountId,
      principal: auth.principal,
    };
  }

  return auth;
}

export async function requireStaffForFeature(feature: FeatureKey) {
  const admin = await requireAdminRestaurantFeature(feature);
  if (admin.ok) return { ...admin, kind: "admin" as const };

  const captainResult = await requireCaptain(
    feature === "INVENTORY" || feature === "KITCHEN_DISPLAY" ? "ORDER_MANAGEMENT" : undefined,
  );
  if (captainResult.error || !captainResult.captain || !captainResult.restaurant) {
    return { ok: false as const, response: admin.ok === false ? admin.response : unauthorizedResponse() };
  }
  const featureCheck = requireRestaurantFeature(captainResult.restaurant, feature);
  if (!featureCheck.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: featureCheck.reason }, { status: 403 }),
    };
  }
  return {
    ok: true as const,
    kind: "captain" as const,
    restaurantId: captainResult.captain.restaurantId,
    restaurant: captainResult.restaurant,
    email: captainResult.captain.email,
    accountId: captainResult.captain.id,
    principal: {
      sessionRestaurantId: captainResult.captain.restaurantId,
      account: null,
      isCaptain: true,
    } satisfies AccessPrincipal,
  };
}
