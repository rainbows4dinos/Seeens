import { test } from "node:test";
import assert from "node:assert/strict";
import { isUuid, UUID_SOURCE } from "./ids.ts";

test("isUuid takes UUIDs in either case", () => {
  assert.equal(isUuid("3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c"), true);
  assert.equal(isUuid("3F2B8C1E-9A4D-4E7B-8C2A-1D5E6F7A8B9C"), true);
});

test("isUuid turns down anything else", () => {
  for (const v of [
    "",
    "new",
    "3f2b8c1e9a4d4e7b8c2a1d5e6f7a8b9c",
    // Right length, dashes in the wrong places (the old loose check let these through).
    "------------------------------------",
    "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c-",
    " 3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isUuid(v), false, String(v));
  }
});

test("UUID_SOURCE builds longer patterns", () => {
  const path = new RegExp(`^${UUID_SOURCE}/${UUID_SOURCE}\\.webp$`);
  assert.equal(path.test("3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.webp"), true);
  assert.equal(path.test("../3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c.webp"), false);
});
