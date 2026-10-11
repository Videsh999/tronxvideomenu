import { timingSafeEqual } from "node:crypto";
import type { Restaurant, RestaurantAdminAccount, RestaurantAdminCredentialStatus, RestaurantAdminCredentialVerification } from "@/types";
import { restaurantAdminRepository } from "@/lib/repositories/restaurant-admin.repository";
import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import { hashCaptainPassword, isValidScryptPasswordHash, verifyCaptainPassword } from "@/lib/security/captain-password";
import {
  CredentialEncryptionConfigurationError,
  decryptCredentialPassword,
  encryptCredentialPassword,
  getCredentialEncryptionStatus,
} from "@/lib/security/credential-crypto-core";
import { getCredentialReadiness } from "@/lib/security/credential-readiness";
import { getLegacyRestaurantAdminConfig, getLegacyRestaurantAdminConfigs } from "@/lib/legacy-restaurant-admin-config";

type AdminLoginIdentity = {
  email: string;
  restaurantId: string;
  restaurantSlug: string;
  accountId?: string;
  accountUpdatedAt?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function sameSecret(value: string, expected: string) {
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function hasEncryptedPassword(account: Pick<RestaurantAdminAccount, "passwordCiphertext" | "passwordIv" | "passwordAuthTag">) {
  return Boolean(account.passwordCiphertext && account.passwordIv && account.passwordAuthTag);
}

function toStatus(restaurantId: string, account: RestaurantAdminAccount, restaurantActive = true): RestaurantAdminCredentialStatus {
  const passwordConfigured = hasEncryptedPassword(account);
  const encryptionKeyStatus = getCredentialEncryptionStatus();
  const validLoginHash = typeof account.passwordHash === "string" && isValidScryptPasswordHash(account.passwordHash);
  return {
    restaurantId,
    email: account.email,
    isActive: account.isActive,
    passwordConfigured,
    credentialSource: "DATABASE",
    needsPasswordSetup: !passwordConfigured,
    databaseAccountExists: true,
    databaseLoginReady: validLoginHash && account.isActive && restaurantActive,
    legacyFallbackRequired: false,
    encryptionKeyStatus,
    readiness: getCredentialReadiness({
      databaseAccountExists: true,
      validLoginHash,
      accountActive: account.isActive,
      restaurantActive,
      anyEncryptedPasswordField: Boolean(account.passwordCiphertext || account.passwordIv || account.passwordAuthTag),
      completeEncryptedPassword: passwordConfigured,
      encryptionKeyStatus,
      legacyCredentialsAvailable: false,
    }),
  };
}

function toNoAccountStatus(restaurantId: string, email: string | null, legacyAvailable: boolean): RestaurantAdminCredentialStatus {
  const encryptionKeyStatus = getCredentialEncryptionStatus();
  return {
    restaurantId,
    email,
    isActive: legacyAvailable ? true : null,
    passwordConfigured: legacyAvailable,
    credentialSource: legacyAvailable ? "LEGACY_ENV" : "NONE",
    needsPasswordSetup: !legacyAvailable,
    databaseAccountExists: false,
    databaseLoginReady: false,
    legacyFallbackRequired: legacyAvailable,
    encryptionKeyStatus,
    readiness: getCredentialReadiness({
      databaseAccountExists: false,
      validLoginHash: false,
      accountActive: false,
      restaurantActive: false,
      anyEncryptedPasswordField: false,
      completeEncryptedPassword: false,
      encryptionKeyStatus,
      legacyCredentialsAvailable: legacyAvailable,
    }),
  };
}

function toLoginIdentity(restaurant: Pick<Restaurant, "id" | "slug">, account?: RestaurantAdminAccount, email = ""): AdminLoginIdentity {
  return {
    email: account?.email ?? email,
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    ...(account ? { accountId: account.id, accountUpdatedAt: account.updatedAt } : {}),
  };
}

export class RestaurantAdminService {
  constructor(
    private readonly accounts: typeof restaurantAdminRepository = restaurantAdminRepository,
    private readonly restaurants: typeof restaurantRepository = restaurantRepository,
  ) {}

  async getCredentialStatuses(restaurants: Restaurant[]): Promise<RestaurantAdminCredentialStatus[]> {
    const accounts = await this.accounts.findCredentialStatuses(restaurants.map(({ id }) => id));
    const accountByRestaurantId = new Map(accounts.map((account) => [account.restaurantId, account]));

    return restaurants.map((restaurant) => {
      const account = accountByRestaurantId.get(restaurant.id);
      if (account) return toStatus(restaurant.id, account, restaurant.isActive !== false);
      const legacy = getLegacyRestaurantAdminConfig(restaurant.slug);
      if (legacy?.email && legacy.password) {
        return toNoAccountStatus(restaurant.id, normalizeEmail(legacy.email), true);
      }
      return toNoAccountStatus(restaurant.id, null, false);
    });
  }

  async migrateLegacyCredentials(restaurantId: string): Promise<RestaurantAdminCredentialStatus | null> {
    const restaurant = await this.restaurants.findById(restaurantId);
    if (!restaurant) return null;
    const existing = await this.accounts.findCredentialStatusByRestaurantId(restaurantId);
    if (existing) return toStatus(restaurantId, existing, restaurant.isActive !== false);

    const config = getLegacyRestaurantAdminConfig(restaurant.slug);
    if (!config?.email || !config.password) {
      return toNoAccountStatus(restaurantId, null, false);
    }

    const account = await this.accounts.createIfAbsent({
      restaurantId,
      email: normalizeEmail(config.email),
      passwordHash: await hashCaptainPassword(config.password),
      ...encryptCredentialPassword(config.password),
      isActive: true,
    });
    return account ? toStatus(restaurantId, account, restaurant.isActive !== false) : null;
  }

  async setCredentials(restaurantId: string, input: { email: string; password: string }) {
    const account = await this.accounts.setCredentials(restaurantId, {
      email: normalizeEmail(input.email),
      passwordHash: await hashCaptainPassword(input.password),
      ...encryptCredentialPassword(input.password),
    });
    const restaurant = await this.restaurants.findById(restaurantId);
    return account ? toStatus(restaurantId, account, restaurant?.isActive !== false) : null;
  }

  async setActive(restaurantId: string, isActive: boolean) {
    const account = await this.accounts.setActive(restaurantId, isActive);
    const restaurant = await this.restaurants.findById(restaurantId);
    return account ? toStatus(restaurantId, account, restaurant?.isActive !== false) : null;
  }

  async getPassword(restaurantId: string): Promise<{ email: string; password: string } | null> {
    const account = await this.accounts.findCredentialByRestaurantId(restaurantId);
    if (account) {
      if (!hasEncryptedPassword(account)) return null;
      return {
        email: account.email,
        password: decryptCredentialPassword({
          passwordCiphertext: account.passwordCiphertext!,
          passwordIv: account.passwordIv!,
          passwordAuthTag: account.passwordAuthTag!,
        }),
      };
    }

    const restaurant = await this.restaurants.findById(restaurantId);
    if (!restaurant) return null;
    const legacy = getLegacyRestaurantAdminConfig(restaurant.slug);
    return legacy?.email && legacy.password
      ? { email: normalizeEmail(legacy.email), password: legacy.password }
      : null;
  }

  async verifyDatabaseCredentials(restaurantId: string): Promise<RestaurantAdminCredentialVerification> {
    const account = await this.accounts.findCredentialStatusByRestaurantId(restaurantId);
    if (!account) return { verified: false, result: "NO_DATABASE_ACCOUNT" };
    if (typeof account.passwordHash !== "string" || !isValidScryptPasswordHash(account.passwordHash)) {
      return { verified: false, result: "INVALID_PASSWORD_HASH" };
    }
    if (!account.isActive) return { verified: false, result: "ACCOUNT_INACTIVE" };

    const restaurant = await this.restaurants.findById(restaurantId);
    if (!restaurant) return { verified: false, result: "NO_DATABASE_ACCOUNT" };
    if (restaurant.isActive === false) return { verified: false, result: "RESTAURANT_INACTIVE" };
    if (!hasEncryptedPassword(account)) return { verified: false, result: "PASSWORD_NOT_RECOVERABLE" };

    const encryptionStatus = getCredentialEncryptionStatus();
    if (encryptionStatus === "MISSING") return { verified: false, result: "ENCRYPTION_KEY_MISSING" };
    if (encryptionStatus === "INVALID") return { verified: false, result: "ENCRYPTION_KEY_INVALID" };

    let password: string;
    try {
      password = decryptCredentialPassword({
        passwordCiphertext: account.passwordCiphertext!,
        passwordIv: account.passwordIv!,
        passwordAuthTag: account.passwordAuthTag!,
      });
    } catch (error) {
      if (error instanceof CredentialEncryptionConfigurationError) {
        const status = getCredentialEncryptionStatus();
        return { verified: false, result: status === "MISSING" ? "ENCRYPTION_KEY_MISSING" : "ENCRYPTION_KEY_INVALID" };
      }
      return { verified: false, result: "STORED_CREDENTIALS_DO_NOT_MATCH" };
    }
    // Exercise the same tenant-specific DB account lookup and scrypt check as login.
    const identity = await this.authenticateForRestaurant(restaurant, account.email, password);
    return identity?.accountId === account.id
      ? { verified: true, result: "VERIFIED_DATABASE_LOGIN_AND_RECOVERY" }
      : { verified: false, result: "STORED_CREDENTIALS_DO_NOT_MATCH" };
  }

  async isSessionCurrent(restaurantId: string, accountId: string, email: string, updatedAt: string) {
    const account = await this.accounts.findByRestaurantId(restaurantId);
    return Boolean(
      account &&
      account.id === accountId &&
      account.isActive &&
      account.email === normalizeEmail(email) &&
      account.updatedAt === updatedAt,
    );
  }

  async authenticateForRestaurant(restaurant: Pick<Restaurant, "id" | "slug" | "isActive">, email: string, password: string): Promise<AdminLoginIdentity | null> {
    if (restaurant.isActive === false) return null;
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.accounts.findByRestaurantId(restaurant.id);
    if (existing) {
      if (!existing.isActive || existing.email !== normalizedEmail) return null;
      const account = await this.accounts.findByRestaurantAndEmail(restaurant.id, normalizedEmail);
      if (!account || !await verifyCaptainPassword(password, account.passwordHash)) return null;
      return toLoginIdentity(restaurant, account);
    }

    const legacy = getLegacyRestaurantAdminConfig(restaurant.slug);
    if (!legacy?.email || !legacy.password || normalizeEmail(legacy.email) !== normalizedEmail || !sameSecret(password, legacy.password)) return null;

    let migrated: RestaurantAdminCredentialStatus | null = null;
    try {
      migrated = await this.migrateLegacyCredentials(restaurant.id);
    } catch (error) {
      if (!(error instanceof CredentialEncryptionConfigurationError)) throw error;
    }
    if (migrated?.credentialSource === "DATABASE") {
      const account = await this.accounts.findByRestaurantAndEmail(restaurant.id, normalizedEmail);
      if (!account || !account.isActive || !await verifyCaptainPassword(password, account.passwordHash)) return null;
      return toLoginIdentity(restaurant, account);
    }
    return toLoginIdentity(restaurant, undefined, normalizedEmail);
  }

  async authenticateWithoutRestaurant(email: string, password: string): Promise<AdminLoginIdentity | null> {
    const normalizedEmail = normalizeEmail(email);
    const matchingDatabaseAccounts = await this.accounts.findByEmail(normalizedEmail);
    if (matchingDatabaseAccounts.length > 0) {
      const validAccounts = [];
      for (const account of matchingDatabaseAccounts) {
        if (account.isActive && await verifyCaptainPassword(password, account.passwordHash)) validAccounts.push(account);
      }
      if (validAccounts.length !== 1) return null;
      const account = validAccounts[0];
      const restaurant = await this.restaurants.findById(account.restaurantId);
      if (!restaurant || restaurant.isActive === false) return null;
      return toLoginIdentity(restaurant, account);
    }

    const candidates: AdminLoginIdentity[] = [];
    for (const config of getLegacyRestaurantAdminConfigs()) {
      if (!config.email || !config.password || normalizeEmail(config.email) !== normalizedEmail || !sameSecret(password, config.password)) continue;
      const restaurant = await this.restaurants.findBySlug(config.restaurantSlug);
      if (!restaurant) continue;
      const identity = await this.authenticateForRestaurant(restaurant, email, password);
      if (identity) candidates.push(identity);
    }
    return candidates.length === 1 ? candidates[0] : null;
  }
}

export const restaurantAdminService = new RestaurantAdminService();
