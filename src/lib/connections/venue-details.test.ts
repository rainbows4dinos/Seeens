// Venue details (#48). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookLine,
  mapHref,
  gearLine,
  isStale,
  readVenueDetails,
  venueDetailsFromForm,
  venueDetailsToForm,
  venueLine,
} from "./venue-details.ts";

const blank = {
  ages: "", capacity: "", space: "", pa: "", sound: "", backline: "",
  book_via: "", accessibility: "", special_terms: "", address: "",
};

test("reading stored details keeps only what's valid", () => {
  assert.deepEqual(readVenueDetails({ ages: "all_ages", capacity: "huge", pa: "yes", address: "  ", from_import: 1 }), {
    ages: "all_ages",
  });
  assert.deepEqual(readVenueDetails(null), {});
  assert.deepEqual(readVenueDetails({ checked_on: "2026-11-04", sound: false }), { sound: false, checked_on: "2026-11-04" });
});

test("the form round-trips, and blank means not sure", () => {
  const r = venueDetailsFromForm({ ...blank, ages: "varies", pa: "yes", sound: "no", book_via: "instagram", address: " 12 Oak St " });
  assert.ok(r.ok);
  assert.deepEqual(r.details, { address: "12 Oak St", ages: "varies", pa: true, sound: false, book_via: "instagram" });
  assert.deepEqual(venueDetailsToForm(r.details), { ...blank, address: "12 Oak St", ages: "varies", pa: "yes", sound: "no", book_via: "instagram" });
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
});

test("booking points at the contact the venue already has", () => {
  const c = {
    email: "booking@example.com",
    links: [
      { label: "Instagram", url: "https://instagram.com/room" },
      { label: null, url: "https://www.facebook.com/room/" },
      { label: "Website", url: "https://room.example.com/book" },
    ],
  };
  assert.deepEqual(bookLine({ book_via: "email" }, c), { text: "Email", contact: "booking@example.com", href: "mailto:booking@example.com" });
  assert.deepEqual(bookLine({ book_via: "instagram" }, c), { text: "Instagram", contact: "instagram.com/room", href: "https://instagram.com/room" });
  assert.equal(bookLine({ book_via: "facebook" }, c)?.contact, "facebook.com/room", "found by its address when unlabeled");
  assert.equal(bookLine({ book_via: "form" }, c)?.href, "https://room.example.com/book");
  assert.deepEqual(bookLine({ book_via: "email" }, { email: null, links: [] }), { text: "Email" });
  assert.deepEqual(bookLine({ book_via: "in_person" }, c), { text: "In person" });
  assert.equal(bookLine({}, c), null);
});

test("details go stale after six months", () => {
  assert.equal(isStale("2026-01-01", "2026-11-04"), true);
  assert.equal(isStale("2026-09-01", "2026-11-04"), false);
  assert.equal(isStale(undefined, "2026-11-04"), false);
});

test("a street address gets a map link; a quiet one doesn't", () => {
  assert.equal(mapHref("123 Main St", "Portland, OR"), "https://www.openstreetmap.org/search?query=123%20Main%20St%2C%20Portland%2C%20OR");
  assert.equal(mapHref("Ask a punk", "Portland, OR"), null);
  assert.equal(mapHref(undefined, null), null);
});
