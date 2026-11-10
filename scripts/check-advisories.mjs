import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowPath = "docs/pro-max/TRONX_PRO_MAX_ADVISORY_ALLOWLIST.md";
const allowText = readFileSync(allowPath, "utf8");
const allowed = new Set(
  [...allowText.matchAll(/^## `([^`]+)`/gm)].map((match) => match[1]),
);

const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
const audit = JSON.parse(result.stdout || "{}");
const vulnerabilities = audit.vulnerabilities ?? {};
const blocked = [];
for (const [name, info] of Object.entries(vulnerabilities)) {
  if (info.severity !== "high" && info.severity !== "critical") continue;
  if (allowed.has(name)) continue;
  blocked.push(`${info.severity} ${name}`);
}
if (blocked.length) {
  console.error("Advisory policy failed:");
  console.error(blocked.join("\n"));
  process.exit(1);
}
console.log("Advisory policy passed.");
