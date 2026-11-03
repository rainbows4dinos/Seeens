// Directory card helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogNo, initials, readLayout, seed } from "./card.ts";

const ids = [
  "c0000000-0000-0000-0000-000000000001",
  "3f2a91c4-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "00000000-0000-0000-0000-000000000000",
];

test("seed is in [0, 1)", () => {
  for (const id of ids) assert.ok(seed(id) >= 0 && seed(id) < 1);
});

test("catalog number: prefix from type or first role, number padded to four", () => {
  const group = (group_type: string | null, catalog_no = 42) =>
    catalogNo({ kind: "group", group_type: group_type as never, person_roles: [], catalog_no });
  const person = (roles: string[], catalog_no = 12) =>
    catalogNo({ kind: "person", group_type: null, person_roles: roles as never, catalog_no });
  assert.equal(group("band"), "BND-0042");
  assert.equal(group("venue", 7), "VEN-0007");
  assert.equal(group("recording_studio"), "STU-0042");
  assert.equal(group("production_studio"), "STU-0042");
  assert.equal(group("promoter_collective"), "PRO-0042");
  assert.equal(group(null), "ORG-0042");
  assert.equal(person(["musician", "dj"]), "MUS-0012");
  assert.equal(person(["dj", "musician"]), "DJ-0012");
  assert.equal(person(["promoter"]), "PMT-0012");
  assert.equal(person([]), "PPL-0012");
  assert.equal(person(["other"]), "PPL-0012");
  assert.equal(group("band", 12345), "BND-12345");
});

test("initials", () => {
  assert.equal(initials("The Tin Hollows"), "TH");
  assert.equal(initials("Merwulf"), "M");
  assert.equal(initials("Grown Ass Bitch (G.A.B.)"), "GB");
  assert.equal(initials("Merwulf (sample)"), "M");
  assert.equal(initials("Jo Example"), "JE");
  assert.equal(initials("Static-Basement"), "SB");
  assert.equal(initials("Zoë Ümlaut"), "ZÜ");
  assert.equal(initials("!!!"), "?");
});

test("layout from the URL or cookie", () => {
  assert.equal(readLayout("cards"), "cards");
  assert.equal(readLayout(["list", "cards"]), "list");
  assert.equal(readLayout("grid"), null);
  assert.equal(readLayout(undefined), null);
});
