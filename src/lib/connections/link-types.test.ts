import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLinkType, joinLinkLabel, splitLinkLabel } from "./link-types.ts";

test("detects link types from URLs", () => {
  assert.equal(detectLinkType("https://www.instagram.com/gab_pdx/"), "Instagram");
  assert.equal(detectLinkType("grownassbitch.bandcamp.com"), "Bandcamp");
  assert.equal(detectLinkType("subvert.fm/someband"), "Subvert");
  assert.equal(detectLinkType("https://open.spotify.com/artist/x"), "Spotify");
  assert.equal(detectLinkType("youtu.be/abc"), "YouTube");
  assert.equal(detectLinkType("m.soundcloud.com/x"), "SoundCloud");
  assert.equal(detectLinkType("linktr.ee/band"), "Website");
  assert.equal(detectLinkType("notinstagram.com"), "Website");
  assert.equal(detectLinkType(""), null);
  assert.equal(detectLinkType("band"), null);
});

test("splits stored labels into type and custom text", () => {
  assert.deepEqual(splitLinkLabel("bandcamp"), { type: "Bandcamp", custom: "" });
  assert.deepEqual(splitLinkLabel("Merch store"), { type: "Other", custom: "Merch store" });
  assert.deepEqual(splitLinkLabel(""), { type: "", custom: "" });
  assert.deepEqual(splitLinkLabel("Other"), { type: "Other", custom: "" });
});

test("joins type and custom text back into a label", () => {
  assert.equal(joinLinkLabel("Instagram", "ignored"), "Instagram");
  assert.equal(joinLinkLabel("Other", " Merch store "), "Merch store");
  assert.equal(joinLinkLabel("Other", ""), "Other");
  assert.equal(joinLinkLabel("", ""), "");
  assert.equal(joinLinkLabel("Myspace", ""), "");
});
