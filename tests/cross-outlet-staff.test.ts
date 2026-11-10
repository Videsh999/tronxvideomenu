import assert from "node:assert/strict";
import test from "node:test";
import { sessionOwnsOutlet } from "../lib/security/outlet-scope";

test("a staff session does not own another outlet's order, dish, or customer", () => {
  assert.equal(sessionOwnsOutlet("rest-a", "rest-a"), true);
  assert.equal(sessionOwnsOutlet("rest-a", "rest-b"), false);
  assert.equal(sessionOwnsOutlet("rest-a", null), false);
  assert.equal(sessionOwnsOutlet(undefined, "rest-a"), false);
});
