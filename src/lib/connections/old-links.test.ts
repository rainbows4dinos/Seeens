// Old Network links (#273). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { oldNetworkLink } from "./old-links.ts";

test("a plain old Network filter opens the Directory on Ours", () => {
  assert.equal(oldNetworkLink({ type: "venues", scene: "s1" }), "/directory?type=venues&scene=s1&status=ours");
});

test("a status already picks it; ?scope=all meant Everyone", () => {
  assert.equal(oldNetworkLink({ status: "homies" }), "/directory?status=homies");
  assert.equal(oldNetworkLink({ scope: "all", q: "moth" }), "/directory?q=moth");
});

test("archived stays archived (always ours)", () => {
  assert.equal(oldNetworkLink({ archived: "1" }), "/directory?archived=1");
});

test("repeated values carry over", () => {
  assert.equal(oldNetworkLink({ status: ["homies", "avoid"] }), "/directory?status=homies&status=avoid");
});
