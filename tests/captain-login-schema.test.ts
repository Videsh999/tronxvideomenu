import assert from "node:assert/strict";
import test from "node:test";
import { captainLoginSchema } from "../lib/validations/index";

test("captain login accepts only email and password", () => {
  const result = captainLoginSchema.safeParse({ email: "captain@example.test", password: "secret" });
  assert.equal(result.success, true);
});

test("captain login still accepts an optional restaurant link hint", () => {
  const result = captainLoginSchema.safeParse({ email: "captain@example.test", password: "secret", restaurantSlug: "triparna-kitchen" });
  assert.equal(result.success, true);
});
