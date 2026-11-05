import type { OrgRole, Restaurant, RestaurantAdminAccount } from "@/types";

export type OrgPermission =
  | "ORG_MANAGE"
  | "ORG_ATTACH_OUTLET"
  | "ORG_VIEW_REPORTS"
  | "ORG_MENU_SYNC"
  | "ORG_TRANSFER_STOCK"
  | "OUTLET_INVENTORY_WRITE"
  | "OUTLET_INVENTORY_READ"
  | "OUTLET_PROCUREMENT_WRITE"
  | "OUTLET_PROCUREMENT_RECEIVE"
  | "OUTLET_CRM_WRITE"
  | "OUTLET_REPORTS_READ"
  | "OUTLET_DEVICES_MANAGE";

/**
 * Permission matrix (Phase 4.1).
 *
 * ORG_OWNER / ORG_ADMIN: organization-wide (all outlets).
 * OUTLET_MANAGER: assigned outlets — inventory, procurement receive, CRM, reports.
 * OUTLET_STAFF: assigned outlets — inventory read + limited write (adjustments), no PO create/receive.
 * Legacy RESTAURANT_ADMIN without orgRole: full access to session restaurant only (treated as outlet manager of one).
 */
export const ORG_ROLE_PERMISSIONS: Record<OrgRole, OrgPermission[]> = {
  ORG_OWNER: [
    "ORG_MANAGE",
    "ORG_ATTACH_OUTLET",
    "ORG_VIEW_REPORTS",
    "ORG_MENU_SYNC",
    "ORG_TRANSFER_STOCK",
    "OUTLET_INVENTORY_WRITE",
    "OUTLET_INVENTORY_READ",
    "OUTLET_PROCUREMENT_WRITE",
    "OUTLET_PROCUREMENT_RECEIVE",
    "OUTLET_CRM_WRITE",
    "OUTLET_REPORTS_READ",
    "OUTLET_DEVICES_MANAGE",
  ],
  ORG_ADMIN: [
    "ORG_ATTACH_OUTLET",
    "ORG_VIEW_REPORTS",
    "ORG_MENU_SYNC",
    "ORG_TRANSFER_STOCK",
    "OUTLET_INVENTORY_WRITE",
    "OUTLET_INVENTORY_READ",
    "OUTLET_PROCUREMENT_WRITE",
    "OUTLET_PROCUREMENT_RECEIVE",
    "OUTLET_CRM_WRITE",
    "OUTLET_REPORTS_READ",
    "OUTLET_DEVICES_MANAGE",
  ],
  OUTLET_MANAGER: [
    "OUTLET_INVENTORY_WRITE",
    "OUTLET_INVENTORY_READ",
    "OUTLET_PROCUREMENT_WRITE",
    "OUTLET_PROCUREMENT_RECEIVE",
    "OUTLET_CRM_WRITE",
    "OUTLET_REPORTS_READ",
    "OUTLET_DEVICES_MANAGE",
  ],
  OUTLET_STAFF: ["OUTLET_INVENTORY_READ", "OUTLET_INVENTORY_WRITE", "OUTLET_REPORTS_READ"],
};

export function roleHasPermission(role: OrgRole, permission: OrgPermission): boolean {
  return ORG_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export type AccessPrincipal = {
  /** Authenticated restaurant id from session — never from client body. */
  sessionRestaurantId: string;
  account?: Pick<
    RestaurantAdminAccount,
    "id" | "organizationId" | "orgRole" | "outletIds" | "restaurantId"
  > | null;
  /** Captain is always outlet staff of their session restaurant. */
  isCaptain?: boolean;
};

/**
 * Resolve which outlet ids this principal may access.
 * Never accepts client-supplied organizationId for expansion.
 */
export function resolveAccessibleOutletIds(
  principal: AccessPrincipal,
  orgOutlets: Pick<Restaurant, "id" | "organizationId">[],
): string[] {
  if (principal.isCaptain) return [principal.sessionRestaurantId];

  const account = principal.account;
  if (!account?.orgRole || !account.organizationId) {
    return [principal.sessionRestaurantId];
  }

  const sameOrg = orgOutlets.filter((outlet) => outlet.organizationId === account.organizationId);
  if (account.orgRole === "ORG_OWNER" || account.orgRole === "ORG_ADMIN") {
    return sameOrg.map((outlet) => outlet.id);
  }

  const allowed = new Set(account.outletIds ?? []);
  if (allowed.size === 0) {
    // Manager/staff without explicit list: only their home restaurant if it is in the org.
    return sameOrg.some((outlet) => outlet.id === account.restaurantId)
      ? [account.restaurantId]
      : [principal.sessionRestaurantId];
  }
  return sameOrg.map((outlet) => outlet.id).filter((id) => allowed.has(id));
}

export function canAccessOutlet(
  principal: AccessPrincipal,
  outletId: string,
  orgOutlets: Pick<Restaurant, "id" | "organizationId">[],
): boolean {
  return resolveAccessibleOutletIds(principal, orgOutlets).includes(outletId);
}

export function assertOutletPermission(params: {
  principal: AccessPrincipal;
  outletId: string;
  permission: OrgPermission;
  orgOutlets: Pick<Restaurant, "id" | "organizationId">[];
}): { ok: true } | { ok: false; status: 403 | 404; error: string } {
  if (!canAccessOutlet(params.principal, params.outletId, params.orgOutlets)) {
    return { ok: false, status: 403, error: "You do not have access to this outlet." };
  }

  if (params.principal.isCaptain) {
    const staffOk =
      params.permission === "OUTLET_INVENTORY_READ" ||
      params.permission === "OUTLET_INVENTORY_WRITE" ||
      params.permission === "OUTLET_REPORTS_READ";
    return staffOk
      ? { ok: true }
      : { ok: false, status: 403, error: "Captain role cannot perform this action." };
  }

  const role = params.principal.account?.orgRole;
  if (!role) {
    // Legacy single-outlet restaurant admin — full outlet permissions on session restaurant only.
    if (params.outletId !== params.principal.sessionRestaurantId) {
      return { ok: false, status: 403, error: "Cross-outlet access denied." };
    }
    return { ok: true };
  }

  if (!roleHasPermission(role, params.permission)) {
    return { ok: false, status: 403, error: "Insufficient organization permissions." };
  }
  return { ok: true };
}

export function assertSameOrganizationIds(
  a: string | undefined,
  b: string | undefined,
): boolean {
  return Boolean(a && b && a === b);
}
