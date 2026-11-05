// Venue details (#48). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookLine,
  gearLine,
  isStale,
  readVenueDetails,
  venueDetailsFromForm,
  venueDetailsToForm,
  venueLine,
} from "./venue-details.ts";

const blank = {
  ages: "", capacity: "", space: "", pa: "", sound: "", backline: "",
  book_via: "", book_at: "", accessibility: "", special_terms: "",
};

test("reading stored details keeps only what's valid", () => {
  assert.deepEqual(readVenueDetails({ ages: "all_ages", capacity: "huge", pa: "yes", book_at: "  ", from_import: 1 }), {
    ages: "all_ages",
  });
  assert.deepEqual(readVenueDetails(null), {});
  assert.deepEqual(readVenueDetails({ checked_on: "2026-11-04", sound: false }), { sound: false, checked_on: "2026-11-04" });
});

test("the form round-trips, and blank means not sure", () => {
  const r = venueDetailsFromForm({ ...blank, ages: "varies", pa: "yes", sound: "no", book_via: "instagram", book_at: " @room " });
  assert.ok(r.ok);
  assert.deepEqual(r.details, { ages: "varies", pa: true, sound: false, book_via: "instagram", book_at: "@room" });
  assert.deepEqual(venueDetailsToForm(r.details), { ...blank, ages: "varies", pa: "yes", sound: "no", book_via: "instagram", book_at: "@room" });
  const empty = venueDetailsFromForm(blank);
  assert.ok(empty.ok);
  assert.deepEqual(empty.details, {});
});

test("long text is an error", () => {
  const r = venueDetailsFromForm({ ...blank, special_terms: "x".repeat(301) });
  assert.equal(r.ok, false);
});

test("lines say only what's known", () => {
  assert.equal(venueLine({ ages: "all_ages", capacity: "50_150", space: "diy" }), "All ages · 50–150 cap · DIY");
  assert.equal(venueLine({ capacity: "600_plus" }), "600+ cap");
  assert.equal(venueLine({}), null);
  assert.equal(gearLine({ pa: true, backline: true, sound: false }), "PA, backline · no sound engineer");
  assert.equal(gearLine({ pa: false, sound: false }), "No PA, no sound engineer");
  assert.equal(gearLine({}), null);
  assert.equal(bookLine({ book_via: "email", book_at: "b@x.com" }), "Email: b@x.com");
  assert.equal(bookLine({ book_via: "in_person" }), "In person");
  assert.equal(bookLine({ book_at: "Joel" }), "Joel");
});

test("details go stale after six months", () => {
  assert.equal(isStale("2026-01-01", "2026-11-04"), true);
  assert.equal(isStale("2026-09-01", "2026-11-04"), false);
  assert.equal(isStale(undefined, "2026-11-04"), false);
});
