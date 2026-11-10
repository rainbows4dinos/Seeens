import { test } from "node:test";
import assert from "node:assert/strict";
import { byTypeThenName } from "./order.ts";

const sort = byTypeThenName(["band", "venue", "label"], ["musician", "booker"]);

const g = (name: string, group_type: "band" | "venue" | "label", catalog_no = 1, is_us = false) => ({
  name,
  kind: "group" as const,
  group_type,
  person_roles: [],
  is_us,
  catalog_no,
});
const p = (name: string, role: "musician" | "booker", catalog_no = 1) => ({
  name,
  kind: "person" as const,
  group_type: null,
  person_roles: [role],
  is_us: false,
  catalog_no,
});

test("export is grouped by type, then A to Z", () => {
  const rows = [
    p("Adrian", "musician"),
    g("Alleyway", "venue"),
    g("Aan", "band"),
    p("Zed", "booker"),
    g("Merwulf", "band", 1, true),
    g("Grey Static", "label"),
    g("1876", "band"),
    g("aggro", "band"),
  ];
  assert.deepEqual(
    rows.sort(sort).map((r) => r.name),
    ["Merwulf", "1876", "Aan", "aggro", "Alleyway", "Grey Static", "Adrian", "Zed"],
  );
});

test("same name, same type: catalog number breaks the tie", () => {
  const rows = [g("Twin", "band", 9), g("Twin", "band", 2)];
  assert.deepEqual(
    rows.sort(sort).map((r) => r.catalog_no),
    [2, 9],
  );
});
