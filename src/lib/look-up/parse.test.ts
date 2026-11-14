// Look up (#321). Run with: npm test
// Fixture bands, sites, and people are fictional.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bandcampRoot,
  gapsFor,
  instagramProfile,
  kindOf,
  linkKey,
  promptFor,
  readAnswer,
  readExportRow,
  robotsAllow,
  rowFor,
  scanSite,
  type Answer,
} from "./parse.ts";

const exported = {
  catalog_no: '="BND-0042"',
  name: "Soda",
  kind: "group",
  types: "Band",
  our_band: "no",
  town: "Portland",
  region: "Oregon",
  country: "United States",
  scenes: "Portland DIY; Punk",
  email: "",
  links: "Instagram: https://instagram.com/soda_pdx; Website: https://soda.example",
  archived_on: "",
};

test("export rows: bands only, not our own, not archived", () => {
  const b = readExportRow(exported);
  assert.equal(b?.catalogNo, "BND-0042");
  assert.deepEqual(b?.scenes, ["Portland DIY", "Punk"]);
  assert.deepEqual(b?.links, [
    { label: "Instagram", url: "https://instagram.com/soda_pdx" },
    { label: "Website", url: "https://soda.example" },
  ]);
  assert.equal(readExportRow({ ...exported, types: "Venue" }), null);
  assert.equal(readExportRow({ ...exported, our_band: "yes" }), null);
  assert.equal(readExportRow({ ...exported, archived_on: "2026-11-01" }), null);
});

test("gaps: a website is the band's own site, not a platform", () => {
  const b = readExportRow(exported)!;
  assert.deepEqual(gapsFor(b), ["bandcamp", "email"]);
  const onlyLinktree = { ...b, links: [{ label: "Website", url: "https://linktr.ee/soda" }] };
  assert.deepEqual(gapsFor(onlyLinktree), ["instagram", "bandcamp", "website", "email"]);
});

test("links: kinds, profiles, and the same page however it's written", () => {
  assert.equal(kindOf("https://soda.bandcamp.com/album/x"), "bandcamp");
  assert.equal(kindOf("https://open.spotify.com/artist/1"), "platform");
  assert.equal(kindOf("https://soda.example"), "website");
  assert.equal(instagramProfile("https://www.instagram.com/Soda_PDX/?hl=en"), "https://instagram.com/soda_pdx");
  assert.equal(instagramProfile("https://instagram.com/p/abc123/"), null);
  assert.equal(bandcampRoot("https://soda.bandcamp.com/album/first"), "https://soda.bandcamp.com");
  assert.equal(bandcampRoot("https://bandcamp.com/discover"), null);
  assert.equal(linkKey("https://www.Soda.example/?ref=x"), linkKey("http://soda.example"));
});

test("the prompt is anchored, never a bare name", () => {
  const p = promptFor(readExportRow(exported)!, ["bandcamp", "email"]);
  assert.match(p, /Band: Soda/);
  assert.match(p, /Based in: Portland, Oregon, United States/);
  assert.match(p, /Known link: https:\/\/instagram\.com\/soda_pdx/);
  assert.match(p, /Find: bandcamp, email, and its current members/);
});

test("answers keep only what cites a page the search returned", () => {
  const searched = ["https://soda.bandcamp.com/", "https://pdxpunk.example/soda-interview"];
  const text = `Here you go:
\`\`\`json
{"same_band": true, "possible_confusions": ["Soda (cover band, Ohio)"],
 "bandcamp": {"value": "https://soda.bandcamp.com/album/first", "source": "https://soda.bandcamp.com", "why": "lists Portland, OR"},
 "email": {"value": "booking@soda.example", "source": "https://made-up.example/contact", "why": "?"},
 "instagram": {"value": "https://instagram.com/p/xyz", "source": "https://soda.bandcamp.com/", "why": "linked"},
 "website": null,
 "members": [{"value": "Riley Example", "source": "https://pdxpunk.example/soda-interview", "why": "interview"},
             {"value": "Kay Test (vox/guitar)", "source": "https://pdxpunk.example/soda-interview"},
             {"value": "Creep 1", "role": "guitar or bass", "source": "https://pdxpunk.example/soda-interview"},
             {"value": "John Example - Drums", "source": "https://soda.bandcamp.com/"},
             {"value": "riley example", "source": "https://soda.bandcamp.com/"},
             {"value": "Dee", "source": "https://nowhere.example", "why": ""}]}
\`\`\``;
  const a = readAnswer(text, searched);
  assert.equal(a.sameBand, true);
  assert.deepEqual(a.found.bandcamp, {
    value: "https://soda.bandcamp.com",
    source: "https://soda.bandcamp.com",
    why: "lists Portland, OR",
  });
  assert.equal(a.found.email, undefined);
  assert.equal(a.found.instagram, undefined);
  // Read like a pasted lineup: roles split off the name, stage names kept, no repeats.
  assert.deepEqual(
    a.members.map((m) => [m.name, m.roles]),
    [
      ["Riley Example", ""],
      ["Kay Test", "Vocals, Guitar"],
      ["Creep 1", "Guitar, Bass"],
      ["John Example", "Drums"],
    ],
  );
  assert.deepEqual(a.dropped, [
    'instagram: "https://instagram.com/p/xyz" isn\'t one',
    "email: its source wasn't in the search results",
    "member Dee: its source wasn't in the search results",
  ]);
  assert.deepEqual(a.confusions, ["Soda (cover band, Ohio)"]);

  const unsure = readAnswer('```json\n{"same_band": false, "bandcamp": {"value": "x", "source": "y"}}\n```', []);
  assert.deepEqual(unsure.found, {});
  assert.deepEqual(readAnswer("no json here", []).dropped, ["the answer wasn't readable"]);
});

test("robots.txt: the * group decides, longest rule wins", () => {
  const txt = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/press\n";
  assert.equal(robotsAllow(txt, "/"), true);
  assert.equal(robotsAllow(txt, "/private/notes"), false);
  assert.equal(robotsAllow(txt, "/private/press"), true);
  assert.equal(robotsAllow("User-agent: *\nDisallow: /\n", "/contact"), false);
  assert.equal(robotsAllow("", "/"), true);
});

test("a band's site: emails, profiles, its share image, and pages worth a look", () => {
  const html = `<html><head><meta property="og:image" content="/img/press.jpg"></head><body>
    <a href="mailto:Booking@Soda.example?subject=Show">Booking</a>
    <a href="https://www.instagram.com/soda_pdx/">IG</a>
    <a href="https://soda.bandcamp.com/album/first">Music</a>
    <a href="/contact">Contact</a><a href="/about/">About</a><a href="/shop">Shop</a>
    <a href="https://elsewhere.example/about">Not ours</a></body></html>`;
  assert.deepEqual(scanSite(html, "https://soda.example/"), {
    emails: ["booking@soda.example"],
    instagram: ["https://instagram.com/soda_pdx"],
    bandcamp: ["https://soda.bandcamp.com"],
    image: "https://soda.example/img/press.jpg",
    pages: ["https://soda.example/contact", "https://soda.example/about/"],
  });
});

test("the row: blanks only, the website wins, every source noted", () => {
  const b = readExportRow({ ...exported, links: "" })!;
  const answer: Answer = {
    sameBand: true,
    dropped: [],
    found: {
      instagram: { value: "https://instagram.com/soda_other", source: "https://a.example", why: "" },
      bandcamp: { value: "https://soda.bandcamp.com", source: "https://soda.bandcamp.com", why: "lists Portland" },
      website: { value: "https://soda.example", source: "https://soda.example", why: "" },
    },
    members: [
      { name: "Riley Example", roles: "Drums", source: "https://pdxpunk.example/x" },
      { name: "Sam Example", roles: "", source: "https://pdxpunk.example/x" },
    ],
    confusions: [
      "A very long description of some other band from somewhere else that goes on and on and on",
      "B",
      "C",
      "D",
    ],
  };
  const site = {
    emails: ["booking@soda.example"],
    instagram: ["https://instagram.com/soda_pdx"],
    bandcamp: ["https://soda.bandcamp.com"],
    image: "https://soda.example/press.jpg",
    pages: [],
  };
  const row = rowFor(b, gapsFor(b), answer, site, "https://soda.example", "2026-11-13")!;
  assert.equal(row.instagram, "https://instagram.com/soda_pdx");
  assert.equal(row.bandcamp, "https://soda.bandcamp.com");
  assert.equal(row.website, "https://soda.example");
  assert.equal(row.email, "booking@soda.example");
  assert.equal(row.members, "Riley Example - Drums; Sam Example");
  assert.match(row.notes, /Not to be confused with: A very long description[^;]{0,60}…; B; C$/);
  assert.equal(row.photo_to_upload, "https://soda.example/press.jpg");
  assert.match(row.notes, /^Look up, 2026-11-13\. Sources:/);
  assert.match(row.notes, /The search said https:\/\/instagram\.com\/soda_other .*the website wins/);
  assert.match(row.notes, /Bandcamp: from the band's website \(https:\/\/soda\.example\), and the search agrees/);

  const nothing = rowFor(b, gapsFor(b), { ...answer, found: {}, members: [] }, null, null, "2026-11-13");
  assert.equal(nothing, null);
});
