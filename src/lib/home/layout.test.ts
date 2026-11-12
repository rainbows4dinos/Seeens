import { test } from "node:test";
import assert from "node:assert/strict";
import { isDefault, resolveLayout } from "./layout.ts";

test("nothing saved is the default order", () => {
  const l = resolveLayout(null, "band");
  assert.deepEqual(l.shown, ["up_next", "homies", "lets_play", "new_near_you", "might_know", "prospect"]);
  assert.deepEqual(l.hidden, []);
  assert.ok(isDefault(l, "band"));
});

test("labels get the roster", () => {
  assert.equal(resolveLayout(null, "label").shown[1], "roster");
});

test("a saved order is kept, and new rows go at the end", () => {
  const l = resolveLayout({ shown: ["homies", "up_next"], hidden: ["might_know"] }, "band");
  assert.deepEqual(l.shown, ["homies", "up_next", "lets_play", "new_near_you", "prospect"]);
  assert.deepEqual(l.hidden, ["might_know"]);
  assert.ok(!isDefault(l, "band"));
});

test("unknown, duplicate, and label-only keys are dropped for a band", () => {
  const l = resolveLayout({ shown: ["nope", "homies", "homies", "roster"], hidden: ["homies"] }, "band");
  assert.equal(l.shown.filter((k) => k === "homies").length, 1);
  assert.ok(!l.shown.includes("roster" as never));
  assert.deepEqual(l.hidden, []);
});
