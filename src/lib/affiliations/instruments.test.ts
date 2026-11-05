// What people play (#140). Run with: npm test. Fictional names only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { INSTRUMENTS, INSTRUMENT_ALIASES, instrumentsFromRole, playsAll, playsLine } from "./instruments.ts";

test("roles as people write them", () => {
  assert.deepEqual(instrumentsFromRole("Vocals, Guitar"), ["vocals", "guitar"]);
  assert.deepEqual(instrumentsFromRole("vox / keys"), ["vocals", "keyboards"]);
  assert.deepEqual(instrumentsFromRole("Lead Vocals & Rhythm Guitar"), ["vocals", "guitar"]);
  assert.deepEqual(instrumentsFromRole("bass guitar and backing vocals."), ["bass", "vocals"]);
  assert.deepEqual(instrumentsFromRole("drums + perc"), ["drums", "percussion"]);
  assert.deepEqual(instrumentsFromRole("  Tenor  Sax ; fiddle "), ["saxophone", "violin"]);
});

test("anything that isn't an instrument is left out", () => {
  assert.deepEqual(instrumentsFromRole("merch, booking"), []);
  assert.deepEqual(instrumentsFromRole("guitar, runs the van"), ["guitar"]);
  assert.deepEqual(instrumentsFromRole(""), []);
  assert.deepEqual(instrumentsFromRole(null), []);
  // "band" isn't split on "and".
  assert.deepEqual(instrumentsFromRole("band leader"), []);
});

test("a person's line: current bands, then what they also play", () => {
  assert.equal(
    playsLine([
      { band: "The Tin Hollows", role: "drums", current: true },
      { band: "Old Band", role: "bass, vocals", current: false },
    ]),
    "Drums in The Tin Hollows · also plays bass and vocals",
  );
  assert.equal(playsLine([{ band: "Night Gleaners", role: null, current: true }]), "In Night Gleaners");
  assert.equal(playsLine([{ band: "Old Band", role: "guitar", current: false }]), "Played guitar");
  assert.equal(playsLine([]), null);
  assert.deepEqual(
    playsAll([
      { band: "A", role: "bass", current: true },
      { band: "B", role: "vox, bass", current: false },
    ]),
    ["vocals", "bass"],
  );
});

test("the database knows the same aliases", () => {
  const sql = readFileSync(
    path.resolve(import.meta.dirname, "../../../supabase/migrations/20261105020000_instruments_and_closeness.sql"),
    "utf8",
  );
  const block = sql.slice(sql.indexOf("-- instrument aliases: begin"), sql.indexOf("-- instrument aliases: end"));
  const inDb = Object.fromEntries([...block.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]));
  const inCode = { ...Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), ...INSTRUMENT_ALIASES };
  assert.deepEqual(inDb, inCode);
});
