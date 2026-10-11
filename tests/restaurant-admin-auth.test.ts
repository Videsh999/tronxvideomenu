import assert from "node:assert/strict";
import test from "node:test";
import type { Restaurant, RestaurantAdminAccount } from "../types/index";
import { RestaurantAdminService } from "../lib/services/restaurant-admin.service";
import { encryptCredentialPassword, CredentialEncryptionConfigurationError } from "../lib/security/credential-crypto-core";
import { hashCaptainPassword } from "../lib/security/captain-password";
import type { restaurantAdminRepository } from "../lib/repositories/restaurant-admin.repository";
import type { restaurantRepository } from "../lib/repositories/restaurant.repository";
import { canManageRestaurantAdminCredentials } from "../lib/security/credential-access";

const key = Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index)).toString("base64");
const legacyEnvNames = [
  "MOAI_KITCHEN_ADMIN_RESTAURANT_SLUG", "MOAI_KITCHEN_ADMIN_EMAIL", "MOAI_KITCHEN_ADMIN_PASSWORD",
  "NATIVE_SOUTH_ADMIN_RESTAURANT_SLUG", "NATIVE_SOUTH_ADMIN_EMAIL", "NATIVE_SOUTH_ADMIN_PASSWORD",
] as const;

async function withEnvironment(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const names = ["CREDENTIALS_ENCRYPTION_KEY", ...legacyEnvNames] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try { await run(); }
  finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function createService(initialRestaurants: Restaurant[] = [], initialAccounts: RestaurantAdminAccount[] = []) {
  const restaurants = [...initialRestaurants];
  const accounts = [...initialAccounts];
  let nextId = 1;
  const accountStore = {
    async findByRestaurantId(restaurantId: string) { return accounts.find((entry) => entry.restaurantId === restaurantId) ?? null; },
    async findCredentialStatusByRestaurantId(restaurantId: string) { return accounts.find((entry) => entry.restaurantId === restaurantId) ?? null; },
    async findCredentialByRestaurantId(restaurantId: string) { return accounts.find((entry) => entry.restaurantId === restaurantId) ?? null; },
    async findByRestaurantAndEmail(restaurantId: string, email: string) { return accounts.find((entry) => entry.restaurantId === restaurantId && entry.email === email) ?? null; },
    async findByEmail(email: string) { return accounts.filter((entry) => entry.email === email); },
    async findCredentialStatuses(ids: string[]) { return accounts.filter((entry) => ids.includes(entry.restaurantId)); },
    async createIfAbsent(input: Omit<RestaurantAdminAccount, "id" | "createdAt" | "updatedAt">) {
      const existing = accounts.find((entry) => entry.restaurantId === input.restaurantId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const account = { ...input, id: `admin-${nextId++}`, createdAt: now, updatedAt: now };
      accounts.push(account);
      return account;
    },
    async setCredentials(restaurantId: string, input: Pick<RestaurantAdminAccount, "email" | "passwordHash" | "passwordCiphertext" | "passwordIv" | "passwordAuthTag">) {
      const now = new Date().toISOString();
      const existing = accounts.find((entry) => entry.restaurantId === restaurantId);
      if (existing) Object.assign(existing, input, { updatedAt: now });
      else accounts.push({ ...input, restaurantId, id: `admin-${nextId++}`, isActive: true, createdAt: now, updatedAt: now });
      return accounts.find((entry) => entry.restaurantId === restaurantId) ?? null;
    },
    async setActive(restaurantId: string, isActive: boolean) {
      const account = accounts.find((entry) => entry.restaurantId === restaurantId);
      if (account) Object.assign(account, { isActive, updatedAt: new Date().toISOString() });
      return account ?? null;
    },
  };
  const restaurantStore = {
    async findById(id: string) { return restaurants.find((entry) => entry.id === id) ?? null; },
    async findBySlug(slug: string) { return restaurants.find((entry) => entry.slug === slug) ?? null; },
  };
  return {
    service: new RestaurantAdminService(
      accountStore as unknown as typeof restaurantAdminRepository,
      restaurantStore as unknown as typeof restaurantRepository,
    ),
    accounts,
  };
}

function restaurant(id: string, slug: string): Restaurant {
  return { id, slug, name: slug, isActive: true } as Restaurant;
}

test("new restaurant authenticates through database credentials without restaurant-specific environment variables", async () => {
  await withEnvironment({ CREDENTIALS_ENCRYPTION_KEY: key }, async () => {
    const hashed = await hashCaptainPassword("new-admin-password");
    const encrypted = encryptCredentialPassword("new-admin-password");
    const seededAccount: RestaurantAdminAccount = {
      id: "admin-new", restaurantId: "new-restaurant", email: "owner@example.test",
      passwordHash: hashed, ...encrypted, isActive: true, createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    const { service } = createService([restaurant("new-restaurant", "new-restaurant")], [seededAccount]);
    const identity = await service.authenticateWithoutRestaurant("owner@example.test", "new-admin-password");
    assert.equal(identity?.restaurantId, "new-restaurant");
    assert.equal(identity?.accountId, "admin-new");
  });
});

test("legacy login migrates once and repeated login uses the database account without overwriting it", async () => {
  await withEnvironment({
    CREDENTIALS_ENCRYPTION_KEY: key,
    MOAI_KITCHEN_ADMIN_RESTAURANT_SLUG: "legacy-cafe",
    MOAI_KITCHEN_ADMIN_EMAIL: "legacy@example.test",
    MOAI_KITCHEN_ADMIN_PASSWORD: "legacy-password",
  }, async () => {
    const { service, accounts } = createService([restaurant("legacy-cafe", "legacy-cafe")]);
    const first = await service.authenticateForRestaurant(restaurant("legacy-cafe", "legacy-cafe"), "legacy@example.test", "legacy-password");
    const originalHash = accounts[0]?.passwordHash;
    await service.migrateLegacyCredentials("legacy-cafe");
    const second = await service.authenticateForRestaurant(restaurant("legacy-cafe", "legacy-cafe"), "legacy@example.test", "legacy-password");
    assert.equal(first?.accountId, "admin-1");
    assert.equal(second?.accountId, "admin-1");
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.passwordHash, originalHash);
    assert.equal((await service.getPassword("legacy-cafe"))?.password, "legacy-password");
    assert.deepEqual(await service.verifyDatabaseCredentials("legacy-cafe"), {
      verified: true,
      result: "VERIFIED_DATABASE_LOGIN_AND_RECOVERY",
    });
  });
});

test("legacy login continues when encryption is missing or invalid, while explicit migration fails safely", async () => {
  for (const encryptionKey of [undefined, "not-a-canonical-key"]) {
    await withEnvironment({
      CREDENTIALS_ENCRYPTION_KEY: encryptionKey,
      MOAI_KITCHEN_ADMIN_RESTAURANT_SLUG: "legacy-cafe",
      MOAI_KITCHEN_ADMIN_EMAIL: "legacy@example.test",
      MOAI_KITCHEN_ADMIN_PASSWORD: "legacy-password",
    }, async () => {
      const { service, accounts } = createService([restaurant("legacy-cafe", "legacy-cafe")]);
      const identity = await service.authenticateForRestaurant(restaurant("legacy-cafe", "legacy-cafe"), "legacy@example.test", "legacy-password");
      assert.equal(identity?.restaurantId, "legacy-cafe");
      assert.equal(identity?.accountId, undefined);
      assert.equal(accounts.length, 0);
      await assert.rejects(service.migrateLegacyCredentials("legacy-cafe"), CredentialEncryptionConfigurationError);
      assert.equal(accounts.length, 0);
    });
  }
});

test("hash-only account remains login-capable but readiness reports that password retrieval is unavailable", async () => {
  await withEnvironment({ CREDENTIALS_ENCRYPTION_KEY: key }, async () => {
    const account: RestaurantAdminAccount = {
      id: "hash-only", restaurantId: "legacy-cafe", email: "legacy@example.test",
      passwordHash: await hashCaptainPassword("old-password"), isActive: true,
      createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    const { service } = createService([restaurant("legacy-cafe", "legacy-cafe")], [account]);
    const identity = await service.authenticateForRestaurant(restaurant("legacy-cafe", "legacy-cafe"), "legacy@example.test", "old-password");
    const [status] = await service.getCredentialStatuses([restaurant("legacy-cafe", "legacy-cafe")]);
    assert.equal(identity?.accountId, "hash-only");
    assert.equal(status?.readiness, "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE");
    assert.equal(status?.databaseLoginReady, true);
    assert.equal(JSON.stringify(status).includes(account.passwordHash), false);
    assert.equal(JSON.stringify(status).includes("passwordCiphertext"), false);
  });
});

test("deactivation invalidates a database-backed Restaurant Admin session", async () => {
  await withEnvironment({ CREDENTIALS_ENCRYPTION_KEY: key }, async () => {
    const account: RestaurantAdminAccount = {
      id: "active-admin", restaurantId: "new-restaurant", email: "owner@example.test",
      passwordHash: await hashCaptainPassword("secret"), ...encryptCredentialPassword("secret"),
      isActive: true, createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    const { service } = createService([restaurant("new-restaurant", "new-restaurant")], [account]);
    assert.equal(await service.isSessionCurrent(account.restaurantId, account.id, account.email, account.updatedAt), true);
    await service.setActive(account.restaurantId, false);
    assert.equal(await service.isSessionCurrent(account.restaurantId, account.id, account.email, account.updatedAt), false);
  });
});

test("only Super Admin can manage Restaurant Admin credential retrieval", () => {
  assert.equal(canManageRestaurantAdminCredentials("SUPER_ADMIN"), true);
  assert.equal(canManageRestaurantAdminCredentials("RESTAURANT_ADMIN"), false);
  assert.equal(canManageRestaurantAdminCredentials("CAPTAIN"), false);
});
