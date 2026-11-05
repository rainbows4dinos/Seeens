// What people play (#140), read from their band roles ("vocals, guitar").
// Pure and dependency-free: the directory, the person page, and Paste Members
// all use it. The database has the same table (public.instrument_aliases,
// migration 20261105020000), and instruments.test.ts keeps the two in step.

/** Every instrument Seeens recognizes, with its label. Order is display order. */
export const INSTRUMENTS = {
  vocals: "Vocals",
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  keyboards: "Keyboards",
  piano: "Piano",
  organ: "Organ",
  synth: "Synth",
  electronics: "Electronics",
  turntables: "Turntables",
  percussion: "Percussion",
  saxophone: "Saxophone",
  trumpet: "Trumpet",
  trombone: "Trombone",
  clarinet: "Clarinet",
  flute: "Flute",
  violin: "Violin",
  viola: "Viola",
  cello: "Cello",
  banjo: "Banjo",
  mandolin: "Mandolin",
  ukulele: "Ukulele",
  pedal_steel: "Pedal Steel",
  harmonica: "Harmonica",
  accordion: "Accordion",
  theremin: "Theremin",
} as const;

export type Instrument = keyof typeof INSTRUMENTS;

/** How people write each instrument in a role, lowercase. The key itself always counts too. */
export const INSTRUMENT_ALIASES: Record<string, Instrument> = {
  vox: "vocals",
  vocal: "vocals",
  voice: "vocals",
  singer: "vocals",
  singing: "vocals",
  "lead vocals": "vocals",
  "backing vocals": "vocals",
  bvs: "vocals",
  gtr: "guitar",
  gtrs: "guitar",
  guitars: "guitar",
  "lead guitar": "guitar",
  "rhythm guitar": "guitar",
  "acoustic guitar": "guitar",
  "bass guitar": "bass",
  "electric bass": "bass",
  "double bass": "bass",
  "upright bass": "bass",
  drum: "drums",
  kit: "drums",
  keys: "keyboards",
  key: "keyboards",
  keyboard: "keyboards",
  synths: "synth",
  synthesizer: "synth",
  synthesizers: "synth",
  "electronic": "electronics",
  programming: "electronics",
  samples: "electronics",
  laptop: "electronics",
  decks: "turntables",
  perc: "percussion",
  sax: "saxophone",
  "tenor sax": "saxophone",
  "alto sax": "saxophone",
  "baritone sax": "saxophone",
  fiddle: "violin",
  uke: "ukulele",
  "steel guitar": "pedal_steel",
  "lap steel": "pedal_steel",
  "pedal steel": "pedal_steel",
};

// Roles are split on any of these (same as Paste Members).
export const ROLE_SEPARATOR = /\s*(?:\/|,|&|\+|;|\band\b)\s*/i;

/** The instruments in one band role, in the order written: "Vox / keys" -> ["vocals", "keyboards"]. Anything else ("merch") is left out. */
export function instrumentsFromRole(role: string | null | undefined): Instrument[] {
  const out: Instrument[] = [];
  for (const part of (role ?? "").split(ROLE_SEPARATOR)) {
    const key = part.toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ").trim();
    if (!key) continue;
    const found = key in INSTRUMENTS ? (key as Instrument) : (INSTRUMENT_ALIASES[key] ?? null);
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

/** Labels for a list of instruments: ["drums", "bass"] -> "drums and bass". */
export function listInstruments(list: Instrument[], { capitalize = false } = {}) {
  const words = list.map((i) => INSTRUMENTS[i].toLowerCase());
  const text = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : (words[0] ?? "");
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

type Membership = { band: string; role: string | null; current: boolean };

/**
 * What a person plays, from their band memberships (#140), as one line:
 * "Drums in The Tin Hollows · also plays bass". Current bands first; former
 * bands only add instruments not already listed. Null when there's nothing.
 */
export function playsLine(memberships: Membership[]): string | null {
  const current = memberships.filter((m) => m.current);
  const parts = current.map((m) => {
    const plays = instrumentsFromRole(m.role);
    return plays.length ? `${listInstruments(plays, { capitalize: true })} in ${m.band}` : `In ${m.band}`;
  });
  const seen = new Set(current.flatMap((m) => instrumentsFromRole(m.role)));
  const also = [...new Set(memberships.filter((m) => !m.current).flatMap((m) => instrumentsFromRole(m.role)))].filter(
    (i) => !seen.has(i),
  );
  if (also.length) parts.push(`${parts.length ? "also plays" : "Played"} ${listInstruments(also)}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Everything a person plays, current and former bands together, in INSTRUMENTS order. */
export function playsAll(memberships: Membership[]): Instrument[] {
  const all = new Set(memberships.flatMap((m) => instrumentsFromRole(m.role)));
  return (Object.keys(INSTRUMENTS) as Instrument[]).filter((i) => all.has(i));
}
