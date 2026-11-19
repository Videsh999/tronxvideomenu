import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowPath = "docs/pro-max/TRONX_PRO_MAX_ADVISORY_ALLOWLIST.md";
const allowText = readFileSync(allowPath, "utf8");
const allowed = new Set([...allowText.matchAll(/^## `(GHSA-[0-9a-z-]+)`/gim)].map((match) => match[1].toUpperCase()));

const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
const audit = JSON.parse(result.stdout || "{}");
const vulnerabilities = audit.vulnerabilities ?? {};

function ghsaIds(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const info = vulnerabilities[name];
  if (!info) return [];
  const ids = [];
  for (const via of info.via ?? []) {
    if (typeof via === "string") ids.push(...ghsaIds(via, seen));
    else if (via && typeof via.url === "string") {
      const match = via.url.match(/GHSA-[0-9a-z-]+/i);
      if (match) ids.push(match[0].toUpperCase());
    }
  }
  return ids;
}

const blocked = [];
for (const [name, info] of Object.entries(vulnerabilities)) {
  if (info.severity !== "high" && info.severity !== "critical") continue;
  const ids = [...new Set(ghsaIds(name))];
  const unlisted = ids.filter((id) => !allowed.has(id));
  if (ids.length === 0 || unlisted.length) {
    blocked.push(`${info.severity} ${name} ${unlisted.join(", ") || "(no GHSA id)"}`);
  }
}
if (blocked.length) {
  console.error("Advisory policy failed:");
  console.error(blocked.join("\n"));
  process.exit(1);
}
console.log("Advisory policy passed.");
