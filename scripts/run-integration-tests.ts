/**
 * Starts a one-node MongoDB replica set in memory and runs the integration suite.
 * Exits non-zero if the replica set cannot start. Does not read or override a remote URI
 * into the test process: the child always receives the memory-server URI.
 */
import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  let exitCode = 1;
  try {
    const uri = replSet.getUri("tronx_integration");
    const child = spawn("tsx", ["--test", "tests/integration/*.test.ts"], {
      stdio: "inherit",
      env: {
        ...process.env,
        RUN_INTEGRATION: "1",
        MONGODB_URI: uri,
      },
    });
    exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    await replSet.stop();
  }

  process.exit(exitCode);
}

void main();
