import assert from "node:assert/strict";
import test from "node:test";
import { assertNoSkippedTests } from "../scripts/integration-tap";

test("an integration report that skipped a test is a failure", () => {
  const skipped = "# tests 2\n# pass 1\n# fail 0\n# skipped 1\n";
  assert.match(assertNoSkippedTests(skipped) ?? "", /skipped 1/);
  const clean = "# tests 2\n# pass 2\n# fail 0\n# skipped 0\n";
  assert.equal(assertNoSkippedTests(clean), null);
});
