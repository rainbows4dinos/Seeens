// Possible duplicates. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups, nameKeys, namesMatch, pairKey, pairsOf } from "./duplicates.ts";

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
  assert.deepEqual(groups, [
    ["a", "b", "c"],
    ["d", "e"],
  ]);
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

test("a name in parentheses matches on its own", () => {
  const rows = [band("a", "GAB"), band("b", "Grown Ass Bitch (G.A.B.)"), band("c", "Grown Ass Bitch")];
  const groups = duplicateGroups(rows, []).map((g) => g.map((r) => r.id));
  assert.deepEqual(groups, [["a", "b", "c"]]);
});

test("initials match only a name written as initials", () => {
  assert.deepEqual(
    duplicateGroups([band("a", "Grown Ass Bitch"), band("b", "G.A.B.")], []).map((g) => g.map((r) => r.id)),
    [["a", "b"]],
  );
  // "Gab" isn't written as initials, so it doesn't meet "Grown Ass Bitch".
  assert.deepEqual(duplicateGroups([band("a", "Grown Ass Bitch"), band("b", "Gab")], []), []);
  assert.ok(!nameKeys("Night Gleaners").includes("ng"));
});

test("an unset group type can match any group, but a band isn't a venue", () => {
  const rows = [
    band("a", "Merwulf"),
    { id: "b", name: "Merwulf", kind: "group", group_type: null },
    { id: "c", name: "The Lantern Room", kind: "group", group_type: "venue" },
    band("d", "Lantern Room"),
  ];
  assert.deepEqual(
    duplicateGroups(rows, []).map((g) => g.map((r) => r.id)),
    [["a", "b"]],
  );
});

test("spelled-out names don't meet on initials alone", () => {
  const rows = [
    band("a", "Backseat Plastic"),
    band("b", "The Birthday Party"),
    band("c", "Bad Channels"),
    band("d", "Brassless Chaps"),
    band("e", "Big Bad Wolf"),
    band("f", "Black Bear Wake"),
  ];
  assert.deepEqual(duplicateGroups(rows, []), []);
});

test("two-letter initials don't match", () => {
  assert.deepEqual(duplicateGroups([band("a", "Night Gleaners"), band("b", "NG")], []), []);
});

test("namesMatch follows the same rules", () => {
  assert.ok(namesMatch("GAB", "Grown Ass Bitch (G.A.B.)"));
  assert.ok(namesMatch("Grown Ass Bitch", "G.A.B."));
  assert.ok(!namesMatch("Backseat Plastic", "The Birthday Party"));
  assert.ok(!namesMatch("Grown Ass Bitch", "Gab"));
});
