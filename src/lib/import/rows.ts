// Spreadsheet import (#148): turn a sheet's rows into connections to add.
// Pure and import-light, so the tests run it directly. Nothing here guesses:
// a value Seeens can't read, or one marked unsure ("Chris?", "(sp?)"), goes
// into the notes instead of a field.

import { detectLinkType } from "../connections/link-types.ts";
import { readVenueTypes, spaceFor, type VenueDetails, type VenueType } from "../connections/venue-details.ts";

type Kind = "person" | "group";
type GroupType =
  | "band"
  | "venue"
  | "label"
  | "recording_studio"
  | "production_studio"
  | "radio_station"
  | "press"
  | "promoter_collective"
  | "other";
type PersonRole =
  | "musician"
  | "dj"
  | "promoter"
  | "booker"
  | "manager"
  | "label_owner"
  | "producer"
  | "recording_engineer"
  | "live_sound_engineer"
  | "photographer"
  | "videographer"
  | "artist_designer"
  | "writer"
  | "radio_host"
  | "other";
type Status = "homies" | "lets_play" | "prospect" | "neutral" | "avoid";

/** Where a column goes. "notes" keeps it, labeled with the header; "skip" drops it. */
export const TARGETS = {
  name: { label: "Name" },
  type: { label: "Type" },
  town: { label: "Town" },
  email: { label: "Email" },
  phone: { label: "Phone" },
  link: { label: "Link" },
  instagram: { label: "Instagram" },
  booking: { label: "Booking (email, handle, or how)", venue: true },
  booked_by: { label: "Booked by (names)", venue: true },
  address: { label: "Address", venue: true },
  ages: { label: "Ages", venue: true },
  capacity: { label: "Capacity", venue: true },
  space: { label: "DIY or licensed", venue: true },
  pa: { label: "PA", venue: true },
  sound: { label: "Sound engineer", venue: true },
  backline: { label: "Backline", venue: true },
  accessibility: { label: "Accessibility", venue: true },
  special_terms: { label: "Special terms", venue: true },
  scenes: { label: "Scenes" },
  status: { label: "Status" },
  played: { label: "Played together" },
  notes: { label: "Add to notes" },
  skip: { label: "Skip" },
} as const satisfies Record<string, { label: string; venue?: boolean }>;
export type Target = keyof typeof TARGETS;

/** What a sheet holds: one type for every row, or a Type column per row. */
export const SHEET_KINDS = {
  bands: "Bands",
  venues: "Venues",
  people: "People",
  mixed: "A mix (a Type column says which)",
} as const;
export type SheetKind = keyof typeof SHEET_KINDS;

// Header words -> target. First match wins, so specific ones come first.
const HEADER_GUESSES: [RegExp, Target][] = [
  [/book(ed|er|ing)?\s*(by|contact person|who)|^booker|^who books/i, "booked_by"],
  [/book|contact method|how to (book|contact)/i, "booking"],
  [/e-?mail/i, "email"],
  [/phone|cell|tel\b/i, "phone"],
  [/insta|^ig$/i, "instagram"],
  [/web|site|url|link|bandcamp|facebook|spotify|soundcloud|youtube/i, "link"],
  [/address|street/i, "address"],
  [/all.?ages|^ages?$|age polic|21\+/i, "ages"],
  [/capacity|^cap\.?$|size|holds/i, "capacity"],
  [/diy|licen/i, "space"],
  [/^pa$|sound system|p\.a\./i, "pa"],
  [/engineer|sound (person|guy|tech)/i, "sound"],
  [/backline|gear|drums provided/i, "backline"],
  [/access/i, "accessibility"],
  [/pay to play|terms|deal|guarantee|door/i, "special_terms"],
  [/scene|genre/i, "scenes"],
  [/status/i, "status"],
  [/played|we.?ve played/i, "played"],
  [/^type$|^kind$|^category$|what is it/i, "type"],
  [/town|city|location|where/i, "town"],
  [/^name$|band name|venue name|^band$|^venue$|^who$|^artist$/i, "name"],
  [/note|comment|misc/i, "notes"],
];

export function guessTarget(header: string, sheet: SheetKind): Target {
  const h = header.trim();
  const found = HEADER_GUESSES.find(([re]) => re.test(h))?.[1];
  if (found && "venue" in TARGETS[found] && sheet !== "venues" && sheet !== "mixed") return "notes";
  return found ?? "notes";
}

/** Guesses for every column; the first column is the name when nothing else is. */
export function guessMapping(headers: string[], sheet: SheetKind): Target[] {
  const out = headers.map((h) => guessTarget(h, sheet));
  if (!out.includes("name") && headers.length) out[0] = "name";
  // Only one name and one town column.
  for (const t of ["name", "town", "type"] as Target[]) {
    let seen = false;
    out.forEach((v, i) => {
      if (v !== t) return;
      if (seen) out[i] = "notes";
      seen = true;
    });
  }
  return out;
}

/** A connection to add (or to fill in, when it matches one already there). */
export type DraftRow = {
  /** 1-based row number in the sheet, for messages. */
  line: number;
  name: string;
  kind: Kind;
  group_type: GroupType | null;
  person_roles: PersonRole[];
  status: Status;
  played_together: boolean;
  /** The sheet's town text; the import page turns it into a place. */
  town: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  links: { label: string | null; url: string }[];
  scenes: string[];
  venue: VenueDetails;
  booked_by: string[];
};

export type Built = { rows: DraftRow[]; skipped: { line: number; reason: string }[] };

/**
 * Undo the export's spreadsheet guards: ="1876" (kept as text) and a leading
 * apostrophe in front of a formula-looking value. Anything else is untouched.
 */
export function unwrapCell(v: string): string {
  const text = /^="((?:[^"]|"")*)"$/.exec(v);
  if (text) return text[1].replace(/""/g, '"');
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}

const UNSURE = /\?\s*\)?\s*$|\(\s*sp\s*\??\s*\)/i;
export const isUnsure = (v: string) => UNSURE.test(v);

/** "Barf Bags, The" -> "The Barf Bags"; spaces tidied; "(sp?)" dropped. */
export function cleanName(raw: string): string {
  let n = raw
    .replace(/\(\s*sp\s*\??\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\?+$/, "")
    .trim();
  const flipped = /^(.*),\s*(the|a|an)$/i.exec(n);
  if (flipped) n = `${flipped[2].charAt(0).toUpperCase()}${flipped[2].slice(1).toLowerCase()} ${flipped[1]}`;
  return n;
}

/** For finding a row that's already in the directory: case, "The", and punctuation don't count. */
export function matchKey(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

const YES = /^(y|yes|yep|true|x|✓|✔|1|has( one)?)$/i;
const NO = /^(n|no|nope|false|0|none)$/i;
export function yesNo(v: string): boolean | undefined {
  const t = v.trim();
  return YES.test(t) ? true : NO.test(t) ? false : undefined;
}

export function readAges(v: string): VenueDetails["ages"] {
  const t = v.trim().toLowerCase();
  if (/all\s*-?\s*ages|^aa$/.test(t) || YES.test(t)) return "all_ages";
  if (/21/.test(t) || NO.test(t) || /bar only|^bar$/.test(t)) return "21_plus";
  if (/some|varies|depends|sometimes|mixed/.test(t)) return "varies";
  return undefined;
}

export function readCapacity(v: string): VenueDetails["capacity"] {
  const nums = [...v.replace(/,(?=\d{3})/g, "").matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (!nums.length) return undefined;
  const n = Math.max(...nums);
  if (n < 50) return "under_50";
  if (n <= 150) return "50_150";
  if (n <= 300) return "150_300";
  if (n <= 600) return "300_600";
  return "600_plus";
}

// Words -> venue types (#262), a guess shown in the preview before anything
// is saved. First match per type; more than one can apply. A plain "bar"
// stays unguessed (dive or nice is the band's call).
const VENUE_TYPE_WORDS: [RegExp, VenueType][] = [
  [/amphithea/, "amphitheater"],
  [/concert hall|theat(er|re)|auditorium|opera/, "concert_hall"],
  [/\bclub\b|music venue|showroom/, "club"],
  [/\bdive\b/, "dive_bar"],
  [/cocktail|lounge|wine bar/, "nice_bar"],
  [/brew|taproom|tap room|\bpub\b/, "brewery"],
  [/restaurant|diner|pizza|taqueria/, "restaurant"],
  [/coffee|caf[eé]\b/, "coffee_shop"],
  [/record (store|shop)/, "record_store"],
  [/music (store|shop)|guitar (store|shop)/, "music_store"],
  [/\bhouse\b/, "house"],
  [/basement|warehouse|squat|garage|practice space|underground/, "underground"],
  [/galler|art ?space|arts? (center|centre)/, "art_space"],
  [/church|communit|library|grange|\bvfw\b|legion|\bhall\b/, "community_space"],
  [/\bpark\b|outdoor|field|beach/, "outdoor"],
];

export function guessVenueTypes(v: string): VenueType[] {
  const t = v.toLowerCase();
  const hits = VENUE_TYPE_WORDS.filter(([re]) => re.test(t)).map(([, type]) => type);
  // An amphitheater isn't also a theater, and a concert hall isn't a community hall.
  const drop = new Set<VenueType>([
    ...(hits.includes("amphitheater") ? (["concert_hall"] as const) : []),
    ...(hits.includes("concert_hall") ? (["community_space"] as const) : []),
  ]);
  return readVenueTypes(hits.filter((x) => !drop.has(x)));
}

export function readSpace(v: string): VenueDetails["space"] {
  const t = v.toLowerCase();
  if (/diy|house|basement|warehouse|squat|garage/.test(t)) return "diy";
  if (/licen|bar|club|venue|theat(er|re)|brewery/.test(t)) return "licensed";
  return undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URLISH = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

function toUrl(v: string): string | null {
  const t = v.trim();
  if (!URLISH.test(t)) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function instagramUrl(v: string): string | null {
  const t = v.trim();
  const url = toUrl(t);
  if (url) return url;
  const handle = /^@?([a-z0-9._]{2,30})$/i.exec(t)?.[1];
  return handle ? `https://instagram.com/${handle}` : null;
}

export function readStatus(v: string): Status | undefined {
  const t = v.trim().toLowerCase();
  if (/homie|favou?rite|friend/.test(t)) return "homies";
  if (/let.?s (play|book|collab)/.test(t)) return "lets_play";
  if (/eyeing|crush|prospect|want/.test(t)) return "prospect";
  if (/known|heard of|neutral/.test(t)) return "neutral";
  if (/avoid|nope|never/.test(t)) return "avoid";
  return undefined;
}

type TypeGuess = { kind: Kind; group_type: GroupType | null; person_roles: PersonRole[] };
const GROUP_WORDS: [RegExp, GroupType][] = [
  [/band|group|project/, "band"],
  [/venue|bar|club|space|room|house|basement/, "venue"],
  [/label|records/, "label"],
  [/recording|studio/, "recording_studio"],
  [/radio|station/, "radio_station"],
  [/press|zine|blog|mag/, "press"],
  [/collective|presents|promotions?\b/, "promoter_collective"],
];
const ROLE_WORDS: [RegExp, PersonRole][] = [
  [/musician|player/, "musician"],
  [/\bdj\b/, "dj"],
  [/booker/, "booker"],
  [/promoter/, "promoter"],
  [/manager/, "manager"],
  [/producer/, "producer"],
  [/engineer/, "recording_engineer"],
  [/photo/, "photographer"],
  [/video/, "videographer"],
  [/artist|design/, "artist_designer"],
  [/writer|journalist/, "writer"],
  [/host/, "radio_host"],
  [/person|people/, "other"],
];

export function readType(v: string): TypeGuess | null {
  const t = v.trim().toLowerCase();
  if (!t) return null;
  const roles = ROLE_WORDS.filter(([re]) => re.test(t)).map(([, r]) => r);
  const group = GROUP_WORDS.find(([re]) => re.test(t))?.[1];
  if (group && !/promoter$|booker/.test(t)) return { kind: "group", group_type: group, person_roles: [] };
  if (roles.length) return { kind: "person", group_type: null, person_roles: [...new Set(roles)] };
  return null;
}

const SHEET_TYPE: Record<Exclude<SheetKind, "mixed">, TypeGuess> = {
  bands: { kind: "group", group_type: "band", person_roles: [] },
  venues: { kind: "group", group_type: "venue", person_roles: [] },
  people: { kind: "person", group_type: null, person_roles: ["other"] },
};

/** Names in a "booked by" cell: "Joel / Ian & Sam" -> three. */
export function splitNames(v: string): string[] {
  return v
    .split(/\s*(?:\/|,|&|\+|;|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Every row, read through the column mapping. Rows without a name are skipped. */
export function buildRows(
  headers: string[],
  data: string[][],
  mapping: Target[],
  sheet: SheetKind,
  defaults: { status: Status },
): Built {
  const rows: DraftRow[] = [];
  const skipped: Built["skipped"] = [];
  const seen = new Map<string, number>();

  data.forEach((cells, index) => {
    const line = index + 2; // the header is line 1
    if (cells.every((c) => !c?.trim())) return;
    const notes: string[] = [];
    const unsure: string[] = [];
    const row: DraftRow = {
      line,
      name: "",
      ...(sheet === "mixed" ? SHEET_TYPE.bands : SHEET_TYPE[sheet]),
      status: defaults.status,
      played_together: false,
      town: null,
      email: null,
      phone: null,
      notes: null,
      links: [],
      scenes: [],
      venue: {},
      booked_by: [],
    };
    let typed = sheet !== "mixed";

    mapping.forEach((target, col) => {
      const raw = (cells[col] ?? "").trim();
      if (!raw || target === "skip") return;
      const header = headers[col]?.trim() || `Column ${col + 1}`;
      const note = () => notes.push(`${header}: ${raw}`);

      if (target === "name") {
        row.name = cleanName(raw);
        if (isUnsure(raw)) unsure.push(`the spelling of "${row.name}"`);
        return;
      }
      if (target === "notes") return notes.push(/^notes?$|^comments?$/i.test(header) ? raw : `${header}: ${raw}`);
      // Several names: only the unsure ones stay out.
      if (target === "booked_by") {
        for (const name of splitNames(raw)) {
          if (isUnsure(name)) unsure.push(`booked by ${name}`);
          else row.booked_by.push(cleanName(name));
        }
        return;
      }
      // Anything marked unsure stays out of the fields.
      if (isUnsure(raw)) return unsure.push(`${header.toLowerCase()}: ${raw}`);

      switch (target) {
        case "type": {
          const t = readType(raw);
          if (t) {
            Object.assign(row, t);
            typed = true;
            // "Dive bar", "brewery": a venue type too (#262).
            const types = t.group_type === "venue" ? guessVenueTypes(raw) : [];
            if (types.length) {
              row.venue.venue_types = readVenueTypes([...(row.venue.venue_types ?? []), ...types]);
              row.venue.space = spaceFor(row.venue.venue_types, false, row.venue.space);
            }
          } else note();
          return;
        }
        case "town":
          row.town = raw;
          return;
        case "email":
          if (EMAIL.test(raw)) row.email ??= raw;
          else note();
          return;
        case "phone":
          row.phone ??= raw;
          return;
        case "link": {
          const url = toUrl(raw);
          if (url) row.links.push({ label: detectLinkType(url), url });
          else note();
          return;
        }
        case "instagram": {
          const url = instagramUrl(raw);
          if (url) row.links.push({ label: "Instagram", url });
          else note();
          return;
        }
        case "booking":
          return readBooking(raw, row) || note();
        case "address":
          row.venue.address = raw;
          return;
        case "ages": {
          const ages = readAges(raw);
          if (ages) row.venue.ages = ages;
          else note();
          return;
        }
        case "capacity": {
          const cap = readCapacity(raw);
          if (cap) row.venue.capacity = cap;
          else note();
          return;
        }
        case "space": {
          const space = readSpace(raw);
          const types = guessVenueTypes(raw);
          if (types.length) {
            row.venue.venue_types = readVenueTypes([...(row.venue.venue_types ?? []), ...types]);
            row.venue.space = spaceFor(row.venue.venue_types, false, space);
          } else if (space) row.venue.space = space;
          else note();
          return;
        }
        case "pa":
        case "sound":
        case "backline": {
          const yn = yesNo(raw);
          if (yn === undefined) note();
          else row.venue[target] = yn;
          return;
        }
        case "accessibility":
          row.venue.accessibility = raw;
          return;
        case "special_terms":
          row.venue.special_terms = row.venue.special_terms ? `${row.venue.special_terms}; ${raw}` : raw;
          return;
        case "scenes":
          row.scenes.push(...raw.split(/\s*[,;/]\s*/).filter(Boolean));
          return;
        case "status": {
          const st = readStatus(raw);
          if (st) row.status = st;
          else note();
          return;
        }
        case "played": {
          const yn = yesNo(raw);
          if (yn === undefined) note();
          else row.played_together = yn;
          return;
        }
      }
    });

    if (!row.name) return skipped.push({ line, reason: "No name" });
    if (!typed) return skipped.push({ line, reason: `${row.name}: the Type column doesn't say what it is` });
    const key = matchKey(row.name);
    if (seen.has(key)) return skipped.push({ line, reason: `${row.name}: same name as line ${seen.get(key)}` });
    seen.set(key, line);

    // Venue details only mean something on a venue; elsewhere they're notes.
    if (row.group_type !== "venue" && Object.keys(row.venue).length) {
      notes.push(...Object.entries(row.venue).map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`));
      row.venue = {};
    }
    if (row.group_type !== "venue" && row.booked_by.length) {
      notes.push(`Booked by: ${row.booked_by.join(", ")}`);
      row.booked_by = [];
    }
    if (unsure.length) notes.push(`Not sure: ${unsure.join("; ")}`);
    row.notes = notes.length ? notes.join("\n") : null;
    row.scenes = [...new Set(row.scenes)];
    rows.push(row);
  });

  return { rows, skipped };
}

// A booking cell holds an email, a handle, a link, or just how ("Instagram").
function readBooking(raw: string, row: DraftRow): boolean {
  const t = raw.trim();
  if (EMAIL.test(t)) {
    row.email ??= t;
    row.venue.book_via ??= "email";
    return true;
  }
  const url = toUrl(t);
  if (url) {
    const type = detectLinkType(url);
    row.links.push({ label: type, url });
    row.venue.book_via ??= type === "Instagram" ? "instagram" : /facebook\.com/i.test(url) ? "facebook" : "form";
    return true;
  }
  if (/^@[a-z0-9._]{2,30}$/i.test(t)) {
    row.links.push({ label: "Instagram", url: `https://instagram.com/${t.slice(1)}` });
    row.venue.book_via ??= "instagram";
    return true;
  }
  const via = /insta|^ig\b|\bdm\b/i.test(t)
    ? "instagram"
    : /facebook|^fb\b/i.test(t)
      ? "facebook"
      : /form/i.test(t)
        ? "form"
        : /in person|at the (bar|door)|ask/i.test(t)
          ? "in_person"
          : /^e-?mail$/i.test(t)
            ? "email"
            : null;
  if (!via) return false;
  row.venue.book_via ??= via;
  return true;
}
