// Discover (#321), outside the app: who's active in a town you don't know
// well. The pure parts of scripts/discover.ts: a scoped, anchored prompt per
// type, an answer that keeps only what cites a page the search returned, and
// a sheet Import adds as new listings. Nothing here touches the network.

import { matchKey } from "../import/rows.ts";
import { bandcampRoot, instagramProfile, kindOf, linkKey, unwrap, type LookUpType } from "./parse.ts";

const NOUN: Record<LookUpType, string> = { band: "band", venue: "venue", label: "record label" };
const TYPE_LABEL: Record<LookUpType, string> = { band: "Band", venue: "Venue", label: "Label" };

/** What the export already knows: every name (to skip), and who's in this town (anchors). */
export type Known = { names: Set<string>; local: { name: string; type: string; scenes: string[] }[] };

/** The town's own name, for matching export rows: "Olympia, WA" -> "olympia". */
export function townKey(town: string): string {
  return town.split(",")[0].trim().toLowerCase();
}

/** From a Seeens export: names to skip, and listings in (any of) these towns. */
export function readKnown(rows: Record<string, string>[], towns: string[]): Known {
  const keys = new Set(towns.map(townKey));
  const names = new Set<string>();
  const local: Known["local"] = [];
  for (const row of rows) {
    const name = unwrap(row.name);
    if (!name) continue;
    names.add(matchKey(name));
    if (keys.has(unwrap(row.town).toLowerCase())) {
      local.push({
        name,
        type: unwrap(row.types),
        scenes: unwrap(row.scenes)
          .split(/\s*;\s*/)
          .filter(Boolean),
      });
    }
  }
  return { names, local };
}

/**
 * What Seeens is for (#321): DIY and DIY-adjacent, punk and its neighbors.
 * Every Discover prompt keeps to this unless --genres changes it or
 * --any-genre drops it.
 */
export const DEFAULT_FOCUS =
  "punk, post-punk, indie rock, and their neighbors: hardcore, post-hardcore, doom and sludge, noise rock, art rock, no wave, garage, goth and deathrock, synth punk, emo, shoegaze, riot grrrl, queercore, folk punk, power pop, and lo-fi";

/** The focus line: DIY first, in these genres (or any, if focus is empty). */
function focusLine(noun: string, focus: string): string {
  const diy = `DIY ${noun}s first, then DIY-adjacent ones (independent, small, community-run). Skip major-label, corporate, and big touring acts.`;
  return focus ? `${diy} Genres: ${focus}. Skip ones outside these, like jazz, country, cover and tribute acts.` : diy;
}

/** The scenes to keep to: the one asked for, then the ones your listings there are in. */
function scenesFor(known: Known, scene?: string): string[] {
  return [...new Set([...(scene ? [scene] : []), ...known.local.slice(0, 25).flatMap((k) => k.scenes)])].slice(0, 6);
}

/** The search prompt: one type, one town, anchored by who you already know there. */
export function discoverPrompt(
  town: string,
  type: LookUpType,
  known: Known,
  { scene, limit, focus = DEFAULT_FOCUS }: { scene?: string; limit: number; focus?: string },
): string {
  const noun = NOUN[type];
  const here = known.local.slice(0, 25);
  const scenes = scenesFor(known, scene);
  return [
    `List independent and DIY ${noun}s active in or right around ${town}.`,
    type === "venue"
      ? `Rooms that book DIY and DIY-adjacent shows${focus ? ` in these genres: ${focus}` : ""}. Skip arenas and big theaters that mostly book touring headliners.`
      : focusLine(noun, focus),
    scene ? `Focus on this scene: ${scene}.` : scenes.length ? `Scenes we know there: ${scenes.join(", ")}.` : null,
    here.length
      ? `Already known there (use them to find who they play with, and don't list them): ${here.map((k) => `${k.name} (${k.type})`).join("; ")}.`
      : null,
    ``,
    `Find up to ${limit}. ${WHERE[type]}`,
    `Search more than one way: try different words for "${noun}" and the town, and the places above. Don't stop at the first list you find.`,
    ``,
    `Rules:`,
    `- Prefer ones active in the last two years (a show, a release, or a post). Say what and when in "last_seen", or "unknown" if you can't tell; don't leave one out just for that.`,
    `- Only list a ${noun} when a source ties it to ${town} (or a town right next to it). Many names are shared, so say what tied it in "why".`,
    `- Every entry needs the URL of the page that shows it. Leave out anything you can't source.`,
    `- Links (instagram, bandcamp, website) only if a page you found shows them; otherwise null.`,
    `- Keep "why" and "last_seen" under 15 words each.`,
    ``,
    `Answer with only this JSON, in a \`\`\`json block:`,
    `{"found": [{"name": "...", "town": "...", "source": "url", "why": "...", "last_seen": "...",${type === "venue" ? ` "kind": "diy",` : ""}`,
    `  "instagram": "url or null", "bandcamp": "url or null", "website": "url or null"}]}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// Where each type shows up, since a broad search mostly finds venues (#321).
const WHERE: Record<LookUpType, string> = {
  band: `Bands rarely have pages of their own: look at local show listings and venue calendars, Bandcamp pages and tags that name the town, local labels' rosters, community and college radio playlists, and local zines and blogs.`,
  venue: `Look at local show listings, venue calendars, and local zines and blogs. Include DIY spaces, bars, record stores, and all-ages rooms that put on shows. Say what kind each is in "kind": "diy" (house shows, DIY spaces, record stores, all-ages rooms), "bar" (a bar or small club), "theater" (a theater or big room), or "other".`,
  label: `Small labels are often cassette or tape labels, collectives, or a person's Bandcamp label page. Look at Bandcamp label pages that name the town, "released by" credits on local bands' releases, local record stores, and local zines and blogs.`,
};

/**
 * Bands from one venue's recent bills (#321): what a broad search misses.
 * Out-of-town bands come too, with their own home town (or none).
 */
export function venueBillsPrompt(
  town: string,
  venue: { name: string; website?: string },
  known: Known,
  { limit, scene, focus = DEFAULT_FOCUS }: { limit: number; scene?: string; focus?: string },
): string {
  const skip = known.local
    .filter((k) => /band/i.test(k.type))
    .slice(0, 25)
    .map((k) => k.name);
  const scenes = scenesFor(known, scene);
  return [
    `List local bands, based in or right around ${town}, that played shows at ${venue.name} in the last two years.`,
    venue.website ? `Its website: ${venue.website}` : null,
    focusLine("band", focus),
    scenes.length ? `Only bands that fit these scenes: ${scenes.join(", ")}.` : null,
    skip.length ? `Already known (don't list them): ${skip.join("; ")}.` : null,
    ``,
    `Find up to ${limit}. Look at its calendar and past events, show listings for the town, event pages, and flyers posted online.`,
    ``,
    `Rules:`,
    `- Only bands a page shows on a bill at ${venue.name}. Say the date and who they played with in "why".`,
    `- Leave out touring acts from elsewhere, big-name headliners, and tribute or cover bands. They're not the local scene.`,
    `- "town" is the band's own home town, from a page that says so (its Bandcamp, a bio, a listing). If you can't find one in or near ${town}, leave the band out; don't assume it.`,
    `- Every entry needs the URL of the page that shows it. Leave out anything you can't source.`,
    `- Links (instagram, bandcamp, website) only if a page you found shows them; otherwise null.`,
    `- Keep "why" and "last_seen" under 15 words each.`,
    ``,
    `Answer with only this JSON, in a \`\`\`json block:`,
    `{"found": [{"name": "...", "town": "...", "source": "url", "why": "...", "last_seen": "...",`,
    `  "instagram": "url or null", "bandcamp": "url or null", "website": "url or null"}]}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export type Candidate = {
  name: string;
  type: LookUpType;
  town: string;
  source: string;
  why: string;
  lastSeen: string;
  instagram: string;
  bandcamp: string;
  website: string;
  /** For venues: diy, bar, theater, or other. DIY rooms' bills are read first. */
  kind?: string;
};

const VENUE_KINDS = ["diy", "bar", "theater", "other"];

/** Venues to read bills from, smallest first: DIY rooms, then bars; theaters only if that's all there is. */
export function billsOrder<T extends { kind?: string }>(venues: T[]): T[] {
  const rank = (v: T) => ({ diy: 0, bar: 1, other: 2, theater: 3 })[v.kind ?? "other"] ?? 2;
  return [...venues].sort((a, b) => rank(a) - rank(b));
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * The answer's candidates that check out: a source the search returned, not
 * already known, not listed twice. Everything left out is in `dropped`.
 */
export function readDiscoverAnswer(
  text: string,
  searched: string[],
  type: LookUpType,
  /** The town to assume when the answer gives none; null keeps it blank (a venue's bills). */
  town: string | null,
  known: Set<string>,
): { found: Candidate[]; dropped: string[] } {
  const dropped: string[] = [];
  const block = /```json\s*([\s\S]*?)```/i.exec(text)?.[1] ?? /\{[\s\S]*\}/.exec(text)?.[0];
  let data: { found?: unknown };
  try {
    data = JSON.parse(block ?? "");
  } catch {
    return { found: [], dropped: ["the answer wasn't readable"] };
  }
  const seen = new Set(searched.map(linkKey));
  const taken = new Set(known);
  const found: Candidate[] = [];
  for (const raw of Array.isArray(data.found) ? data.found : []) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const name = str(o.name, 120);
    const source = str(o.source, 500);
    if (!name || !source) continue;
    if (!seen.has(linkKey(source))) {
      dropped.push(`${name}: its source wasn't in the search results`);
      continue;
    }
    const key = matchKey(name);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    const site = str(o.website, 500);
    const ownTown = str(o.town, 80).replace(/^null$/i, "");
    // From a venue's bills (town null): no home town, no listing.
    if (town === null && !ownTown) {
      dropped.push(`${name}: no home town given`);
      continue;
    }
    const kind = str(o.kind, 20).toLowerCase();
    found.push({
      name,
      type,
      ...(type === "venue" ? { kind: VENUE_KINDS.includes(kind) ? kind : "other" } : {}),
      town: ownTown || town || "",
      source,
      why: str(o.why),
      lastSeen: str(o.last_seen),
      instagram: instagramProfile(str(o.instagram, 500)) ?? "",
      bandcamp: type === "venue" ? "" : (bandcampRoot(str(o.bandcamp, 500)) ?? ""),
      website: kindOf(site) === "website" ? site : "",
    });
  }
  return { found, dropped };
}

export type DiscoverRow = {
  name: string;
  type: string;
  town: string;
  instagram: string;
  bandcamp: string;
  website: string;
  notes: string;
};

export const DISCOVER_COLUMNS: (keyof DiscoverRow)[] = [
  "name",
  "type",
  "town",
  "instagram",
  "bandcamp",
  "website",
  "notes",
];

/** A row for Import (as A Mix): a new listing, with where it was found in its notes. */
export function discoverRow(c: Candidate, day: string): DiscoverRow {
  return {
    name: c.name,
    type: TYPE_LABEL[c.type],
    town: c.town,
    instagram: c.instagram,
    bandcamp: c.bandcamp,
    website: c.website,
    notes: [
      `Discover, ${day}. Source: ${c.source}${c.why ? ` (${c.why})` : ""}`,
      c.lastSeen ? `Last seen: ${c.lastSeen}` : null,
      c.kind
        ? `Kind: ${{ diy: "DIY space", bar: "bar or small club", theater: "theater", other: "other" }[c.kind] ?? c.kind}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
