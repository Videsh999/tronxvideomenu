import { randomUUID } from "node:crypto";
import { AccessAssignmentAuditModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import { organizationRepository } from "@/lib/repositories/organization.repository";
import { restaurantAdminRepository } from "@/lib/repositories/restaurant-admin.repository";
import type { AccessAssignmentAudit, OrgRole, RestaurantAdminAccount } from "@/types";

export class AccessAssignmentServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

const ORG_ROLES: OrgRole[] = ["ORG_OWNER", "ORG_ADMIN", "OUTLET_MANAGER", "OUTLET_STAFF"];

export class AccessAssignmentService {
  async getAssignment(restaurantId: string) {
    const account = await restaurantAdminRepository.findByRestaurantId(restaurantId);
    if (!account) return null;
    const audits = await this.listAudits(account.id);
    return { account: this.publicAccount(account), audits };
  }

  async listOrganizationAssignments(organizationId: string) {
    const accounts = await restaurantAdminRepository.listByOrganization(organizationId);
    return accounts.map((account) => this.publicAccount(account));
  }

  /**
   * Super-admin only assignment of org role / outlet access.
   * Prevents removing the last active ORG_OWNER.
   * Requires confirm:true for sensitive demotions/deactivations.
   */
  async assignAccess(input: {
    restaurantAdminAccountId?: string;
    restaurantId: string;
    organizationId?: string | null;
    orgRole?: OrgRole | null;
    outletIds?: string[];
    isActive?: boolean;
    reason?: string;
    confirm: boolean;
    actorEmail: string;
  }) {
    if (!input.confirm) {
      throw new AccessAssignmentServiceError(
        "Sensitive access changes require confirm:true.",
        400,
      );
    }

    const account =
      (input.restaurantAdminAccountId
        ? await restaurantAdminRepository.findById(input.restaurantAdminAccountId)
        : null) ?? (await restaurantAdminRepository.findByRestaurantId(input.restaurantId));

    if (!account) {
      throw new AccessAssignmentServiceError("Administrator account not found.", 404);
    }

    if (input.orgRole != null && !ORG_ROLES.includes(input.orgRole)) {
      throw new AccessAssignmentServiceError("Invalid organization role.");
    }

    const nextOrganizationId =
      input.organizationId === null
        ? undefined
        : (input.organizationId ?? account.organizationId);
    const nextOrgRole =
      input.orgRole === null ? undefined : (input.orgRole ?? account.orgRole);
    const nextOutletIds = input.outletIds ?? account.outletIds ?? [];
    const nextIsActive = input.isActive ?? account.isActive;

    if (nextOrganizationId) {
      const org = await organizationRepository.findById(nextOrganizationId);
      if (!org) throw new AccessAssignmentServiceError("Organization not found.", 404);
      const outlets = await organizationRepository.listOutlets(nextOrganizationId);
      const outletSet = new Set(outlets.map((outlet) => outlet.id));
      for (const outletId of nextOutletIds) {
        if (!outletSet.has(outletId)) {
          throw new AccessAssignmentServiceError(
            `Outlet ${outletId} is not in organization ${nextOrganizationId}.`,
          );
        }
      }
      if (
        (nextOrgRole === "OUTLET_MANAGER" || nextOrgRole === "OUTLET_STAFF") &&
        nextOutletIds.length === 0
      ) {
        // Home restaurant is allowed as implicit outlet if it belongs to the org.
        if (!outletSet.has(account.restaurantId)) {
          throw new AccessAssignmentServiceError(
            "Outlet managers and staff need at least one assigned outlet.",
          );
        }
      }
    }

    // Last-owner guard
    const wasOwner = account.orgRole === "ORG_OWNER" && account.isActive && account.organizationId;
    const remainsOwner =
      nextOrgRole === "ORG_OWNER" && nextIsActive && nextOrganizationId === account.organizationId;
    if (wasOwner && !remainsOwner && account.organizationId) {
      const owners = await restaurantAdminRepository.countOrgOwners(account.organizationId);
      if (owners <= 1) {
        throw new AccessAssignmentServiceError(
          "Cannot remove or demote the last organization owner.",
          409,
        );
      }
    }

    const previous = {
      organizationId: account.organizationId,
      orgRole: account.orgRole,
      outletIds: account.outletIds,
      isActive: account.isActive,
    };
    const next = {
      organizationId: nextOrganizationId,
      orgRole: nextOrgRole,
      outletIds: nextOutletIds.length ? nextOutletIds : undefined,
      isActive: nextIsActive,
    };

    const updated = await restaurantAdminRepository.updateAccessAssignment(account.id, {
      organizationId: next.organizationId,
      orgRole: next.orgRole,
      outletIds: next.outletIds,
      isActive: next.isActive ?? true,
    });
    if (!updated) {
      throw new AccessAssignmentServiceError("Unable to update access assignment.", 500);
    }

    await connectToDatabase();
    const audit = await AccessAssignmentAuditModel.create({
      id: `aaa-${randomUUID()}`,
      restaurantAdminAccountId: account.id,
      organizationId: next.organizationId ?? previous.organizationId,
      previous,
      next,
      changedBy: { role: "SUPER_ADMIN", email: input.actorEmail },
      reason: input.reason,
      createdAt: new Date().toISOString(),
    });

    return {
      account: this.publicAccount(updated),
      audit: toDomain<AccessAssignmentAudit>(audit.toObject()),
    };
  }

  async listAudits(restaurantAdminAccountId: string, limit = 50) {
    await connectToDatabase();
    const rows = await AccessAssignmentAuditModel.find({ restaurantAdminAccountId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((row) => toDomain<AccessAssignmentAudit>(row));
  }

  private publicAccount(account: RestaurantAdminAccount) {
    return {
      id: account.id,
      restaurantId: account.restaurantId,
      email: account.email,
      organizationId: account.organizationId,
      orgRole: account.orgRole,
      outletIds: account.outletIds,
      isActive: account.isActive,
      updatedAt: account.updatedAt,
    };
  }
}

export const accessAssignmentService = new AccessAssignmentService();
