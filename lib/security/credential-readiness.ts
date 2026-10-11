import type { CredentialEncryptionStatus } from "@/lib/security/credential-crypto-core";

export type CredentialReadiness =
  | "NO_DATABASE_ACCOUNT"
  | "LEGACY_FALLBACK_REQUIRED"
  | "DATABASE_LOGIN_CONFIGURATION_INVALID"
  | "DATABASE_ACCOUNT_INACTIVE"
  | "RESTAURANT_INACTIVE"
  | "DATABASE_PASSWORD_RECORD_INCOMPLETE"
  | "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE"
  | "DATABASE_LOGIN_READY_ENCRYPTION_KEY_MISSING"
  | "DATABASE_LOGIN_READY_ENCRYPTION_KEY_INVALID"
  | "DATABASE_LOGIN_AND_RECOVERY_CHECK_REQUIRED";

export function getCredentialReadiness(input: {
  databaseAccountExists: boolean;
  validLoginHash: boolean;
  accountActive: boolean;
  restaurantActive: boolean;
  anyEncryptedPasswordField: boolean;
  completeEncryptedPassword: boolean;
  encryptionKeyStatus: CredentialEncryptionStatus;
  legacyCredentialsAvailable: boolean;
}): CredentialReadiness {
  if (!input.databaseAccountExists) {
    return input.legacyCredentialsAvailable ? "LEGACY_FALLBACK_REQUIRED" : "NO_DATABASE_ACCOUNT";
  }
  if (!input.validLoginHash) return "DATABASE_LOGIN_CONFIGURATION_INVALID";
  if (!input.accountActive) return "DATABASE_ACCOUNT_INACTIVE";
  if (!input.restaurantActive) return "RESTAURANT_INACTIVE";
  if (input.anyEncryptedPasswordField && !input.completeEncryptedPassword) return "DATABASE_PASSWORD_RECORD_INCOMPLETE";
  if (!input.completeEncryptedPassword) return "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE";
  if (input.encryptionKeyStatus === "MISSING") return "DATABASE_LOGIN_READY_ENCRYPTION_KEY_MISSING";
  if (input.encryptionKeyStatus === "INVALID") return "DATABASE_LOGIN_READY_ENCRYPTION_KEY_INVALID";
  return "DATABASE_LOGIN_AND_RECOVERY_CHECK_REQUIRED";
}
