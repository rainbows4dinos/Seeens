// Turns a pasted band lineup into rows of name, roles, and former/current.
// Pure and dependency-free, so it runs in the browser for the preview and is
// easy to test. No AI: a plain parser for the way lineups are usually written.
//
//   TYLER RACHAL - VOCALS / GUITAR      -> Tyler Rachal · Vocals, Guitar
//   Jo Example: vox, keys (former)      -> Jo Example · Vocals, Keyboards · former
//   Past members                        -> (heading: rows below are former)

import { INSTRUMENTS, INSTRUMENT_ALIASES } from "./instruments.ts";

export type LineupRow = {
  name: string;
  roles: string; // readable, "Vocals, Guitar"; "" when none given
  former: boolean;
};

export const MAX_ROLE_LENGTH = 80;
export const MAX_NAME_LENGTH = 200;
export const MAX_ROWS = 40;

// Common shorthand. Instruments come from instruments.ts (the same list the
// directory reads "Plays" with, #140), as their labels; a few band roles keep
// a finer label here. Anything not listed is kept as typed (title-cased).
const ROLE_ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(INSTRUMENTS).map(([key, label]) => [key.replace(/_/g, " "), label])),
  ...Object.fromEntries(Object.entries(INSTRUMENT_ALIASES).map(([alias, key]) => [alias, INSTRUMENTS[key]])),
  "lead vocals": "Lead Vocals",
  "backing vocals": "Backing Vocals",
  bvs: "Backing Vocals",
  "lead guitar": "Lead Guitar",
  "rhythm guitar": "Rhythm Guitar",
};

// Small words that stay lowercase inside a title-cased role.
const SMALL_WORDS = new Set(["and", "of", "the", "on", "in", "a", "an"]);

// Name and roles are split on the first of these.
const NAME_SEPARATOR = /\s+[-–—]\s+|\s*[:|\t]\s*|\s+[–—]\s*|\s*[–—]\s+/;
// Roles are split on any of these.
const ROLE_SEPARATOR = /\s*(?:\/|,|&|\+|;|\band\b)\s*/i;
// Marks a single line as a former member: "(former)", "[ex]", "- ex-member".
const FORMER_MARK = /\s*[([]\s*(?:former|ex|ex-member|past|formerly)\s*[)\]]\s*/i;
// A heading line: "Lineup", "Members:", "Current lineup", "Past members".
const HEADING = /^\s*(?:the\s+)?(?:(current|present|past|former|previous|original)\s+)?(?:line[\s-]?up|members?|band|personnel)\s*:?\s*$/i;
const FORMER_HEADING_WORDS = new Set(["past", "former", "previous", "original"]);

export function parseLineup(text: string): LineupRow[] {
  const rows: LineupRow[] = [];
  let underFormerHeading = false;

  for (const raw of text.split(/\r?\n/)) {
    // Bullets and numbering often come along when copying from a page.
    const line = raw.replace(/^\s*(?:[-*•·]\s+|\d+[.)]\s+)/, "").trim();
    if (!line) continue;

    const heading = line.match(HEADING);
    if (heading) {
      underFormerHeading = FORMER_HEADING_WORDS.has((heading[1] ?? "").toLowerCase());
      continue;
    }

    let former = underFormerHeading;
    let rest = line;
    if (FORMER_MARK.test(rest)) {
      former = true;
      rest = rest.replace(FORMER_MARK, " ").trim();
    }

    const split = rest.match(NAME_SEPARATOR);
    const namePart = split ? rest.slice(0, split.index) : rest;
    const rolePart = split ? rest.slice(split.index! + split[0].length) : "";

    const name = cleanName(namePart);
    if (!name) continue;
    rows.push({ name, roles: cleanRoles(rolePart), former });
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

// "TYLER RACHAL" -> "Tyler Rachal". Mixed-case names are left alone, so
// "DeAndre McKay" stays as typed.
export function cleanName(raw: string) {
  const name = raw.replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, "").trim();
  const letters = name.replace(/[^\p{L}]/gu, "");
  const shouting = letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  // In names, a letter after an apostrophe starts a new word: O'Sample.
  const out = shouting ? name.toLowerCase().replace(/\p{L}+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1)) : name;
  return out.slice(0, MAX_NAME_LENGTH);
}

// "VOCALS / GUITAR" -> "Vocals, Guitar"; "vox & keys" -> "Vocals, Keyboards".
export function cleanRoles(raw: string) {
  const seen = new Set<string>();
  const roles: string[] = [];
  for (const part of raw.split(ROLE_SEPARATOR)) {
    const key = part.replace(/[.\s]+$/, "").trim().toLowerCase();
    if (!key) continue;
    const role = ROLE_ALIASES[key] ?? titleCase(key);
    if (!seen.has(role.toLowerCase())) {
      seen.add(role.toLowerCase());
      roles.push(role);
    }
  }
  return roles.join(", ").slice(0, MAX_ROLE_LENGTH);
}

function titleCase(s: string) {
  return s.replace(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu, (word, offset: number) => {
    if (offset > 0 && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}
