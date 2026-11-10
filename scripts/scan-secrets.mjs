import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const skip = new Set(["node_modules", ".git", ".next", "coverage"]);
const placeholderPasswords = new Set(["secret", "pass", "password", "example", "changeme", "placeholder"]);
const envNames = new Set([".env", ".env.local", ".env.production", ".env.development", ".env.test"]);
const patterns = [
  { name: "private key", re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { name: "razorpay key", re: /rzp_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { name: "whatsapp token", re: /EAA[A-Za-z0-9]{30,}/ },
  { name: "api key", re: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: "bearer token", re: /Bearer\s+[A-Za-z0-9\-._~+/]{32,}={0,2}/ },
];

function isEnvFile(name) {
  return envNames.has(name);
}

function envValueIsSecret(value) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (trimmed.length < 12) return false;
  if (placeholderPasswords.has(trimmed.toLowerCase())) return false;
  if (/^(localhost|127\.0\.0\.1|example|changeme|placeholder|your[-_])/i.test(trimmed)) return false;
  return true;
}

function walk(dir, hits) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, hits);
    else if (isEnvFile(entry) || /\.(ts|tsx|js|mjs|json|md|env|yml|yaml)$/.test(entry)) {
      if (entry.endsWith(".example")) continue;
      const text = readFileSync(full, "utf8");
      for (const match of text.matchAll(/mongodb\+srv:\/\/([^/\s:]+):([^@\s/]+)@/g)) {
        if (!placeholderPasswords.has(match[2])) hits.push(`mongodb+srv credentials: ${full}`);
      }
      for (const pattern of patterns) {
        if (pattern.re.test(text)) hits.push(`${pattern.name}: ${full}`);
      }
      if (isEnvFile(entry)) {
        for (const line of text.split("\n")) {
          const match = line.match(/^\s*[A-Z0-9_]+\s*=\s*(.*)$/);
          if (match && envValueIsSecret(match[1])) hits.push(`env secret: ${full}`);
        }
      }
    }
  }
}

const hits = [];
walk(process.cwd(), hits);
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("Secret scan passed.");
