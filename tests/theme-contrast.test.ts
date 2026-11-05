import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastRatio,
  ensureReadableOn,
  getThemeCSSVariables,
  DEFAULT_THEME,
} from "../lib/theme";

test("white text on white surface is rewritten to a dark readable color", () => {
  const vars = getThemeCSSVariables({
    ...DEFAULT_THEME,
    backgroundColor: "#241416",
    textColor: "#ffffff",
    secondaryColor: "#2d1719",
    primaryColor: "#602e31",
  });
  assert.notEqual(vars["--restaurant-text"], "#ffffff");
  assert.ok(contrastRatio(vars["--restaurant-text"]!, "#ffffff") >= 4.5);
  assert.ok(contrastRatio(vars["--restaurant-text-muted"]!, "#ffffff") >= 3);
});

test("dark theme text that already contrasts on white is preserved", () => {
  const vars = getThemeCSSVariables({
    ...DEFAULT_THEME,
    textColor: "#241416",
  });
  assert.equal(vars["--restaurant-text"], "#241416");
});

test("ensureReadableOn falls through candidates until contrast passes", () => {
  assert.equal(ensureReadableOn("#ffffff", "#ffffff", ["#eeeeee", "#111111"]), "#111111");
  assert.equal(ensureReadableOn("#111111", "#ffffff", ["#000000"]), "#111111");
});
