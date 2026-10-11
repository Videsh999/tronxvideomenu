import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashCaptainPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function isValidScryptPasswordHash(encoded: string) {
  const [algorithm, salt, hash] = encoded.split("$");
  return algorithm === "scrypt" && Boolean(salt) && /^[a-f\d]{128}$/i.test(hash ?? "");
}

export async function verifyCaptainPassword(password: string, encoded: string) {
  if (!isValidScryptPasswordHash(encoded)) return false;
  const [, salt, hash] = encoded.split("$");
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
