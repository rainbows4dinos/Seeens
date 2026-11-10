// Round-trip test for the CSV export (fictional data only).
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { EXPORT_COLUMNS, asText, toCsv, type ExportRow } from "./csv.ts";
import { unwrapCell } from "../import/rows.ts";

const blank = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, ""])) as ExportRow;

const tricky: ExportRow[] = [
  {
    ...blank,
    name: 'The "Quoted", Band',
    types: "Musician; DJ",
    scenes: "Portland DIY; Pacific Northwest",
    notes: 'Line one\nLine two, with a comma\r\nand "quotes"',
    links: "Bandcamp: https://example.com/a?b=1,2; https://example.com/c",
  },
  { ...blank, name: "Café Ñoño 🎸 Ünïcode", town: "Zürich", notes: "日本語のメモ" },
  // Formula-looking values get a leading apostrophe.
  { ...blank, name: '=HYPERLINK("http://example.com","x")', notes: "+1 555 0100", phone: "-5", email: "@handle" },
  { ...blank, name: "\tTabbed", notes: "\rCarriage", can_help_with: "=SUM(A1)\nsecond line" },
  // Not formulas: these must come back exactly.
  { ...blank, name: "A-Side", notes: "email@example.com", next_action_date: "2026-11-03" },
  // Spreadsheets would read these as numbers or money, so they go out as text.
  { ...blank, catalog_no: "BND-0057", name: "1876", phone: "555-0100", notes: "1876" },
  { ...blank, catalog_no: "MUS-0001", name: '-5"', phone: "+1 (503) 555-0100" },
];

const FORMULA = /^[=+\-@\t\r]/;

test("headers are stable and in order", () => {
  const csv = toCsv([blank]);
  assert.equal(csv.split("\r\n")[0], EXPORT_COLUMNS.join(","));
});

test("every value round-trips through a standard CSV reader", () => {
  const parsed = Papa.parse<string[]>(toCsv(tricky), { header: false });
  assert.deepEqual(parsed.errors, []);
  const [header, ...rows] = parsed.data;
  assert.deepEqual(header, [...EXPORT_COLUMNS]);
  assert.equal(rows.length, tricky.length);
  tricky.forEach((original, i) => {
    EXPORT_COLUMNS.forEach((col, j) => {
      const value = original[col];
      const text = value && (col === "catalog_no" || ((col === "name" || col === "phone") && !/\p{L}/u.test(value)));
      const expected = text ? asText(value) : FORMULA.test(value) ? `'${value}` : value;
      assert.equal(rows[i][j], expected, `row ${i} column ${col}`);
    });
  });
});

test("formula-prefixed cells are guarded", () => {
  const parsed = Papa.parse<string[]>(toCsv(tricky.slice(2, 4)));
  // ="..." string literals are the text guard, checked below.
  const cells = parsed.data
    .slice(1)
    .flat()
    .filter((c) => c && !/^="(?:[^"]|"")*"$/.test(c));
  for (const cell of cells) assert.ok(!FORMULA.test(cell), `unguarded: ${JSON.stringify(cell)}`);
});

test("text-wrapped cells are plain string formulas", () => {
  const parsed = Papa.parse<string[]>(toCsv(tricky));
  const wrapped = parsed.data.flat().filter((c) => c.startsWith("="));
  assert.ok(wrapped.length >= 5);
  // One string literal, quotes doubled inside, nothing that could run.
  for (const c of wrapped) assert.match(c, /^="(?:[^"]|"")*"$/);
});

test("the import wizard reads an export back to the original values", () => {
  const parsed = Papa.parse<string[]>(toCsv(tricky));
  const [, ...rows] = parsed.data;
  tricky.forEach((original, i) => {
    EXPORT_COLUMNS.forEach((col, j) => assert.equal(unwrapCell(rows[i][j]), original[col], `row ${i} column ${col}`));
  });
});
