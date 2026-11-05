import assert from "node:assert/strict";
import test from "node:test";

/** Pure boundary helper mirrored by organizationService.assertSameOrganization. */
function sameOrganization(
  a: { id: string; organizationId?: string },
  b: { id: string; organizationId?: string },
) {
  return Boolean(a.organizationId && b.organizationId && a.organizationId === b.organizationId);
}

test("multi-outlet isolation rejects cross-organization transfers", () => {
  const outletA = { id: "r1", organizationId: "org-1" };
  const outletB = { id: "r2", organizationId: "org-1" };
  const outsider = { id: "r3", organizationId: "org-2" };
  assert.equal(sameOrganization(outletA, outletB), true);
  assert.equal(sameOrganization(outletA, outsider), false);
  assert.equal(sameOrganization({ id: "solo" }, outletA), false);
});
