import { captainRepository } from "@/lib/repositories/captain.repository";
import { hashCaptainPassword, verifyCaptainPassword } from "@/lib/security/captain-password";
import { decryptCredentialPassword, encryptCredentialPassword } from "@/lib/security/credential-crypto-core";
import { toCaptainView } from "@/lib/security/captain-view";
import { canManageCaptainCredentials, type CredentialActorRole } from "@/lib/security/credential-access";

export class CaptainService {
  constructor(private readonly repository: typeof captainRepository = captainRepository) {}

  getById(id: string) {
    return this.repository.findById(id);
  }

  async authenticate(restaurantId: string, email: string, password: string) {
    const captain = await this.repository.findByRestaurantAndEmail(restaurantId, email.trim().toLowerCase());
    if (!captain || !captain.isActive || !(await verifyCaptainPassword(password, captain.passwordHash))) return null;
    return captain;
  }

  async list(restaurantId: string) {
    return (await this.repository.findByRestaurantId(restaurantId)).map(toCaptainView);
  }

  async create(restaurantId: string, input: { name: string; email: string; password: string }) {
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
    });
    return toCaptainView(captain);
  }

  async setActive(restaurantId: string, id: string, isActive: boolean) {
    const captain = await this.repository.updateForRestaurant(restaurantId, id, { isActive });
    return captain ? toCaptainView(captain) : null;
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
