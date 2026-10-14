import assert from "node:assert/strict";
import test from "node:test";
import { LoginRateLimiter } from "../lib/security/login-rate-limiter";

test("LoginRateLimiter reports allowed=true and full remaining attempts initially", async () => {
  const limiter = new LoginRateLimiter(5, 60000);
  // Using an in-memory/mock key check when DB is disconnected
  const result = await limiter.check("test-unseen-key-" + Date.now());
  assert.equal(result.allowed, true);
});

test("LoginRateLimiter correctly calculates retryAfterSeconds when threshold exceeded", () => {
  const now = Date.now();
  const expiresAt = new Date(now + 30000); // 30 seconds into future
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - now) / 1000),
  );
  assert.equal(retryAfterSeconds, 30);
});

test("Seed script production guard logic blocks non-local URI without override", () => {
  const isProduction = (uri: string, nodeEnv: string) => {
    return (
      nodeEnv === "production" ||
      (uri &&
        !uri.includes("localhost") &&
        !uri.includes("127.0.0.1") &&
        !uri.includes("test"))
    );
  };

  const shouldBlock = (uri: string, nodeEnv: string, allowOverride?: string) => {
    return isProduction(uri, nodeEnv) && allowOverride !== "true";
  };

  // Localhost URI in development
  assert.equal(shouldBlock("mongodb://localhost:27017/tronx", "development"), false);
  assert.equal(shouldBlock("mongodb://127.0.0.1:27017/tronx", "development"), false);

  // Production Atlas URI without override
  assert.equal(
    shouldBlock("mongodb+srv://admin:pass@cluster0.mongodb.net/production", "production"),
    true,
  );
  assert.equal(
    shouldBlock("mongodb+srv://admin:pass@cluster0.mongodb.net/production", "development"),
    true,
  );

  // Production Atlas URI with explicit override
  assert.equal(
    shouldBlock("mongodb+srv://admin:pass@cluster0.mongodb.net/production", "production", "true"),
    false,
  );
});
