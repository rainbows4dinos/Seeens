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

/** The search prompt: one type, one town, anchored by who you already know there. */
export function discoverPrompt(
  town: string,
  type: LookUpType,
  known: Known,
  { scene, limit }: { scene?: string; limit: number },
): string {
  const noun = NOUN[type];
  const here = known.local.slice(0, 25);
  const scenes = [...new Set([...(scene ? [scene] : []), ...here.flatMap((k) => k.scenes)])].slice(0, 6);
  return [
    `List independent and DIY ${noun}s active in or right around ${town}.`,
    scene ? `Focus on this scene: ${scene}.` : scenes.length ? `Scenes we know there: ${scenes.join(", ")}.` : null,
    here.length
      ? `Already known there (use them to find who they play with, and don't list them): ${here.map((k) => `${k.name} (${k.type})`).join("; ")}.`
      : null,
    ``,
    `Find up to ${limit}. Good places to look: local venue calendars and show listings, community and college radio, local zines and blogs, label rosters, and Bandcamp pages that name the town.`,
    ``,
    `Rules:`,
    `- Active means a show, a release, or a post in the last two years. Say what and when in "last_seen".`,
    `- Only list a ${noun} when a source ties it to ${town} (or a town right next to it). Many names are shared, so say what tied it in "why".`,
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
};

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * The answer's candidates that check out: a source the search returned, not
 * already known, not listed twice. Everything left out is in `dropped`.
 */
export function readDiscoverAnswer(
  text: string,
  searched: string[],
  type: LookUpType,
  town: string,
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
    found.push({
      name,
      type,
      town: str(o.town, 80) || town,
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
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
