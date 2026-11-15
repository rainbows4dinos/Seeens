// Discover (#321), outside the app: who's active in a town you don't know well.
//
//   npm run discover -- "Olympia, WA" --export path/to/seeens-export.csv
//     [--types band,venue,label] [--scene punk] [--limit 15] [--fresh] [--dry-run]
//
// For each type, one Claude call with web search (5 searches at most), scoped
// to the town and anchored by the listings your export already has there.
// Every entry must cite a page the search returned; anything already in your
// export is left out. Writes discover-<town>-<date>.csv next to the export.
// Check it, delete what's wrong, then Import it as A Mix: they're added as new
// listings with the status you pick, and the source in their notes. Run Look
// up on them afterward for emails, members, and photos.
//
// Results are cached for 30 days per town and type in
// discover-<town>.cache.json. Needs ANTHROPIC_API_KEY, in the environment or
// .env.local.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { needKey, plural, search, sleep, usage } from "./claude-search.ts";
import {
  DISCOVER_COLUMNS,
  discoverPrompt,
  discoverRow,
  readDiscoverAnswer,
  readKnown,
  type Candidate,
} from "../src/lib/look-up/discover.ts";
import { LOOK_UP_TYPES, type LookUpType } from "../src/lib/look-up/parse.ts";

const MAX_SEARCHES = 5;
const CACHE_DAYS = 30;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const valued = ["--export", "--types", "--scene", "--limit"];
const town = args.find((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]));
const exportPath = option("export");
if (!town || !exportPath || !existsSync(exportPath)) {
  console.error(
    'Usage: npm run discover -- "Olympia, WA" --export path/to/seeens-export.csv [--types band,venue,label] [--scene punk] [--limit 15] [--fresh] [--dry-run]',
  );
  process.exit(1);
}
const types = (option("types") ?? LOOK_UP_TYPES.join(","))
  .split(",")
  .map((t) => t.trim().toLowerCase().replace(/s$/, ""))
  .filter((t): t is LookUpType => (LOOK_UP_TYPES as string[]).includes(t));
const scene = option("scene");
const limit = Math.min(30, Number(option("limit") ?? 15));
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

type Cached = { day: string; scene: string; found: Candidate[] };
const cache: Record<string, Cached> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
const fresh = (c: Cached | undefined) =>
  c && !flag("fresh") && c.scene === (scene ?? "") && (Date.parse(today) - Date.parse(c.day)) / 86_400_000 < CACHE_DAYS;

const rows = Papa.parse<Record<string, string>>(readFileSync(exportPath, "utf8"), {
  header: true,
  skipEmptyLines: "greedy",
}).data;
const known = readKnown(rows, [town]);
console.log(
  `${town}: ${plural(known.local.length, "listing", "listings")} already in your export there; looking for ${types.join(", ")}.`,
);

const all: Candidate[] = [];
for (const type of types) {
  const prompt = discoverPrompt(town, type, known, { scene, limit });
  if (dryRun) {
    console.log(`\n--- ${type}\n${prompt}`);
    continue;
  }
  let found: Candidate[];
  if (fresh(cache[type])) {
    found = cache[type].found;
    console.log(`${type}: ${plural(found.length, "found", "found")} (looked up in the last ${CACHE_DAYS} days)`);
  } else {
    try {
      const { text, searched } = await search(prompt, { maxSearches: MAX_SEARCHES, maxTokens: 4000 });
      const answer = readDiscoverAnswer(text, searched, type, town, known.names);
      found = answer.found;
      cache[type] = { day: today, scene: scene ?? "", found };
      writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      console.log(
        `${type}: ${plural(found.length, "new one", "new ones")}${answer.dropped.length ? `. Left out: ${answer.dropped.join("; ")}` : ""}`,
      );
    } catch (e) {
      console.log(`${type}: skipped, ${(e as Error).message}`);
      continue;
    }
    await sleep(1000);
  }
  // Not already known, and not found twice under two types.
  for (const c of found) if (!all.some((a) => a.name.toLowerCase() === c.name.toLowerCase())) all.push(c);
}

if (!dryRun) {
  const data = all.map((c) => discoverRow(c, today));
  writeFileSync(
    out,
    Papa.unparse({ fields: DISCOVER_COLUMNS, data: data.map((r) => DISCOVER_COLUMNS.map((k) => r[k])) }),
  );
  console.log(
    `\n${plural(all.length, "new listing", "new listings")} for ${town}: ${out}` +
      `\nThis run: ${plural(usage.searches, "search", "searches")}, ${usage.tokensIn} input and ${usage.tokensOut} output tokens.` +
      `\nCheck the sheet, delete anything wrong, then Import it as A Mix. Run Look up on them afterward for emails, members, and photos.`,
  );
}
