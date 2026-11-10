import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const skip = new Set(["node_modules", ".git", ".next", "coverage"]);
const placeholderPasswords = new Set(["secret", "pass", "password", "example", "changeme", "placeholder"]);
const patterns = [
  { name: "private key", re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
];

function walk(dir, hits) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, hits);
    else if (/\.(ts|tsx|js|mjs|json|md|env|yml|yaml)$/.test(entry)) {
      const text = readFileSync(full, "utf8");
      for (const match of text.matchAll(/mongodb\+srv:\/\/([^/\s:]+):([^@\s/]+)@/g)) {
        if (!placeholderPasswords.has(match[2])) hits.push(`mongodb+srv credentials: ${full}`);
      }
      for (const pattern of patterns) {
        if (pattern.re.test(text)) hits.push(`${pattern.name}: ${full}`);
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
