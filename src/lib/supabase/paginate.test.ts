// Paging past Supabase's 1,000-row limit. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE, fetchAll } from "./paginate.ts";

// A fake table of `total` rows that, like PostgREST, returns at most
// PAGE_SIZE rows for any range.
function table(total: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, total, from + PAGE_SIZE);
    const data = Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i);
    return { data, error: null };
  };
  return { page, calls };
}

test("returns every row past the 1,000-row limit", async () => {
  const t = table(2_345);
  const rows = await fetchAll(t.page);
  assert.equal(rows.length, 2_345);
  assert.deepEqual(rows.slice(0, 3), [0, 1, 2]);
  assert.equal(rows.at(-1), 2_344);
  assert.equal(new Set(rows).size, rows.length, "no row twice");
  assert.deepEqual(t.calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("a small list takes one request", async () => {
  const t = table(12);
  assert.equal((await fetchAll(t.page)).length, 12);
  assert.equal(t.calls.length, 1);
});

test("exactly one full page checks once more, then stops", async () => {
  const t = table(PAGE_SIZE);
  assert.equal((await fetchAll(t.page)).length, PAGE_SIZE);
  assert.equal(t.calls.length, 2);
});

test("an empty table returns an empty list", async () => {
  assert.deepEqual(await fetchAll(table(0).page), []);
});

test("an error on any page fails the whole fetch", async () => {
  let n = 0;
  const failing = async () => {
    n += 1;
    return n === 2
      ? { data: null, error: new Error("boom") }
      : { data: Array.from({ length: PAGE_SIZE }, () => 0), error: null };
  };
  await assert.rejects(fetchAll(failing), /boom/);
});
