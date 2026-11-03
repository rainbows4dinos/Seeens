// "Today" in the band's time zone. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TIME_ZONE, safeTimeZone, todayISO } from "./labels.ts";

// 11:30 pm Sunday in Portland is already Monday in New York and Berlin.
const lateSunday = new Date("2026-11-02T07:30:00Z");

test("today depends on the band's time zone", () => {
  assert.equal(todayISO(lateSunday, "America/Los_Angeles"), "2026-11-01");
  assert.equal(todayISO(lateSunday, "America/New_York"), "2026-11-02");
  assert.equal(todayISO(lateSunday, "Europe/Berlin"), "2026-11-02");
});

test("without a zone, today is Pacific", () => {
  assert.equal(DEFAULT_TIME_ZONE, "America/Los_Angeles");
  assert.equal(todayISO(lateSunday), "2026-11-01");
});

test("an unknown zone falls back to Pacific instead of failing", () => {
  assert.equal(safeTimeZone("Not/AZone"), DEFAULT_TIME_ZONE);
  assert.equal(safeTimeZone(""), DEFAULT_TIME_ZONE);
  assert.equal(safeTimeZone(null), DEFAULT_TIME_ZONE);
  assert.equal(safeTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(todayISO(lateSunday, "Not/AZone"), "2026-11-01");
});
