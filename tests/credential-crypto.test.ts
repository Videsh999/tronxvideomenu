import assert from "node:assert/strict";
import test from "node:test";
import {
  CredentialEncryptionConfigurationError,
  decryptCredentialPassword,
  encryptCredentialPassword,
} from "../lib/security/credential-crypto-core";
import { hashCaptainPassword, verifyCaptainPassword } from "../lib/security/captain-password";
import { toCaptainView } from "../lib/security/captain-view";
import { getCredentialEncryptionStatus } from "../lib/security/credential-crypto-core";
import { getCredentialReadiness } from "../lib/security/credential-readiness";

const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
const validKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index)).toString("base64");

test("credential encryption authenticates and survives serialization with a persistent key", () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = validKey;
  const encrypted = encryptCredentialPassword("recoverable-secret");
  const storedRecord = JSON.parse(JSON.stringify(encrypted));

  // Simulate a later process using the same deployment key and stored Mongo fields.
  process.env.CREDENTIALS_ENCRYPTION_KEY = validKey;
  assert.equal(decryptCredentialPassword(storedRecord), "recoverable-secret");
  assert.equal(JSON.stringify(storedRecord).includes("recoverable-secret"), false);
});

test("missing and malformed encryption keys fail with a safe configuration error", () => {
  delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  assert.equal(getCredentialEncryptionStatus(), "MISSING");
  assert.throws(() => encryptCredentialPassword("secret"), CredentialEncryptionConfigurationError);

  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(31).toString("base64");
  assert.equal(getCredentialEncryptionStatus(), "INVALID");
  assert.throws(() => encryptCredentialPassword("secret"), CredentialEncryptionConfigurationError);
});

test("a wrong encryption key cannot decrypt saved credentials", () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = validKey;
  assert.equal(getCredentialEncryptionStatus(), "READY");
  const encrypted = encryptCredentialPassword("secret");
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  assert.throws(() => decryptCredentialPassword(encrypted), /could not be decrypted/);
});

test("migration readiness distinguishes missing accounts, legacy fallback, hash-only and encrypted records", () => {
  const base = {
    databaseAccountExists: true,
    validLoginHash: true,
    accountActive: true,
    restaurantActive: true,
    anyEncryptedPasswordField: false,
    completeEncryptedPassword: false,
    encryptionKeyStatus: "READY" as const,
    legacyCredentialsAvailable: false,
  };
  assert.equal(getCredentialReadiness({ ...base, databaseAccountExists: false }), "NO_DATABASE_ACCOUNT");
  assert.equal(getCredentialReadiness({ ...base, databaseAccountExists: false, legacyCredentialsAvailable: true }), "LEGACY_FALLBACK_REQUIRED");
  assert.equal(getCredentialReadiness(base), "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE");
  assert.equal(getCredentialReadiness({ ...base, anyEncryptedPasswordField: true, completeEncryptedPassword: true, encryptionKeyStatus: "MISSING" }), "DATABASE_LOGIN_READY_ENCRYPTION_KEY_MISSING");
  assert.equal(getCredentialReadiness({ ...base, anyEncryptedPasswordField: true, completeEncryptedPassword: true, encryptionKeyStatus: "INVALID" }), "DATABASE_LOGIN_READY_ENCRYPTION_KEY_INVALID");
  assert.equal(getCredentialReadiness({ ...base, anyEncryptedPasswordField: true, completeEncryptedPassword: true }), "DATABASE_LOGIN_AND_RECOVERY_CHECK_REQUIRED");
  assert.equal(getCredentialReadiness({ ...base, validLoginHash: false }), "DATABASE_LOGIN_CONFIGURATION_INVALID");
});

test("password hashing remains usable for login and is not treated as recoverable", async () => {
  const encoded = await hashCaptainPassword("login-secret");
  assert.equal(await verifyCaptainPassword("login-secret", encoded), true);
  assert.equal(await verifyCaptainPassword("wrong-secret", encoded), false);
  assert.notEqual(encoded, "login-secret");
});

test("Captain list projection removes hashes and encrypted records", () => {
  const view = toCaptainView({
    id: "captain-1", restaurantId: "restaurant-a", name: "A", email: "a@example.test",
    passwordHash: "scrypt$hash", passwordCiphertext: "cipher", passwordIv: "iv",
    passwordAuthTag: "tag", isActive: true, createdAt: "now", updatedAt: "now",
  });
  assert.equal(view.passwordConfigured, true);
  assert.equal("passwordHash" in view, false);
  assert.equal("passwordCiphertext" in view, false);
  assert.equal("passwordIv" in view, false);
  assert.equal("passwordAuthTag" in view, false);
});

test.after(() => {
  if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
});
