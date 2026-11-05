import assert from "node:assert/strict";
import test from "node:test";
import { isImmersiveOpsPath } from "../lib/admin-layout";

test("immersive ops paths cover POS and kitchen only", () => {
  assert.equal(isImmersiveOpsPath("/admin/lilles/pos"), true);
  assert.equal(isImmersiveOpsPath("/admin/lilles/kitchen"), true);
  assert.equal(isImmersiveOpsPath("/admin/lilles/kitchen/station"), true);
  assert.equal(isImmersiveOpsPath("/admin/lilles/menu/dishes"), false);
  assert.equal(isImmersiveOpsPath("/admin/lilles"), false);
  assert.equal(isImmersiveOpsPath("/admin/login"), false);
});
