// Directory card helpers. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { initials, readLayout, recordId, seed, tiltFor } from "./card.ts";

const ids = [
  "c0000000-0000-0000-0000-000000000001",
  "3f2a91c4-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "00000000-0000-0000-0000-000000000000",
];

test("tilt is stable, never flat, and at most 1 degree", () => {
  for (const id of ids) {
    const t = tiltFor(id);
    assert.equal(tiltFor(id), t, "same id, same tilt");
    assert.ok(Math.abs(t) >= 0.4 && Math.abs(t) <= 1, `${id}: ${t}`);
  }
  const many = Array.from({ length: 500 }, (_, i) => tiltFor(`id-${i}`));
  assert.ok(many.some((t) => t < 0) && many.some((t) => t > 0), "tilts go both ways");
});

test("seed is in [0, 1)", () => {
  for (const id of ids) assert.ok(seed(id) >= 0 && seed(id) < 1);
});

test("record id is stable, short, and differs for similar ids", () => {
  const a = recordId("c0000000-0000-0000-0000-000000000001");
  assert.match(a, /^CN-[0-9A-F]{4}$/);
  assert.equal(recordId("c0000000-0000-0000-0000-000000000001"), a);
  assert.notEqual(recordId("c0000000-0000-0000-0000-000000000002"), a);
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
