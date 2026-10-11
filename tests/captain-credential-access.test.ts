import assert from "node:assert/strict";
import test from "node:test";
import { CaptainService } from "../lib/services/captain.service";
import { encryptCredentialPassword } from "../lib/security/credential-crypto-core";
import { canManageCaptainCredentials } from "../lib/security/credential-access";
import { hashCaptainPassword } from "../lib/security/captain-password";
import type { captainRepository } from "../lib/repositories/captain.repository";
import type { Captain } from "../types/index";

const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

test("Captain credential permission requires Restaurant Admin role and matching tenant", () => {
  assert.equal(canManageCaptainCredentials("RESTAURANT_ADMIN", "restaurant-a", "restaurant-a"), true);
  assert.equal(canManageCaptainCredentials("RESTAURANT_ADMIN", "restaurant-a", "restaurant-b"), false);
  assert.equal(canManageCaptainCredentials("SUPER_ADMIN", "restaurant-a", "restaurant-a"), false);
  assert.equal(canManageCaptainCredentials("CAPTAIN", "restaurant-a", "restaurant-a"), false);
});

test("Captain password retrieval refuses another restaurant's credential record", async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
  const encrypted = encryptCredentialPassword("captain-secret");
  let lookupScope: string | undefined;
  const repository = {
    async findCredentialsByRestaurant(restaurantId: string) {
      lookupScope = restaurantId;
      // Model an unexpected/wrong-tenant record from a faulty repository.
      return { id: "captain-b", restaurantId: "restaurant-b", ...encrypted };
    },
  };
  const service = new CaptainService(repository as unknown as typeof captainRepository);
  const result = await service.getSavedPassword({ role: "RESTAURANT_ADMIN", restaurantId: "restaurant-a" }, "captain-b");
  assert.equal(lookupScope, "restaurant-a");
  assert.equal(result, null);
});

test("setting a retrievable Captain password enables login and authorized retrieval without exposing stored fields", async () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const captain: Captain = {
      id: "captain-a",
      restaurantId: "restaurant-a",
      name: "Test Captain",
      email: "captain@example.test",
      passwordHash: await hashCaptainPassword("old-hash-only-password"),
      isActive: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const repository = {
      async findByRestaurantAndEmail(restaurantId: string, email: string) {
        return captain.restaurantId === restaurantId && captain.email === email ? captain : null;
      },
      async updateForRestaurant(restaurantId: string, id: string, patch: Partial<Captain>) {
        if (captain.restaurantId !== restaurantId || captain.id !== id) return null;
        Object.assign(captain, patch, { updatedAt: "2026-10-02T00:00:00.000Z" });
        return captain;
      },
      async findCredentialsByRestaurant(restaurantId: string, id: string) {
        return captain.restaurantId === restaurantId && captain.id === id ? captain : null;
      },
    };
    const service = new CaptainService(repository as unknown as typeof captainRepository);
    const result = await service.resetPassword("restaurant-a", captain.id, "new-retrievable-password");

    assert.equal(result?.passwordConfigured, true);
    assert.equal("passwordHash" in (result ?? {}), false);
    assert.equal("passwordCiphertext" in (result ?? {}), false);
    assert.equal("passwordIv" in (result ?? {}), false);
    assert.equal("passwordAuthTag" in (result ?? {}), false);
    assert.equal(await service.authenticate("restaurant-a", captain.email, "old-hash-only-password"), null);
    assert.equal((await service.authenticate("restaurant-a", captain.email, "new-retrievable-password"))?.id, captain.id);
    assert.deepEqual(
      await service.getSavedPassword({ role: "RESTAURANT_ADMIN", restaurantId: "restaurant-a" }, captain.id),
      { passwordConfigured: true, password: "new-retrievable-password" },
    );
  } finally {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
  }
});

test.after(() => {
  if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
});
