import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

/**
 * Credential storage.
 * On Windows production installs, prefer DPAPI / Credential Manager (documented).
 * This file-backed store uses restrictive permissions as a portable fallback for development.
 */
export type StoredCredentials = {
  connectorId: string;
  connectorSecret: string;
  restaurantId: string;
  outletId: string;
  credentialVersion: number;
};

export function credentialsPath(dataDir: string): string {
  return join(dataDir, "credentials.json");
}

export function loadCredentials(dataDir: string): StoredCredentials | null {
  const path = credentialsPath(dataDir);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredCredentials;
}

export function saveCredentials(dataDir: string, creds: StoredCredentials): void {
  mkdirSync(dataDir, { recursive: true });
  const path = credentialsPath(dataDir);
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows may ignore POSIX modes; installer guide covers ACL hardening.
  }
}

export function clearCredentials(dataDir: string): void {
  const path = credentialsPath(dataDir);
  if (existsSync(path)) writeFileSync(path, "", { mode: 0o600 });
}
