import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "origin/pro-max/release";
const required = ["## Deploy", "## Rollback", "## Reconciliation", "## Index check"];

const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
if (diff.status !== 0) {
  console.error(diff.stderr || "Unable to diff against the release branch. A missing merge base is a failure.");
  process.exit(1);
}

const files = diff.stdout.split("\n").filter(Boolean);
const schemaChanged = files.some((file) => file === "lib/db/models.ts" || file.endsWith("/models.ts"));
if (!schemaChanged) {
  console.log("Migration declaration passed. No schema change.");
  process.exit(0);
}

const notes = files.filter((file) => file.endsWith(".md") && /migration/i.test(file));
if (notes.length === 0) {
  console.error("A schema file changed without a migration note in the same diff.");
  process.exit(1);
}

for (const note of notes) {
  const text = readFileSync(note, "utf8");
  for (const heading of required) {
    if (!text.includes(heading)) {
      console.error(`${note} is missing ${heading}`);
      process.exit(1);
    }
  }
}

console.log("Migration declaration passed.");
