// Discover (#321). Run with: npm test
// Fixture bands, towns, and sites are fictional.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billsOrder,
  discoverPrompt,
  discoverRow,
  asExportBand,
  withDetails,
  readDiscoverAnswer,
  readKnown,
  recentFirst,
  seenRank,
  townKey,
  venueBillsPrompt,
} from "./discover.ts";

const rows = [
  { name: '="Soda Example"', town: "Olympia", types: "Band", scenes: "Oly DIY; Punk" },
  { name: "The Grange Example", town: "Olympia", types: "Venue", scenes: "" },
  { name: "Elsewhere Example", town: "Boise", types: "Band", scenes: "" },
];

test("known: every name to skip, and who's in town to anchor", () => {
  assert.equal(townKey("Olympia, WA"), "olympia");
  const k = readKnown(rows, ["Olympia, WA"]);
  assert.equal(k.names.size, 3);
  assert.deepEqual(
    k.local.map((l) => l.name),
    ["Soda Example", "The Grange Example"],
  );
  const p = discoverPrompt("Olympia, WA", "band", k, { limit: 10 });
  assert.match(p, /independent and DIY bands active in or right around Olympia, WA/);
  assert.match(p, /Scenes we know there: Oly DIY, Punk/);
  assert.match(p, /Already known there .*Soda Example \(Band\); The Grange Example \(Venue\)/);
  assert.match(
    discoverPrompt("Olympia, WA", "label", k, { limit: 10, scene: "hardcore" }),
    /record labels.*\n.*Focus on this scene: hardcore/,
  );
});

test("answers: cited, new, once, and the right kind of links", () => {
  const known = readKnown(rows, ["Olympia, WA"]).names;
  const text = `\`\`\`json
{"found": [
  {"name": "Gutter Example", "town": "Olympia, WA", "source": "https://showlist.example/oly", "why": "Played the Grange", "last_seen": "Show, Aug 2026",
   "instagram": "https://www.instagram.com/gutterexample/", "bandcamp": "https://gutterexample.bandcamp.com/album/x", "website": "https://linktr.ee/gutter"},
  {"name": "Soda Example", "source": "https://showlist.example/oly"},
  {"name": "gutter example", "source": "https://showlist.example/oly"},
  {"name": "Made Up Example", "source": "https://nowhere.example"}
]}
\`\`\``;
  const { found, dropped } = readDiscoverAnswer(text, ["https://showlist.example/oly/"], "band", "Olympia, WA", known);
  assert.deepEqual(found, [
    {
      name: "Gutter Example",
      type: "band",
      town: "Olympia, WA",
      source: "https://showlist.example/oly",
      why: "Played the Grange",
      lastSeen: "Show, Aug 2026",
      instagram: "https://instagram.com/gutterexample",
      bandcamp: "https://gutterexample.bandcamp.com",
      website: "",
    },
  ]);
  assert.deepEqual(dropped, ["Made Up Example: its source wasn't in the search results"]);
  const row = discoverRow(found[0], "2026-11-14");
  assert.equal(row.type, "Band");
  assert.equal(
    row.notes,
    "Discover, 2026-11-14. Source: https://showlist.example/oly (Played the Grange)\nLast seen: Show, Aug 2026",
  );
  assert.deepEqual(readDiscoverAnswer("nope", [], "band", "x", new Set()).dropped, ["the answer wasn't readable"]);
});

test("bands from a venue's bills: local ones only, with their own town", () => {
  const k = readKnown(rows, ["Olympia, WA"]);
  const p = venueBillsPrompt("Olympia, WA", { name: "The Grange Example", website: "https://grange.example" }, k, {
    limit: 20,
  });
  assert.match(p, /^List local bands, based in or right around Olympia, WA, that played shows at The Grange Example/);
  assert.match(p, /Its website: https:\/\/grange\.example/);
  assert.match(p, /Only bands that fit these scenes: Oly DIY, Punk/);
  assert.match(p, /Already known \(don't list them\): Soda Example\./, "bands only, not the venue itself");
  assert.match(p, /Leave out touring acts/);
  const text =
    '```json\n{"found": [{"name": "Touring Example", "town": null, "source": "https://grange.example/events"},' +
    ' {"name": "Local Example", "town": "Olympia, WA", "source": "https://grange.example/events"}]}\n```';
  const { found, dropped } = readDiscoverAnswer(text, ["https://grange.example/events"], "band", null, k.names);
  assert.deepEqual(
    found.map((c) => [c.name, c.town]),
    [["Local Example", "Olympia, WA"]],
  );
  assert.deepEqual(dropped, ["Touring Example: no home town given"]);
  assert.match(discoverPrompt("Olympia, WA", "label", k, { limit: 10 }), /cassette or tape labels/);
  assert.match(discoverPrompt("Olympia, WA", "band", k, { limit: 10 }), /"unknown" if you can't tell/);
});

test("venue kinds: DIY rooms' bills first, theaters last", () => {
  const k = readKnown(rows, ["Olympia, WA"]);
  assert.match(discoverPrompt("Olympia, WA", "venue", k, { limit: 10 }), /"kind": "diy"/);
  const text =
    '```json\n{"found": [{"name": "Big Theater Example", "kind": "theater", "source": "https://x.example"},' +
    ' {"name": "Basement Example", "kind": "DIY", "source": "https://x.example"},' +
    ' {"name": "Bar Example", "kind": "pub", "source": "https://x.example"}]}\n```';
  const { found } = readDiscoverAnswer(text, ["https://x.example"], "venue", "Olympia, WA", k.names);
  assert.deepEqual(
    found.map((c) => c.kind),
    ["theater", "diy", "other"],
  );
  assert.deepEqual(
    billsOrder(found).map((c) => c.name),
    ["Basement Example", "Bar Example", "Big Theater Example"],
  );
});

test("the focus: DIY first, punk and its neighbors, unless changed", () => {
  const k = readKnown(rows, ["Olympia, WA"]);
  const band = discoverPrompt("Olympia, WA", "band", k, { limit: 10 });
  assert.match(band, /DIY bands first, then DIY-adjacent ones/);
  assert.match(band, /Genres: punk, post-punk, indie rock, and their neighbors/);
  assert.match(band, /like jazz, country, cover and tribute acts/);
  assert.match(discoverPrompt("Olympia, WA", "label", k, { limit: 10 }), /DIY record labels first/);
  assert.match(
    discoverPrompt("Olympia, WA", "venue", k, { limit: 10 }),
    /Rooms that book DIY and DIY-adjacent shows in these genres: punk/,
  );
  const custom = discoverPrompt("Olympia, WA", "band", k, { limit: 10, focus: "hardcore" });
  assert.match(custom, /Genres: hardcore\./);
  const any = discoverPrompt("Olympia, WA", "band", k, { limit: 10, focus: "" });
  assert.doesNotMatch(any, /Genres:/);
  assert.match(any, /DIY bands first/);
  assert.match(venueBillsPrompt("Olympia, WA", { name: "X" }, k, { limit: 5 }), /Genres: punk, post-punk/);
});

test("recent first: by the latest date in last seen, unknowns at the bottom", () => {
  assert.equal(seenRank("Show at The Mortuary, May 27, 2026"), 2026 * 12 + 4);
  assert.equal(seenRank("2026-10-24, Capitol Theater"), 2026 * 12 + 9);
  assert.equal(seenRank("Album Bucolic Gone, Mar 2025"), 2025 * 12 + 2);
  assert.equal(seenRank("Mentioned in 2023 OPB episode"), 2023 * 12);
  assert.equal(seenRank("Nov 8, 2025 (also listed Nov 9, 2026)"), 2026 * 12 + 10);
  assert.equal(seenRank("unknown"), -1);
  const c = (name: string, type: "band" | "label", lastSeen: string) => ({
    name,
    type,
    lastSeen,
    town: "",
    source: "",
    why: "",
    instagram: "",
    bandcamp: "",
    website: "",
  });
  assert.deepEqual(
    recentFirst([
      c("Some Velvet Example", "band", "unknown"),
      c("Old Example", "band", "Discomania released Apr 2024"),
      c("Tape Example", "label", "unknown"),
      c("New Example", "band", "Show, May 27, 2026"),
    ]).map((x) => x.name),
    ["Tape Example", "New Example", "Old Example", "Some Velvet Example"],
  );
});

test("Look up's details fill a Discover row's blanks, never its links", () => {
  const c = {
    name: "Gutter Example",
    type: "band" as const,
    town: "Olympia, WA",
    source: "https://showlist.example/oly",
    why: "",
    lastSeen: "",
    instagram: "",
    bandcamp: "https://gutterexample.bandcamp.com",
    website: "",
  };
  const band = asExportBand(c);
  assert.deepEqual(band.links, [{ label: "", url: "https://gutterexample.bandcamp.com" }]);
  const row = withDetails(discoverRow(c, "2026-11-20"), {
    catalog_no: "",
    name: "Gutter Example",
    type: "Band",
    instagram: "https://www.instagram.com/gutterexample/",
    bandcamp: "https://wrong.bandcamp.com",
    website: "",
    email: "gutter@example.com",
    members: "Ann - Drums; Bo",
    photo: "https://example.com/press.jpg",
    notes: "Look up, 2026-11-20.",
  });
  assert.equal(row.bandcamp, "https://gutterexample.bandcamp.com");
  assert.equal(row.instagram, "https://www.instagram.com/gutterexample/");
  assert.equal(row.email, "gutter@example.com");
  assert.equal(row.members, "Ann - Drums; Bo");
  assert.equal(row.photo, "https://example.com/press.jpg");
  assert.match(row.notes, /^Discover, 2026-11-20\..*\nLook up, 2026-11-20\.$/s);
  assert.deepEqual(withDetails(row, null), row);
});
