// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { imageSearchUrl } from "./search.ts";

test("image search: quoted name, what it is, and town", () => {
  const q = (u: string) => new URL(u).searchParams.get("q");
  assert.equal(
    q(imageSearchUrl({ name: "Soda", kind: "group", group_type: "band", town: "Portland" })),
    '"Soda" band Portland',
  );
  assert.equal(q(imageSearchUrl({ name: "Dantes", kind: "group", group_type: "venue", town: null })), '"Dantes" venue');
  assert.equal(q(imageSearchUrl({ name: 'Jo "JJ" Example', kind: "person", group_type: null })), '"Jo JJ Example"');
  assert.equal(
    new URL(imageSearchUrl({ name: "x", kind: "person", group_type: null })).searchParams.get("tbm"),
    "isch",
  );
});
