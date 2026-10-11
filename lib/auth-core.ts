export const SUPER_ADMIN_SESSION_COOKIE = "tronx_super_admin_session";
export const RESTAURANT_ADMIN_SESSION_COOKIE = "tronx_restaurant_admin_session";
export const CAPTAIN_SESSION_COOKIE = "tronx_captain_session";
export type SessionRole = "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN";
export function sessionCookieForRole(role: SessionRole) {
  if (role === "SUPER_ADMIN") return SUPER_ADMIN_SESSION_COOKIE;
  if (role === "CAPTAIN") return CAPTAIN_SESSION_COOKIE;
  return RESTAURANT_ADMIN_SESSION_COOKIE;
}
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  email: string;
  role: SessionRole;
  captainId?: string;
  captainUpdatedAt?: string;
  restaurantAdminAccountId?: string;
  restaurantAdminUpdatedAt?: string;
  restaurantId?: string;
  restaurantSlug?: string;
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
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
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
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createAdminSession(
  email: string,
  secret: string,
  role: SessionPayload["role"] = "RESTAURANT_ADMIN",
  restaurantId?: string,
  restaurantSlug?: string,
  captainId?: string,
  captainUpdatedAt?: string,
  restaurantAdminAccountId?: string,
  restaurantAdminUpdatedAt?: string,
): Promise<string> {
  const payload = encodeBase64Url(
    JSON.stringify({
      email,
      role,
      restaurantId,
      restaurantSlug,
      captainId,
      captainUpdatedAt,
      restaurantAdminAccountId,
      restaurantAdminUpdatedAt,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies SessionPayload),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false;
  const session = await readAdminSession(token, secret);
  return Boolean(session);
}

export async function readAdminSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await sign(payload, secret);
  if (signature.length !== expectedSignature.length) return null;

  const signatureBytes = new TextEncoder().encode(signature);
  const expectedBytes = new TextEncoder().encode(expectedSignature);
  let mismatch = 0;
  for (let index = 0; index < signatureBytes.length; index += 1) {
    mismatch |= signatureBytes[index] ^ expectedBytes[index];
  }
  if (mismatch !== 0) return null;

  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;

  try {
    const session = JSON.parse(decoded) as SessionPayload;
    if (!session.email || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export { SESSION_TTL_SECONDS };
