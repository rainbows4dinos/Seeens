// Possible duplicates. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups, pairKey, pairsOf } from "./duplicates.ts";

const band = (id: string, name: string) => ({ id, name, kind: "group", group_type: "band" });

test("matches names the way the import does, within one type", () => {
  const rows = [
    band("a", "GAB"),
    band("b", "Gab"),
    band("c", "G.A.B."),
    band("d", "The Night Gleaners"),
    band("e", "Night Gleaners"),
    { id: "f", name: "Gab", kind: "group", group_type: "venue" },
    band("g", "Someone Else"),
  ];
  const groups = duplicateGroups(rows, []).map((g) => g.map((r) => r.id));
  assert.deepEqual(groups, [["a", "b", "c"], ["d", "e"]]);
});

test("a pair marked not the same drops out", () => {
  const groups = duplicateGroups([band("a", "GAB"), band("b", "Gab")], [pairKey("b", "a")]);
  assert.deepEqual(groups, []);
});

test("one taken out of a group of three leaves the other two", () => {
  const rows = [band("a", "GAB"), band("b", "Gab"), band("c", "G.A.B.")];
  const groups = duplicateGroups(rows, [pairKey("c", "a"), pairKey("c", "b")]).map((g) => g.map((r) => r.id));
  assert.deepEqual(groups, [["a", "b"]]);
});

test("one still possibly the same as someone stays", () => {
  const rows = [band("a", "GAB"), band("b", "Gab"), band("c", "G.A.B.")];
  const groups = duplicateGroups(rows, [pairKey("a", "c")]).map((g) => g.map((r) => r.id));
  assert.deepEqual(groups, [["a", "b", "c"]]);
});

test("pairsOf lists each pair once, in stored order", () => {
  assert.deepEqual(pairsOf(["c", "a", "b", "a"]), [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
  ]);
});
