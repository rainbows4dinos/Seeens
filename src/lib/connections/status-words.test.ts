// Status words by type (#139). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { historyLine, playedWords, statusHint, statusLabel, wordSetFor } from "./status-words.ts";

const band = { kind: "group" as const, group_type: "band" as const };
const venue = { kind: "group" as const, group_type: "venue" as const };
const promoter = { kind: "group" as const, group_type: "promoter_collective" as const };
const label = { kind: "group" as const, group_type: "label" as const };
const untyped = { kind: "group" as const, group_type: null };
const person = (...roles: ("musician" | "dj" | "booker" | "photographer" | "writer" | "radio_host")[]) => ({
  kind: "person" as const,
  group_type: null,
  person_roles: roles,
});

test("each type gets its words; the shared ones stay shared", () => {
  assert.equal(wordSetFor(band), "band");
  assert.equal(wordSetFor(venue), "venue");
  assert.equal(wordSetFor(promoter), "venue");
  assert.equal(wordSetFor(label), "collab");
  assert.equal(wordSetFor(untyped), "collab");
  assert.equal(wordSetFor(person("booker")), "people");
  assert.deepEqual(
    [band, venue, person(), label].map((c) => statusLabel("homies", c)),
    ["Homies", "Favorite", "Homie", "Homies"],
  );
  assert.deepEqual(
    [band, venue, person(), label].map((c) => statusLabel("lets_play", c)),
    ["Let's play", "Let's book", "Let's collab", "Let's collab"],
  );
  for (const c of [band, venue, person(), label]) {
    assert.equal(statusLabel("prospect", c), "Eyeing");
    assert.equal(statusLabel("neutral", c), "Heard of");
    assert.equal(statusLabel("avoid", c), "Avoid");
  }
  assert.equal(statusLabel("homies"), "Homies", "no type: band words");
  assert.equal(statusHint("homies", venue), "One of our favorites.");
});

test("played together says what it means for the type", () => {
  assert.equal(playedWords(band).label, "We've played together");
  assert.equal(playedWords(venue).label, "We've played here");
  assert.equal(playedWords(promoter).tag, "Booked us");
  assert.equal(playedWords({ kind: "group", group_type: "recording_studio" }).tag, "Recorded here");
  assert.equal(playedWords({ kind: "group", group_type: "press" }).tag, "Covered us");
  assert.equal(playedWords(label).tag, "Worked together");
  assert.equal(playedWords(untyped).tag, "Worked together");
  // People: first matching role, musicians first.
  assert.equal(playedWords(person("booker", "musician")).tag, "Played together");
  assert.equal(playedWords(person("booker")).tag, "Booked us");
  assert.equal(playedWords(person("radio_host")).tag, "Been on");
  assert.equal(playedWords(person("writer")).tag, "Covered us");
  assert.equal(playedWords(person("photographer")).tag, "Worked together");
  assert.equal(playedWords(null).label, "We've played together");
});

test("history lines: a first status, a change, a clear (#192)", () => {
  assert.equal(historyLine({ from_status: null, to_status: "neutral" }, band), "Set to Heard of");
  assert.equal(historyLine({ from_status: null, to_status: "homies" }, band, "Added as"), "Added as Homies");
  assert.equal(historyLine({ from_status: "prospect", to_status: "lets_play" }, band), "Eyeing to Let's play");
  assert.equal(historyLine({ from_status: "neutral", to_status: null }, band), "Cleared (was Heard of)");
  assert.equal(statusLabel(null, band), "No status");
});
