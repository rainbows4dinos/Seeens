// Discover (#321). Run with: npm test
// Fixture bands, towns, and sites are fictional.
import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverPrompt, discoverRow, readDiscoverAnswer, readKnown, townKey, venueBillsPrompt } from "./discover.ts";

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

test("bands from a venue's bills keep their own town, or none", () => {
  const k = readKnown(rows, ["Olympia, WA"]);
  const p = venueBillsPrompt("Olympia, WA", { name: "The Grange Example", website: "https://grange.example" }, k, {
    limit: 20,
  });
  assert.match(p, /^List bands that played shows at The Grange Example in Olympia, WA/);
  assert.match(p, /Its website: https:\/\/grange\.example/);
  assert.match(p, /Already known \(don't list them\): Soda Example\./, "bands only, not the venue itself");
  const text =
    '```json\n{"found": [{"name": "Touring Example", "town": null, "source": "https://grange.example/events"}]}\n```';
  const { found } = readDiscoverAnswer(text, ["https://grange.example/events"], "band", null, k.names);
  assert.equal(found[0].town, "");
  assert.match(discoverPrompt("Olympia, WA", "label", k, { limit: 10 }), /cassette or tape labels/);
  assert.match(discoverPrompt("Olympia, WA", "band", k, { limit: 10 }), /"unknown" if you can't tell/);
});
