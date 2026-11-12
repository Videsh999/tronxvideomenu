import { captainRepository } from "@/lib/repositories/captain.repository";
import { captainAssignmentRepository } from "@/lib/repositories/captain-assignment.repository";
import { tableRepository } from "@/lib/repositories/table.repository";
import { hashCaptainPassword, verifyCaptainPassword } from "@/lib/security/captain-password";
import { decryptCredentialPassword, encryptCredentialPassword } from "@/lib/security/credential-crypto-core";
import { toCaptainView } from "@/lib/security/captain-view";
import { canManageCaptainCredentials, type CredentialActorRole } from "@/lib/security/credential-access";
import type { Captain, CaptainTableAssignmentEvent } from "@/types";

export class CaptainService {
  constructor(private readonly repository: typeof captainRepository = captainRepository) {}

  getById(id: string) {
    return this.repository.findById(id);
  }

  async authenticate(restaurantId: string, email: string, password: string) {
    const captain = await this.repository.findByRestaurantAndEmail(restaurantId, email.trim().toLowerCase());
    if (!captain || !captain.isActive || !(await verifyCaptainPassword(password, captain.passwordHash))) return null;
    // Do not bump updatedAt here — sessions bind to captainUpdatedAt and would immediately 403.
    void this.repository.touchLastActiveAt(restaurantId, captain.id, new Date().toISOString());
    return captain;
  }

  async authenticateByEmail(email: string, password: string) {
    const candidates = await this.repository.findByEmail(email);
    if (candidates.length > 10) return { captain: null, ambiguous: true } as const;
    const matches: Captain[] = [];
    for (const captain of candidates) {
      if (await verifyCaptainPassword(password, captain.passwordHash)) matches.push(captain);
    }
    if (matches.length !== 1) return { captain: null, ambiguous: matches.length > 1 } as const;
    const captain = matches[0]!;
    void this.repository.touchLastActiveAt(captain.restaurantId, captain.id, new Date().toISOString());
    return { captain, ambiguous: false } as const;
  }

  async list(restaurantId: string) {
    return (await this.repository.findByRestaurantId(restaurantId)).map(toCaptainView);
  }

  async create(
    restaurantId: string,
    input: { name: string; email: string; password: string; employeeCode?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.repository.findByRestaurantAndEmail(restaurantId, email);
    if (existing) throw new Error("A Captain with this email already exists for this restaurant.");
    const captain = await this.repository.create({
      restaurantId,
      name: input.name.trim(),
      email,
      passwordHash: await hashCaptainPassword(input.password),
      ...encryptCredentialPassword(input.password),
      isActive: true,
      employeeCode: input.employeeCode?.trim() || undefined,
      assignedTableIds: [],
    });
    return toCaptainView(captain);
  }

  async setActive(restaurantId: string, id: string, isActive: boolean) {
    const captain = await this.repository.updateForRestaurant(restaurantId, id, { isActive });
    return captain ? toCaptainView(captain) : null;
  }

  async updateProfile(
    restaurantId: string,
    id: string,
    patch: {
      name?: string;
      employeeCode?: string | null;
      permissions?: Captain["permissions"];
    },
  ) {
    const update: {
      name?: string;
      employeeCode?: string;
      permissions?: Captain["permissions"];
    } = {};
    if (typeof patch.name === "string" && patch.name.trim()) update.name = patch.name.trim();
    if (patch.employeeCode === null) update.employeeCode = "";
    else if (typeof patch.employeeCode === "string") update.employeeCode = patch.employeeCode.trim();
    if (patch.permissions) update.permissions = patch.permissions;
    const captain = await this.repository.updateForRestaurant(restaurantId, id, update);
    return captain ? toCaptainView(captain) : null;
  }

  /**
   * Replace assigned tables for a captain. Tables are exclusive by default:
   * assigning to A removes them from other captains in the same outlet.
   */
  async assignTables(
    restaurantId: string,
    captainId: string,
    tableIds: string[],
    changedBy: CaptainTableAssignmentEvent["changedBy"],
    note?: string,
  ) {
    const captain = await this.repository.findById(captainId);
    if (!captain || captain.restaurantId !== restaurantId) {
      throw new Error("Captain not found.");
    }

    const uniqueIds = [...new Set(tableIds.map((id) => id.trim()).filter(Boolean))];
    const tables = await tableRepository.findByRestaurantId(restaurantId);
    const validIds = new Set(tables.filter((table) => table.isActive).map((table) => table.id));
    const invalid = uniqueIds.filter((id) => !validIds.has(id));
    if (invalid.length) {
      throw new Error("One or more tables are invalid or inactive for this outlet.");
    }

    const previous = captain.assignedTableIds ?? [];
    const previousSet = new Set(previous);
    const nextSet = new Set(uniqueIds);
    const tableIdsAdded = uniqueIds.filter((id) => !previousSet.has(id));
    const tableIdsRemoved = previous.filter((id) => !nextSet.has(id));

    await this.repository.pullTableFromOthers(restaurantId, uniqueIds, captainId);
    const updated = await this.repository.updateForRestaurant(restaurantId, captainId, {
      assignedTableIds: uniqueIds,
    });
    if (!updated) throw new Error("Unable to save table assignment.");

    await captainAssignmentRepository.append({
      restaurantId,
      captainId,
      tableIdsAdded,
      tableIdsRemoved,
      resultingTableIds: uniqueIds,
      changedBy,
      note,
    });

    return toCaptainView(updated);
  }

  listAssignmentHistory(restaurantId: string, limit = 50) {
    return captainAssignmentRepository.listForRestaurant(restaurantId, limit);
  }

  async assertCaptainMayServeTable(captainId: string, restaurantId: string, tableId: string) {
    const captain = await this.repository.findById(captainId);
    if (!captain || captain.restaurantId !== restaurantId || !captain.isActive) {
      throw new Error("Captain not authorized.");
    }
    const table = await tableRepository.findByRestaurantAndId(restaurantId, tableId);
    if (!table || !table.isActive || table.status === "CLOSED") throw new Error("This location is unavailable to your outlet.");
    return captain;
  }

  async resetPassword(restaurantId: string, id: string, password: string) {
    const captain = await this.repository.updateForRestaurant(restaurantId, id, {
      passwordHash: await hashCaptainPassword(password),
      ...encryptCredentialPassword(password),
    });
    return captain ? toCaptainView(captain) : null;
  }

  async getSavedPassword(actor: { role: CredentialActorRole; restaurantId: string }, id: string) {
    if (!canManageCaptainCredentials(actor.role, actor.restaurantId, actor.restaurantId)) return null;
    const captain = await this.repository.findCredentialsByRestaurant(actor.restaurantId, id);
    if (!captain) return null;
    if (!canManageCaptainCredentials(actor.role, actor.restaurantId, captain.restaurantId)) return null;
    if (!captain.passwordCiphertext || !captain.passwordIv || !captain.passwordAuthTag) return { passwordConfigured: false as const };
    return {
      passwordConfigured: true as const,
      password: decryptCredentialPassword({
        passwordCiphertext: captain.passwordCiphertext,
        passwordIv: captain.passwordIv,
        passwordAuthTag: captain.passwordAuthTag,
      }),
    };
  }
}

export const captainService = new CaptainService();
