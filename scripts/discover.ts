// Discover (#321), outside the app: who's active in a town you don't know well.
//
//   npm run discover -- "Olympia, WA" --export path/to/seeens-export.csv
//     [--types band,venue,label] [--scene punk] [--genres "..."] [--any-genre]
//     [--limit 15] [--venues 4] [--details 40] [--no-details] [--fresh] [--dry-run]
//
// It keeps to DIY and DIY-adjacent bands, labels, and rooms in punk,
// post-punk, indie rock, and their neighbors; --genres replaces that list
// and --any-genre drops it.
//
// For each type, one Claude call with web search (5 searches at most), scoped
// to the town and anchored by the listings your export already has there:
// venues first, then labels, then bands. Bands also come from the recent
// bills of up to --venues venues there (yours, then ones just found, DIY
// rooms first), one call each, since a broad search finds few bands. Only
// local bands with a home town a page shows count there.
// Every entry must cite a page the search returned; anything already in your
// export is left out. Writes discover-<town>-<date>.csv next to the export.
// Check it, delete what's wrong, then Import it as A Mix: they're added as new
// listings with the status you pick, and the source in their notes.
//
// Before writing, the first --details (40) new listings, most recently seen
// first, get what Look up finds (scripts/enrich.ts): missing links, email,
// members for bands, a photo, or a logo for labels. One more call each;
// --no-details skips it.
//
// Results are cached for 30 days per town and search in
// discover-<town>.cache.json. Needs ANTHROPIC_API_KEY, in the environment or
// .env.local.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { needKey, plural, search, sleep, usage } from "./claude-search.ts";
import {
  DISCOVER_COLUMNS,
  discoverPrompt,
  DEFAULT_FOCUS,
  billsOrder,
  discoverRow,
  asExportBand,
  recentFirst,
  withDetails,
  type DiscoverRow,
  venueBillsPrompt,
  readDiscoverAnswer,
  readKnown,
  type Candidate,
} from "../src/lib/look-up/discover.ts";
import { LOOK_UP_TYPES, gapsFor, type LookUpType, type OutRow } from "../src/lib/look-up/parse.ts";
import { enrich } from "./enrich.ts";

const MAX_SEARCHES = 5;
const CACHE_DAYS = 30;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const valued = ["--export", "--types", "--scene", "--limit", "--venues", "--genres", "--details"];
const town = args.find((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]));
const exportPath = option("export");
if (!town || !exportPath || !existsSync(exportPath)) {
  console.error(
    'Usage: npm run discover -- "Olympia, WA" --export path/to/seeens-export.csv [--types band,venue,label] [--scene punk] [--genres "..."] [--any-genre] [--limit 15] [--venues 4] [--details 40] [--no-details] [--fresh] [--dry-run]',
  );
  process.exit(1);
}
const types = (option("types") ?? LOOK_UP_TYPES.join(","))
  .split(",")
  .map((t) => t.trim().toLowerCase().replace(/s$/, ""))
  .filter((t): t is LookUpType => (LOOK_UP_TYPES as string[]).includes(t));
const scene = option("scene");
// DIY first, in punk, post-punk, indie rock and their neighbors, unless
// --genres says otherwise or --any-genre drops it.
const focus = flag("any-genre") ? "" : (option("genres") ?? DEFAULT_FOCUS);
const limit = Math.min(30, Number(option("limit") ?? 15));
// How many venues' recent bills to read for bands (one search call each).
const venueBills = Math.max(0, Math.min(10, Number(option("venues") ?? 4)));
// How many new listings get Look up's details (one search call each, most
// recently seen first). --no-details skips it.
const detailsLimit = flag("no-details") ? 0 : Math.max(0, Math.min(100, Number(option("details") ?? 40)));
const dryRun = flag("dry-run");
if (!dryRun) needKey();

// Your own date, not UTC's: an evening run is still today.
const today = new Date().toLocaleDateString("en-CA");
const slug = town
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const dir = dirname(exportPath);
const out = join(dir, `discover-${slug}-${today}.csv`);
const cachePath = join(dir, `discover-${slug}.cache.json`);

type Cached = { day: string; scene: string; focus?: string; found: Candidate[] };
type Detail = { day: string; row: OutRow | null; note: string };
// Searches and, under detail: keys, Look up's details per listing.
const cache: Record<string, Cached | Detail> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
const fresh = (c: Cached | Detail | undefined): c is Cached =>
  !!c &&
  "found" in c &&
  !flag("fresh") &&
  c.scene === (scene ?? "") &&
  (c.focus ?? DEFAULT_FOCUS) === focus &&
  (Date.parse(today) - Date.parse(c.day)) / 86_400_000 < CACHE_DAYS;

const rows = Papa.parse<Record<string, string>>(readFileSync(exportPath, "utf8"), {
  header: true,
  skipEmptyLines: "greedy",
}).data;
const known = readKnown(rows, [town]);
console.log(
  `${town}: ${plural(known.local.length, "listing", "listings")} already in your export there; looking for ${types.join(", ")}.`,
);

const all: Candidate[] = [];
// One search call, cached for 30 days under its own key, adding what's new.
async function run(cacheKey: string, label: string, prompt: string, type: LookUpType, assumeTown: string | null) {
  if (dryRun) {
    console.log(`\n--- ${label}\n${prompt}`);
    return [];
  }
  let found: Candidate[];
  const hit = cache[cacheKey];
  if (fresh(hit)) {
    found = hit.found;
    console.log(`${label}: ${plural(found.length, "found", "found")} (looked up in the last ${CACHE_DAYS} days)`);
  } else {
    try {
      const { text, searched } = await search(prompt, { maxSearches: MAX_SEARCHES, maxTokens: 4000 });
      const answer = readDiscoverAnswer(text, searched, type, assumeTown, known.names);
      found = answer.found;
      cache[cacheKey] = { day: today, scene: scene ?? "", focus, found };
      writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      console.log(
        `${label}: ${plural(found.length, "new one", "new ones")}${answer.dropped.length ? `. Left out: ${answer.dropped.join("; ")}` : ""}`,
      );
    } catch (e) {
      console.log(`${label}: skipped, ${(e as Error).message}`);
      return [];
    }
    await sleep(1000);
  }
  // Not already known, and not found twice.
  const added = found.filter((c) => !all.some((a) => a.name.toLowerCase() === c.name.toLowerCase()));
  all.push(...added);
  return added;
}

// Venues first, then labels, then bands: a broad search finds venues well,
// and their recent bills are where the town's bands show up (#321).
const order = (["venue", "label", "band"] as LookUpType[]).filter((t) => types.includes(t));
for (const type of order) {
  await run(type, type, discoverPrompt(town, type, known, { scene, limit, focus }), type, town);
  if (type !== "band" || venueBills === 0) continue;
  // The venues to mine: ones you know there, then ones just found.
  // DIY rooms first, then bars; a theater's bills are mostly touring acts.
  const venues = [
    ...known.local.filter((k) => /venue/i.test(k.type)).map((k) => ({ name: k.name })),
    ...billsOrder(all.filter((c) => c.type === "venue")).map((c) => ({
      name: c.name,
      website: c.website || undefined,
    })),
  ].slice(0, venueBills);
  for (const v of venues) {
    await run(
      `band@${v.name.toLowerCase()}`,
      `bands at ${v.name}`,
      venueBillsPrompt(town, v, known, { limit, scene, focus }),
      "band",
      null,
    );
  }
}

if (!dryRun) {
  // Most recently seen first in each type, so the old names sit at the bottom.
  const ordered = recentFirst(all);
  // Then Look up's details for the first --details of them, cached by name.
  let detailed = 0;
  const data: DiscoverRow[] = [];
  for (const [i, c] of ordered.entries()) {
    const row = discoverRow(c, today);
    if (i >= detailsLimit) {
      data.push(row);
      continue;
    }
    const key = `detail:${c.type}:${c.name.toLowerCase()}`;
    const band = asExportBand(c);
    const gaps = gapsFor(band);
    const hit = cache[key] as Detail | undefined;
    if (hit && !flag("fresh") && (Date.parse(today) - Date.parse(hit.day)) / 86_400_000 < CACHE_DAYS) {
      console.log(`${c.name}: ${hit.note} (looked up in the last ${CACHE_DAYS} days)`);
      data.push(withDetails(row, hit.row));
      continue;
    }
    try {
      const { row: more, note } = await enrich(band, gaps, today);
      cache[key] = { day: today, row: more, note };
      writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      console.log(`${c.name}: ${note}`);
      data.push(withDetails(row, more));
      detailed++;
    } catch (e) {
      console.log(`${c.name}: details skipped, ${(e as Error).message}`);
      data.push(row);
    }
  }
  writeFileSync(
    out,
    Papa.unparse({ fields: DISCOVER_COLUMNS, data: data.map((r) => DISCOVER_COLUMNS.map((k) => r[k])) }),
  );
  const rest = Math.max(0, ordered.length - detailsLimit);
  console.log(
    `\n${plural(all.length, "new listing", "new listings")} for ${town}: ${out}` +
      `\nThis run: ${plural(usage.searches, "search", "searches")}, ${usage.tokensIn} input and ${usage.tokensOut} output tokens` +
      ` (details looked up for ${detailed}).` +
      `\nCheck the sheet, delete anything wrong, then Import it as A Mix.` +
      (rest
        ? ` The last ${plural(rest, "listing", "listings")} got no details; run Look up on them after importing.`
        : ""),
  );
}
