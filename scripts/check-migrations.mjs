import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "origin/pro-max/release";
const doc = "docs/pro-max/TRONX_PRO_MAX_WAVE1_MIGRATION.md";
const required = ["## Deploy", "## Rollback", "## Reconciliation", "## Index check"];
const text = readFileSync(doc, "utf8");
for (const heading of required) {
  if (!text.includes(heading)) {
    console.error(`${doc} is missing ${heading}`);
    process.exit(1);
  }
}

const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
if (diff.status !== 0) {
  console.error(diff.stderr || "Unable to diff against the release branch.");
  process.exit(1);
}
const files = diff.stdout.split("\n").filter(Boolean);
if (files.includes("lib/db/models.ts") && !files.some((file) => file.includes("MIGRATION"))) {
  console.error("lib/db/models.ts changed without a migration note in the same diff.");
  process.exit(1);
}
console.log("Migration declaration passed.");
