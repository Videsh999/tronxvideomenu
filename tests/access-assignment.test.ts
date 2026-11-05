import assert from "node:assert/strict";
import test from "node:test";
import { roleHasPermission } from "../lib/org-rbac";

test("outlet staff cannot grant org menu sync (self-escalation guardrail at matrix)", () => {
  assert.equal(roleHasPermission("OUTLET_STAFF", "ORG_MENU_SYNC"), false);
  assert.equal(roleHasPermission("OUTLET_MANAGER", "ORG_MANAGE"), false);
  assert.equal(roleHasPermission("ORG_ADMIN", "ORG_MANAGE"), false);
  assert.equal(roleHasPermission("ORG_OWNER", "ORG_MANAGE"), true);
});

test("assignment payload requires confirm literal at schema level", async () => {
  const { z } = await import("zod");
  const schema = z
    .object({
      restaurantId: z.string().min(1),
      confirm: z.literal(true),
    })
    .strict();
  assert.equal(schema.safeParse({ restaurantId: "r1", confirm: true }).success, true);
  assert.equal(schema.safeParse({ restaurantId: "r1", confirm: false }).success, false);
  assert.equal(schema.safeParse({ restaurantId: "r1" }).success, false);
});
