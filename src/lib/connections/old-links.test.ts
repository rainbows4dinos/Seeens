// Old Network links (#273). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { oldNetworkLink } from "./old-links.ts";

test("an old Network filter opens the Directory with the same filters", () => {
  assert.equal(oldNetworkLink({ type: "venues", scene: "s1" }), "/directory?type=venues&scene=s1");
  assert.equal(oldNetworkLink({ status: "homies" }), "/directory?status=homies");
});

test("?scope= and ?preview= are dropped", () => {
  assert.equal(oldNetworkLink({ scope: "all", q: "moth" }), "/directory?q=moth");
  assert.equal(oldNetworkLink({ archived: "1", preview: "x" }), "/directory?archived=1");
});

test("repeated values carry over", () => {
  assert.equal(oldNetworkLink({ status: ["homies", "avoid"] }), "/directory?status=homies&status=avoid");
});
