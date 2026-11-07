import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeDemoSeed, DEMO_KITCHEN } from "../lib/demo/seed-demo-kitchen";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  CONFIRM: process.env.TRONX_DEMO_SEED_CONFIRM,
  URI: process.env.MONGODB_URI,
  PASSWORD: process.env.TRONX_DEMO_ADMIN_PASSWORD,
};

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restore() {
  setEnv("NODE_ENV", original.NODE_ENV);
  setEnv("TRONX_DEMO_SEED_CONFIRM", original.CONFIRM);
  setEnv("MONGODB_URI", original.URI);
  setEnv("TRONX_DEMO_ADMIN_PASSWORD", original.PASSWORD);
}

test("demo seed refuses without explicit safe config and has no password field", () => {
  assert.equal("adminPassword" in DEMO_KITCHEN, false);
  setEnv("NODE_ENV", "production");
  process.env.TRONX_DEMO_SEED_CONFIRM = "localhost";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/demo";
  process.env.TRONX_DEMO_ADMIN_PASSWORD = "local-only-secret";
  assert.throws(() => assertSafeDemoSeed(), /production/);

  setEnv("NODE_ENV", "test");
  delete process.env.TRONX_DEMO_SEED_CONFIRM;
  assert.throws(() => assertSafeDemoSeed(), /TRONX_DEMO_SEED_CONFIRM/);

  process.env.TRONX_DEMO_SEED_CONFIRM = "localhost";
  process.env.MONGODB_URI = "mongodb+srv://user:secret@cluster.example.net/db";
  assert.throws(() => assertSafeDemoSeed(), /loopback/);

  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/demo";
  process.env.TRONX_DEMO_ADMIN_PASSWORD = "short";
  assert.throws(() => assertSafeDemoSeed(), /TRONX_DEMO_ADMIN_PASSWORD/);

  process.env.TRONX_DEMO_ADMIN_PASSWORD = "local-only-secret";
  assert.equal(assertSafeDemoSeed(), "local-only-secret");
  restore();
});
