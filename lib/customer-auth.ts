import { createHash, randomBytes } from "node:crypto";
import { hashCaptainPassword, verifyCaptainPassword } from "@/lib/security/captain-password";

export const CUSTOMER_SESSION_COOKIE = "tronx_customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type CustomerSessionPayload = {
  role: "CUSTOMER";
  customerId: string;
  restaurantId: string;
  restaurantSlug: string;
  phone: string;
  exp: number;
};

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createCustomerSession(
  payload: Omit<CustomerSessionPayload, "role" | "exp">,
  secret: string,
): Promise<string> {
  const body = encodeBase64Url(
    JSON.stringify({
      ...payload,
      role: "CUSTOMER",
      exp: Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_TTL_SECONDS,
    } satisfies CustomerSessionPayload),
  );
  return `${body}.${await sign(body, secret)}`;
}

export async function readCustomerSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<CustomerSessionPayload | null> {
  if (!token || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await sign(body, secret);
  if (expected !== signature) return null;
  const raw = decodeBase64Url(body);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CustomerSessionPayload;
    if (payload.role !== "CUSTOMER" || !payload.customerId || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function hashCustomerPassword(password: string) {
  return hashCaptainPassword(password);
}

export async function verifyCustomerPassword(password: string, hash: string) {
  return verifyCaptainPassword(password, hash);
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour
  return { token, tokenHash, expiresAt };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
