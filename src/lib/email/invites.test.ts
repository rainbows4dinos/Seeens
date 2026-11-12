import { test } from "node:test";
import assert from "node:assert/strict";
import { memberInvite, ownerInvite } from "./invites.ts";

const all = [
  ownerInvite({ from: "Larry", replyName: "Larry", band: "The Snubs", kind: "band", name: "Tim", link: "L" }),
  ownerInvite({ from: "Larry", replyName: "Larry", band: "Moodkiller Records", kind: "label", name: "", link: "L" }),
  memberInvite({ from: "Misty", band: "Merwulf", kind: "band", link: "L" }),
  memberInvite({ from: "Tim", band: "Moodkiller Records", kind: "label", link: "L" }),
];

test("no possessive on a name ending in s, and no em dashes", () => {
  for (const e of all) {
    assert.ok(!/s's\b/.test(e.text + e.subject), e.subject);
    assert.ok(!/—/.test(e.text + e.subject), e.subject);
  }
});

test("every invite has its link, how long it lasts, and the way out", () => {
  for (const e of all) {
    assert.match(e.text, /: L\n/);
    assert.match(e.text, /works once, for 7 days/);
    assert.match(e.text, /Don't email me again/);
  }
});

test("a blank name says Hi", () => {
  assert.ok(all[1].text.startsWith("Hi,\n"));
  assert.ok(all[0].text.startsWith("Hi Tim,\n"));
});
