import assert from "node:assert/strict";
import test from "node:test";
import { assignCaptainTablesSchema } from "../lib/validations/index";

test("assignment payload accepts large configurable table sets", () => {
  const tableIds = Array.from({ length: 40 }, (_, index) => `table-${index + 1}`);
  const parsed = assignCaptainTablesSchema.safeParse({ tableIds, note: "Shift A" });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.tableIds.length, 40);
});

test("assignment payload rejects oversized lists above safety cap", () => {
  const tableIds = Array.from({ length: 501 }, (_, index) => `table-${index + 1}`);
  const parsed = assignCaptainTablesSchema.safeParse({ tableIds });
  assert.equal(parsed.success, false);
});
