// Lineup paste parser. Run with: npm test. Fictional names only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ROLE_LENGTH, MAX_ROWS, cleanName, cleanRoles, parseLineup } from "./lineup.ts";

const row = (name: string, roles = "", former = false) => ({ name, roles, former });

test("the all-caps example from the issue", () => {
  assert.deepEqual(
    parseLineup(`TYLER EXAMPLE - VOCALS / GUITAR
ANDREA SAMPLE - VOCALS / BASS
DANIEL PLACEHOLDER - GUITAR / VOCALS
ZAK FICTION - DRUMS / VOCALS`),
    [
      row("Tyler Example", "Vocals, Guitar"),
      row("Andrea Sample", "Vocals, Bass"),
      row("Daniel Placeholder", "Guitar, Vocals"),
      row("Zak Fiction", "Drums, Vocals"),
    ],
  );
});

test("mixed separators between name and roles", () => {
  assert.deepEqual(
    parseLineup(
      [
        "Jo Example – guitar",
        "Riley Drums — drums",
        "Sam Sample: bass",
        "Ana Test | keys",
        "Lee Tab\tsynth",
        "Kim Hyphen - vox",
      ].join("\n"),
    ),
    [
      row("Jo Example", "Guitar"),
      row("Riley Drums", "Drums"),
      row("Sam Sample", "Bass"),
      row("Ana Test", "Keyboards"),
      row("Lee Tab", "Synth"),
      row("Kim Hyphen", "Vocals"),
    ],
  );
});

test("hyphenated names aren't split", () => {
  assert.deepEqual(parseLineup("Mary-Kate Example - drums"), [row("Mary-Kate Example", "Drums")]);
  assert.deepEqual(parseLineup("Jean-Luc Sample"), [row("Jean-Luc Sample")]);
});

test("mixed role separators, shorthand, and duplicates", () => {
  assert.equal(cleanRoles("vox & gtr"), "Vocals, Guitar");
  assert.equal(cleanRoles("Vocals, Guitar and Keys"), "Vocals, Guitar, Keyboards");
  assert.equal(cleanRoles("bass / BASS / bass guitar"), "Bass");
  assert.equal(cleanRoles("tape loops + field recordings"), "Tape Loops, Field Recordings");
  assert.equal(cleanRoles("lead vocals; backing vocals"), "Lead Vocals, Backing Vocals");
  assert.equal(cleanRoles("Sound of the city"), "Sound of the City");
  assert.equal(cleanRoles(""), "");
});

test("roles stop at 80 characters", () => {
  const long = parseLineup(`Jo Example - ${Array.from({ length: 30 }, (_, i) => `instrument${i}`).join(", ")}`);
  assert.ok(long[0].roles.length <= MAX_ROLE_LENGTH);
});

test("a line with no separator is a name with no roles", () => {
  assert.deepEqual(parseLineup("Jo Example\nRILEY DRUMS"), [row("Jo Example"), row("Riley Drums")]);
});

test("blank lines, headings, bullets, and numbering are skipped", () => {
  assert.deepEqual(
    parseLineup(`
Lineup:

• Jo Example - guitar
* Riley Drums - drums
1. Sam Sample - bass
2) Ana Test

Members`),
    [row("Jo Example", "Guitar"), row("Riley Drums", "Drums"), row("Sam Sample", "Bass"), row("Ana Test")],
  );
});

test("former markers on a line", () => {
  assert.deepEqual(
    parseLineup(`Jo Example - guitar (former)
Riley Drums (ex) - drums
Sam Sample - bass [past]`),
    [row("Jo Example", "Guitar", true), row("Riley Drums", "Drums", true), row("Sam Sample", "Bass", true)],
  );
});

test("everything under a past-members heading is former", () => {
  assert.deepEqual(
    parseLineup(`Current lineup
Jo Example - guitar
Past members:
Riley Drums - drums
Sam Sample - bass
Current members
Ana Test - keys`),
    [
      row("Jo Example", "Guitar"),
      row("Riley Drums", "Drums", true),
      row("Sam Sample", "Bass", true),
      row("Ana Test", "Keyboards"),
    ],
  );
});

test("mixed-case names stay as typed; all-caps become title case", () => {
  assert.equal(cleanName("DeAndre McKay"), "DeAndre McKay");
  assert.equal(cleanName("ANDREA O'SAMPLE"), "Andrea O'Sample");
  assert.equal(cleanName("  jo   example  "), "jo example");
  assert.equal(cleanName("DJ"), "Dj");
  assert.equal(cleanName("ZOË ÜMLAUT"), "Zoë Ümlaut");
});

test("Windows line endings", () => {
  assert.deepEqual(parseLineup("Jo Example - guitar\r\nRiley Drums - drums\r\n"), [
    row("Jo Example", "Guitar"),
    row("Riley Drums", "Drums"),
  ]);
});

test("a huge paste stops at the row limit", () => {
  const text = Array.from({ length: 100 }, (_, i) => `Person ${i} - guitar`).join("\n");
  assert.equal(parseLineup(text).length, MAX_ROWS);
});

test("empty input", () => {
  assert.deepEqual(parseLineup(""), []);
  assert.deepEqual(parseLineup("\n\n  \nLineup:\n"), []);
});
