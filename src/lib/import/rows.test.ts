// Spreadsheet import (#148). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRows, cleanName, guessMapping, matchKey, readAges, readCapacity, readType } from "./rows.ts";

test("names: flipped articles, spelling doubts, spaces", () => {
  assert.equal(cleanName("Barf Bags, The"), "The Barf Bags");
  assert.equal(cleanName("  Grey   Static (sp?) "), "Grey Static");
  assert.equal(matchKey("The Barf Bags"), matchKey("barf bags"));
  assert.equal(matchKey("Rock & Roll"), matchKey("rock and roll"));
});

test("headers guess their columns, venue ones only on venue sheets", () => {
  const venueHeaders = ["Venue", "All Ages?", "Booking Email", "Booker", "Capacity", "", "Notes"];
  assert.deepEqual(guessMapping(venueHeaders, "venues"), [
    "name",
    "ages",
    "booking",
    "booked_by",
    "capacity",
    "notes",
    "notes",
  ]);
  assert.deepEqual(guessMapping(["Band", "Instagram", "Capacity"], "bands"), ["name", "instagram", "notes"]);
  assert.deepEqual(guessMapping(["Who", "Where", "Where else"], "people"), ["name", "town", "notes"]);
  assert.deepEqual(
    guessMapping(["Foo", "Bar"], "bands"),
    ["name", "notes"],
    "first column is the name when nothing says so",
  );
});

test("values: ages, capacity, types", () => {
  assert.deepEqual(["yes", "no", "sometimes", "21+", "All Ages", "18+"].map(readAges), [
    "all_ages",
    "21_plus",
    "varies",
    "21_plus",
    "all_ages",
    undefined,
  ]);
  assert.deepEqual(["40", "~150", "100-200", "1,200", "small"].map(readCapacity), [
    "under_50",
    "50_150",
    "150_300",
    "600_plus",
    undefined,
  ]);
  assert.equal(readType("Venue")?.group_type, "venue");
  assert.deepEqual(readType("Booker")?.person_roles, ["booker"]);
  assert.equal(readType("Honey Latte Presents")?.group_type, "promoter_collective");
  assert.equal(readType("whatever"), null);
});

test("a venue sheet like Tiffany's", () => {
  const headers = ["Venue", "All Ages?", "Booking Email", "Booker", "Capacity", "", "Notes"];
  const data = [
    ["Fixin' To", "no", "booking@fixinto.example", "Joel / Honey Latte Presents", "150", "", "Great sound"],
    ["Mano Occulta", "sometimes", "Instagram", "Ian", "", "Pay to play $400", ""],
    ["Dantes", "yes", "Facebook?", "Chris?", "300ish", "", ""],
    ["", "yes", "", "", "", "", "orphan"],
    ["dantes", "no", "", "", "", "", "dupe"],
  ];
  const mapping = guessMapping(headers, "venues");
  mapping[5] = "special_terms";
  const { rows, skipped } = buildRows(headers, data, mapping, "venues", { status: "neutral" });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    skipped.map((s) => s.line),
    [5, 6],
  );
  const [fixin, mano, dantes] = rows;
  assert.equal(fixin.group_type, "venue");
  assert.deepEqual(fixin.venue, { ages: "21_plus", book_via: "email", capacity: "50_150" });
  assert.equal(fixin.email, "booking@fixinto.example");
  assert.deepEqual(fixin.booked_by, ["Joel", "Honey Latte Presents"]);
  assert.equal(fixin.notes, "Great sound");
  assert.deepEqual(mano.venue, { ages: "varies", book_via: "instagram", special_terms: "Pay to play $400" });
  assert.deepEqual(dantes.venue, { ages: "all_ages", capacity: "150_300" });
  assert.deepEqual(dantes.booked_by, []);
  assert.equal(dantes.notes, "Not sure: booking email: Facebook?; booked by Chris?");
});

test("a band name list", () => {
  const { rows } = buildRows(["Band"], [["Barf Bags, The"], ["Shitfits (sp?)"]], ["name"], "bands", {
    status: "neutral",
  });
  assert.deepEqual(
    rows.map((r) => [r.name, r.group_type, r.notes]),
    [
      ["The Barf Bags", "band", null],
      ["Shitfits", "band", 'Not sure: the spelling of "Shitfits"'],
    ],
  );
});

test("a mixed sheet needs a type per row; venue details elsewhere become notes", () => {
  const headers = ["Name", "Type", "Capacity", "IG"];
  const data = [
    ["Sam", "booker", "", "@sambooks"],
    ["The Room", "venue", "80", ""],
    ["Mystery", "", "", ""],
    ["Hollow Band", "band", "200", ""],
  ];
  const { rows, skipped } = buildRows(headers, data, guessMapping(headers, "mixed"), "mixed", { status: "prospect" });
  assert.deepEqual(
    rows.map((r) => [r.name, r.kind, r.group_type]),
    [
      ["Sam", "person", null],
      ["The Room", "group", "venue"],
      ["Hollow Band", "group", "band"],
    ],
  );
  assert.deepEqual(rows[0].links, [{ label: "Instagram", url: "https://instagram.com/sambooks" }]);
  assert.equal(rows[0].status, "prospect");
  assert.deepEqual(rows[1].venue, { capacity: "50_150" });
  assert.equal(rows[2].notes, "capacity: 150_300");
  assert.match(skipped[0].reason, /Type column/);
});
