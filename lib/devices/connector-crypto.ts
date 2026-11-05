import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const CONNECTOR_OFFLINE_AFTER_MS = 90_000;

export function generatePairingCode(): string {
  // 8-char Crockford-ish alphanumeric, easy to type on POS.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export function generateConnectorSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function verifySecret(plain: string, hash: string): boolean {
  const computed = Buffer.from(hashSecret(plain), "hex");
  const expected = Buffer.from(hash, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
