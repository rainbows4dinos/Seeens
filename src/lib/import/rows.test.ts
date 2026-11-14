// Spreadsheet import (#148). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRows,
  cleanName,
  guessMapping,
  matchKey,
  readAges,
  readCapacity,
  readType,
  guessVenueTypes,
  matchRows,
  readCatalogNo,
  readMembers,
} from "./rows.ts";

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

test("venue types are guessed from the sheet's words (#262)", () => {
  assert.deepEqual(guessVenueTypes("Basement"), ["underground"]);
  assert.deepEqual(guessVenueTypes("Dive bar / art gallery"), ["dive_bar", "art_space"]);
  assert.deepEqual(guessVenueTypes("Brewery"), ["brewery"]);
  assert.deepEqual(guessVenueTypes("Old theater"), ["concert_hall"]);
  assert.deepEqual(guessVenueTypes("Concert hall"), ["concert_hall"]);
  assert.deepEqual(guessVenueTypes("Amphitheatre"), ["amphitheater"]);
  // A plain bar is the band's call.
  assert.deepEqual(guessVenueTypes("bar"), []);
  assert.deepEqual(guessVenueTypes("licensed"), []);
});

test("catalog numbers from an export fill in exactly that record (#321)", () => {
  assert.equal(readCatalogNo("BND-0042"), 42);
  assert.equal(readCatalogNo("bnd 42"), 42);
  assert.equal(readCatalogNo("42"), 42);
  assert.equal(readCatalogNo("BND-0000"), null);
  assert.equal(readCatalogNo("Teeth For Eyes"), null);
  assert.deepEqual(guessMapping(["catalog_no", "name", "Members"], "bands"), ["catalog_no", "name", "members"]);

  const headers = ["catalog_no", "Name", "Members"];
  const { rows, skipped } = buildRows(
    headers,
    [
      ["BND-0042", "Soda", "Riley Example, Chris?, Sam"],
      ["BND-0057", "Soda", ""],
      ["BND-0042", "Soda again", ""],
      ["", "New Band", ""],
    ],
    ["catalog_no", "name", "members"],
    "bands",
    { status: "neutral" },
  );
  // Two bands can share a name; two rows can't share a record.
  assert.deepEqual(
    rows.map((r) => [r.name, r.catalog_no]),
    [
      ["Soda", 42],
      ["Soda", 57],
      ["New Band", null],
    ],
  );
  assert.deepEqual(skipped, [{ line: 4, reason: "Soda again: same catalog number as line 2" }]);
  assert.deepEqual(
    rows[0].members.map((m) => m.name),
    ["Riley Example", "Sam"],
  );
  assert.match(rows[0].notes ?? "", /Not sure: member Chris\?/);

  const existing = [
    { id: "a", name: "Soda", kind: "group" as const, group_type: "band", catalog_no: 42 },
    { id: "b", name: "New Band", kind: "group" as const, group_type: "band", catalog_no: 99 },
  ];
  const { matches, strays } = matchRows(rows, existing);
  assert.equal(matches.get(2)?.id, "a");
  assert.equal(matches.get(5)?.id, "b", "no catalog number: matched by name");
  // 57 is someone else's record: skipped, not added again by name.
  assert.equal(matches.has(3), false);
  assert.deepEqual(strays, [{ line: 3, reason: "Soda: catalog number 57 isn't in your band's directory" }]);
});

test("members only mean something on a band", () => {
  const { rows } = buildRows(["Name", "Members"], [["Dantes", "Joel"]], ["name", "members"], "venues", {
    status: "neutral",
  });
  assert.deepEqual(rows[0].members, []);
  assert.equal(rows[0].notes, "Members: Joel");
});

test("a Members cell reads like a pasted lineup", () => {
  const m = (name: string, roles = "", former = false) => ({ name, roles, former });
  assert.deepEqual(readMembers("Riley Example, Sam Example & Jo Example"), [
    m("Riley Example"),
    m("Sam Example"),
    m("Jo Example"),
  ]);
  assert.deepEqual(readMembers("John Example - Drums; Stan Sample - Guitar; Kay Test (vox/guitar)"), [
    m("John Example", "Drums"),
    m("Stan Sample", "Guitar"),
    m("Kay Test", "Vocals, Guitar"),
  ]);
  // Commas inside brackets don't split; "or" splits roles.
  assert.deepEqual(readMembers("Lee Example (bass, vocals), Creep 1 (guitar or bass)"), [
    m("Lee Example", "Bass, Vocals"),
    m("Creep 1", "Guitar, Bass"),
  ]);
  // One member with roles after a colon; stage names stay as given.
  assert.deepEqual(readMembers("Jo Example: vox, keys"), [m("Jo Example", "Vocals, Keyboards")]);
  assert.deepEqual(readMembers("Brent (Burnt Example) - Bass/Vocals\nDee Example (drums) (former)"), [
    m("Brent (Burnt Example)", "Bass, Vocals"),
    m("Dee Example", "Drums", true),
  ]);
  assert.deepEqual(readMembers("Sam; sam"), [m("Sam")]);
});

test("a Photo column keeps a link to add later", () => {
  const { rows } = buildRows(
    ["Name", "photo"],
    [
      ["Soda", "https://soda.example/band.jpg"],
      ["Aggro", "not a link"],
    ],
    guessMapping(["Name", "photo"], "bands"),
    "bands",
    { status: "neutral" },
  );
  assert.equal(rows[0].photo_url, "https://soda.example/band.jpg");
  assert.equal(rows[1].photo_url, null);
  assert.equal(rows[1].notes, "photo: not a link");
});
