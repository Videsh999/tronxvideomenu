import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;

export type EncryptedCredential = {
  passwordCiphertext: string;
  passwordIv: string;
  passwordAuthTag: string;
};

export type CredentialEncryptionStatus = "READY" | "MISSING" | "INVALID";

export class CredentialEncryptionConfigurationError extends Error {
  constructor(status: Exclude<CredentialEncryptionStatus, "READY">) {
    super(status === "MISSING"
      ? "Credential encryption is not configured. Set CREDENTIALS_ENCRYPTION_KEY to a Base64-encoded 32-byte key."
      : "Credential encryption configuration is invalid. CREDENTIALS_ENCRYPTION_KEY must be a canonical Base64-encoded 32-byte key.");
    this.name = "CredentialEncryptionConfigurationError";
  }
}

export function getCredentialEncryptionStatus(): CredentialEncryptionStatus {
  const encoded = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) return "MISSING";
  if (encoded.length !== 44) return "INVALID";
  const key = Buffer.from(encoded, "base64");
  return key.length === KEY_BYTES && key.toString("base64") === encoded ? "READY" : "INVALID";
}

function getEncryptionKey(): Buffer {
  const encoded = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new CredentialEncryptionConfigurationError("MISSING");
  if (encoded.length !== 44) throw new CredentialEncryptionConfigurationError("INVALID");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
    throw new CredentialEncryptionConfigurationError("INVALID");
  }
  return key;
}

export function encryptCredentialPassword(password: string): EncryptedCredential {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    passwordCiphertext: ciphertext.toString("base64url"),
    passwordIv: iv.toString("base64url"),
    passwordAuthTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptCredentialPassword(input: EncryptedCredential): string {
  try {
    const iv = Buffer.from(input.passwordIv, "base64url");
    const authTag = Buffer.from(input.passwordAuthTag, "base64url");
    if (iv.length !== IV_BYTES || authTag.length !== 16) throw new Error("invalid stored credential");
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(input.passwordCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof CredentialEncryptionConfigurationError) throw error;
    throw new Error("Stored account credential could not be decrypted.");
  }
}
