// Venue details (#48): address, ages, capacity, the room, and how to book. Stored in
// connections.attributes (jsonb), so other types can add their own later.
// Every field is optional; a blank one means "not sure" and isn't shown.
// Pure and import-free, so the tests run it directly.

export const AGES = { all_ages: "All ages", "21_plus": "21+", varies: "Varies" } as const;
export const CAPACITY = {
  under_50: "Under 50",
  "50_150": "50–150",
  "150_300": "150–300",
  "300_600": "300–600",
  "600_plus": "600+",
} as const;
export const SPACE = { diy: "DIY", licensed: "Licensed" } as const;

/**
 * What kind of room it is (#262). More than one can apply (a bar that's also
 * an art space). DIY or licensed comes from the type; "either" ones take a
 * DIY toggle. A fixed list, so filters stay clean.
 */
export const VENUE_TYPES = {
  club: { label: "Club or Music Venue", space: "licensed" },
  concert_hall: { label: "Concert Hall", space: "licensed" },
  amphitheater: { label: "Amphitheater", space: "licensed" },
  dive_bar: { label: "Dive Bar", space: "licensed" },
  nice_bar: { label: "Nice Bar", space: "licensed" },
  brewery: { label: "Brewery or Taproom", space: "licensed" },
  restaurant: { label: "Restaurant", space: "licensed" },
  coffee_shop: { label: "Coffee Shop", space: "licensed" },
  record_store: { label: "Record Store", space: "licensed" },
  music_store: { label: "Music Store", space: "licensed" },
  house: { label: "House Shows", space: "diy" },
  underground: { label: "Underground", space: "diy" },
  art_space: { label: "Art Space or Gallery", space: "either" },
  community_space: { label: "Community Space", space: "either" },
  outdoor: { label: "Outdoor or Park", space: "either" },
} as const satisfies Record<string, { label: string; space: "diy" | "licensed" | "either" }>;
export const BOOK_VIA = {
  email: "Email",
  instagram: "Instagram",
  facebook: "Facebook",
  form: "Form",
  in_person: "In person",
} as const;
/** Yes/no facts about the room. Stored as booleans; missing means not sure. */
export const GEAR = { pa: "PA", sound: "Sound engineer", backline: "Backline" } as const;

export type Ages = keyof typeof AGES;
export type Capacity = keyof typeof CAPACITY;
export type Space = keyof typeof SPACE;
export type VenueType = keyof typeof VENUE_TYPES;
export type BookVia = keyof typeof BOOK_VIA;
export type Gear = keyof typeof GEAR;

export type VenueDetails = {
  /** A street address, or "Ask a punk" for a house that keeps it quiet. */
  address?: string;
  ages?: Ages;
  capacity?: Capacity;
  /** What kind of room (#262), in list order. */
  venue_types?: VenueType[];
  /** DIY or licensed: from the types when there are any, else as stored. */
  space?: Space;
  pa?: boolean;
  sound?: boolean;
  backline?: boolean;
  /** How to book. The contact itself is the connection's email or links. */
  book_via?: BookVia;
  accessibility?: string;
  special_terms?: string;
  /** Set by the database when any detail changes: "2026-11-04". */
  checked_on?: string;
};

/** The keys this module owns. Anything else in attributes (an import's leftovers) is kept as is. */
export const VENUE_KEYS = [
  "address",
  "ages",
  "capacity",
  "venue_types",
  "diy",
  "space",
  "pa",
  "sound",
  "backline",
  "book_via",
  "accessibility",
  "special_terms",
] as const;

export const TEXT_LIMITS = { address: 200, accessibility: 300, special_terms: 300 } as const;

const pick = <T extends Record<string, string>>(map: T, v: unknown) =>
  typeof v === "string" && v in map ? (v as keyof T) : undefined;
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);

const TYPE_ORDER = Object.keys(VENUE_TYPES) as VenueType[];

/** Known types, once each, in list order. Accepts an array or "a,b". */
export function readVenueTypes(v: unknown): VenueType[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const set = new Set(raw.map((x) => String(x).trim()));
  return TYPE_ORDER.filter((t) => set.has(t));
}

/**
 * DIY or licensed from the types: any DIY type makes it DIY, then any
 * licensed one makes it licensed. "Either" types alone go by the DIY toggle.
 * No types: whatever was there (an old "Licensed" stays until a type is picked).
 */
export function spaceFor(types: VenueType[], diy: boolean, fallback?: Space): Space | undefined {
  if (!types.length) return fallback;
  if (diy || types.some((t) => VENUE_TYPES[t].space === "diy")) return "diy";
  if (types.some((t) => VENUE_TYPES[t].space === "licensed")) return "licensed";
  return undefined;
}

/** The DIY toggle shows only when every picked type could go either way. */
export function needsDiyToggle(types: VenueType[]) {
  return types.length > 0 && types.every((t) => VENUE_TYPES[t].space === "either");
}

export const venueTypeLabels = (d: VenueDetails) => (d.venue_types ?? []).map((t) => VENUE_TYPES[t].label);

/** Whatever is stored, read safely: unknown values are dropped, not trusted. */
export function readVenueDetails(attributes: unknown): VenueDetails {
  const a = (attributes && typeof attributes === "object" ? attributes : {}) as Record<string, unknown>;
  const d: VenueDetails = {
    address: text(a.address),
    ages: pick(AGES, a.ages),
    capacity: pick(CAPACITY, a.capacity),
    venue_types: (() => {
      const t = readVenueTypes(a.venue_types);
      return t.length ? t : undefined;
    })(),
    space: pick(SPACE, a.space),
    pa: bool(a.pa),
    sound: bool(a.sound),
    backline: bool(a.backline),
    book_via: pick(BOOK_VIA, a.book_via),
    accessibility: text(a.accessibility),
    special_terms: text(a.special_terms),
    checked_on: typeof a.checked_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.checked_on) ? a.checked_on : undefined,
  };
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as VenueDetails;
}

/** Form strings (the select values are "", "yes", "no", or a key) -> details, or field errors. */
export function venueDetailsFromForm(
  raw: Record<(typeof VENUE_KEYS)[number], string>,
): { ok: true; details: VenueDetails } | { ok: false; errors: Partial<Record<(typeof VENUE_KEYS)[number], string>> } {
  const errors: Partial<Record<(typeof VENUE_KEYS)[number], string>> = {};
  for (const [key, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    if (raw[key].trim().length > max) errors[key] = `Keep it under ${max} characters.`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const yesNo = (v: string) => (v === "yes" ? true : v === "no" ? false : undefined);
  const types = readVenueTypes(raw.venue_types);
  return {
    ok: true,
    details: readVenueDetails({
      address: raw.address,
      ages: raw.ages,
      capacity: raw.capacity,
      venue_types: types,
      // The DIY toggle counts only while it shows (every type is "either").
      space: spaceFor(types, needsDiyToggle(types) && raw.diy === "yes", pick(SPACE, raw.space)),
      pa: yesNo(raw.pa),
      sound: yesNo(raw.sound),
      backline: yesNo(raw.backline),
      book_via: raw.book_via,
      accessibility: raw.accessibility,
      special_terms: raw.special_terms,
    }),
  };
}

/** Details -> form strings, for the edit form. */
export function venueDetailsToForm(d: VenueDetails): Record<(typeof VENUE_KEYS)[number], string> {
  const yesNo = (v?: boolean) => (v === true ? "yes" : v === false ? "no" : "");
  return {
    address: d.address ?? "",
    ages: d.ages ?? "",
    capacity: d.capacity ?? "",
    venue_types: (d.venue_types ?? []).join(","),
    diy: d.venue_types && needsDiyToggle(d.venue_types) && d.space === "diy" ? "yes" : "",
    space: d.space ?? "",
    pa: yesNo(d.pa),
    sound: yesNo(d.sound),
    backline: yesNo(d.backline),
    book_via: d.book_via ?? "",
    accessibility: d.accessibility ?? "",
    special_terms: d.special_terms ?? "",
  };
}

/** The directory's detail line for a venue: "All ages · 50–150 cap · DIY". */
export function venueLine(d: VenueDetails): string | null {
  const parts = [
    d.ages ? AGES[d.ages] : null,
    d.capacity ? `${CAPACITY[d.capacity]} cap` : null,
    d.space ? SPACE[d.space] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "PA, backline · no sound engineer": what the room has, then what it doesn't. */
export function gearLine(d: VenueDetails): string | null {
  const keys = Object.keys(GEAR) as Gear[];
  const word = (k: Gear) => (k === "pa" ? "PA" : GEAR[k].toLowerCase());
  const has = keys.filter((k) => d[k] === true).map(word);
  const lacks = keys.filter((k) => d[k] === false).map((k) => `no ${word(k)}`);
  const text = [has.join(", "), lacks.join(", ")].filter(Boolean).join(" · ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

type Contact = { email: string | null; links: { label: string | null; url: string }[] };

/**
 * How to book, pointing at the contact the venue already has: "Email",
 * with its address; "Instagram", with that link. Null when it isn't set.
 */
export function bookLine(d: VenueDetails, c: Contact): { text: string; contact?: string; href?: string } | null {
  if (!d.book_via) return null;
  const text = BOOK_VIA[d.book_via];
  if (d.book_via === "email") return c.email ? { text, contact: c.email, href: `mailto:${c.email}` } : { text };
  const want = d.book_via === "form" ? ["website", "other"] : [d.book_via];
  const link = c.links.find((l) => want.includes((l.label ?? "").toLowerCase()) || hostIs(l.url, d.book_via!));
  return link ? { text, contact: shortUrl(link.url), href: link.url } : { text };
}

function hostIs(url: string, via: BookVia) {
  if (via !== "instagram" && via !== "facebook") return false;
  try {
    return new URL(url).hostname.replace(/^www\./, "").startsWith(via);
  } catch {
    return false;
  }
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** A map search for an address that looks like a street ("123 Main St"), not "Ask a punk". */
export function mapHref(address: string | undefined, town: string | null): string | null {
  if (!address || !/^\d/.test(address)) return null;
  const q = [address, town].filter(Boolean).join(", ");
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`;
}

/** Details older than this many days get a "checked" date, so stale facts show. */
export const STALE_DAYS = 180;

export function isStale(checkedOn: string | undefined, today: string) {
  if (!checkedOn) return false;
  const days = (Date.parse(today) - Date.parse(checkedOn)) / 86_400_000;
  return days > STALE_DAYS;
}
