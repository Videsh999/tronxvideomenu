/**
 * Starts a one-node MongoDB replica set in memory and runs the integration suite.
 * Exits non-zero if the replica set cannot start. Does not read or override a remote URI
 * into the test process: the child always receives the memory-server URI.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { assertNoSkippedTests } from "./integration-tap";

async function main() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  let exitCode = 1;
  try {
    const uri = replSet.getUri("tronx_integration");
    const preload = path.join(process.cwd(), "scripts/register-node-async-local-storage.cjs");
    const child = spawn("tsx", ["--test", "tests/integration/*.test.ts"], {
      env: {
        ...process.env,
        RUN_INTEGRATION: "1",
        MONGODB_URI: uri,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${preload}`.trim(),
      },
    });
    let tap = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      tap += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      tap += chunk.toString();
    });
    exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
    const skipped = assertNoSkippedTests(tap);
    if (skipped) {
      console.error(skipped);
      exitCode = 1;
    }
  } finally {
    await replSet.stop();
  }

  process.exit(exitCode);
}

void main();
