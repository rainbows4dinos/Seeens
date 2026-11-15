// Look up (#321), outside the app: fill in band, venue, and label details
// from public pages.
//
//   npm run look-up -- path/to/seeens-export.csv [--limit 20] [--only BND-0042,BND-0057]
//     [--types band,venue,label] [--fresh] [--dry-run]
//
// Reads a Seeens export (Directory > Export), looks up the bands, venues, and
// labels missing an Instagram, Bandcamp (not venues), website, or email, and
// writes <export>.look-up.csv
// next to it. Check that sheet, delete anything wrong, then bring it in with
// Import: the catalog numbers fill in exactly those records, blanks only, and
// the photo column's links go through the copier for listings with no photo.
//
// Each one gets one Claude call with web search (3 searches at most), then a
// look at its own website (robots.txt respected, 4 pages at most): a photo
// for bands, the logo for labels, a photo or else the logo for venues.
// Seeens never fetches Bandcamp or Instagram pages. Results are cached for 30
// days in <export>.look-up-cache.json, so running it again only looks up
// what's new. Both files hold real contacts: keep them out of the repo.
//
// Needs ANTHROPIC_API_KEY, in the environment or .env.local.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Papa from "papaparse";
import { needKey, plural, search, sleep, usage } from "./claude-search.ts";
import {
  LOOK_UP_TYPES,
  OUT_COLUMNS,
  gapsFor,
  kindOf,
  promptFor,
  readAnswer,
  readExportRow,
  robotsAllow,
  rowFor,
  scanSite,
  type Answer,
  type ExportBand,
  type LookUpType,
  type OutRow,
  type SiteScan,
} from "../src/lib/look-up/parse.ts";

const MAX_SEARCHES = 3;
const MAX_PAGES = 4;
const CACHE_DAYS = 30;
const USER_AGENT = "SeeensLookUp/0.1 (+https://www.seeens.com)";

type Cached = { day: string; row: OutRow | null; note: string };

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find(
  (a, i) => !a.startsWith("--") && !["--limit", "--only", "--out", "--types"].includes(args[i - 1]),
);
if (!input || !existsSync(input)) {
  console.error(
    "Usage: npm run look-up -- path/to/seeens-export.csv [--limit 20] [--only BND-0042] [--types band,venue,label] [--fresh] [--dry-run]",
  );
  process.exit(1);
}
const limit = Number(option("limit") ?? 20);
const types = (option("types") ?? LOOK_UP_TYPES.join(","))
  .split(",")
  .map((t) => t.trim().toLowerCase().replace(/s$/, ""))
  .filter((t): t is LookUpType => (LOOK_UP_TYPES as string[]).includes(t));
const only = option("only")
  ?.split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const out = option("out") ?? input.replace(/\.csv$/i, "") + ".look-up.csv";
const cachePath = out.replace(/\.csv$/i, "") + "-cache.json";
const dryRun = flag("dry-run");
if (!dryRun) needKey();

// Your own date, not UTC's: an evening run is still today.
const today = new Date().toLocaleDateString("en-CA");
const cache: Record<string, Cached> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
const fresh = (c: Cached | undefined) =>
  c && !flag("fresh") && (Date.parse(today) - Date.parse(c.day)) / 86_400_000 < CACHE_DAYS;

const parsed = Papa.parse<Record<string, string>>(readFileSync(input, "utf8"), {
  header: true,
  skipEmptyLines: "greedy",
});
const bands = parsed.data
  .map(readExportRow)
  .filter((b): b is ExportBand => Boolean(b))
  .filter((b) => types.includes(b.type))
  .filter((b) => !only || only.includes(b.catalogNo.toUpperCase()))
  .map((b) => ({ band: b, gaps: gapsFor(b) }))
  .filter((x) => x.gaps.length);

const todo = bands.filter((x) => !fresh(cache[x.band.catalogNo])).slice(0, limit);
const cached = bands.filter((x) => fresh(cache[x.band.catalogNo])).length;
const waiting = bands.length - cached - todo.length;
console.log(
  [
    `${plural(bands.length, "listing", "listings")} missing details`,
    cached ? `${cached} looked up in the last ${CACHE_DAYS} days` : null,
    `looking up ${todo.length} now`,
    waiting ? `${waiting} left for later runs (--limit ${limit})` : null,
  ]
    .filter(Boolean)
    .join("; ") + ".",
);

for (const { band, gaps } of todo) {
  const prompt = promptFor(band, gaps);
  if (dryRun) {
    console.log(`\n--- ${band.catalogNo} ${band.name}\n${prompt}`);
    continue;
  }
  try {
    const { text, searched } = await search(prompt, { maxSearches: MAX_SEARCHES });
    const answer = readAnswer(text, searched);
    const siteUrl = band.links.find((l) => kindOf(l.url) === "website")?.url ?? answer.found.website?.value ?? null;
    const site = siteUrl ? await scanWebsite(siteUrl) : null;
    const row = rowFor(band, gaps, answer, site, siteUrl, today);
    cache[band.catalogNo] = { day: today, row, note: summary(answer, row) };
    console.log(`${band.catalogNo} ${band.name}: ${cache[band.catalogNo].note}`);
  } catch (e) {
    console.log(`${band.catalogNo} ${band.name}: skipped, ${(e as Error).message}`);
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  await sleep(1000);
}

if (!dryRun) {
  const rows = bands
    .map((x) => cache[x.band.catalogNo])
    .filter((c): c is Cached => Boolean(c?.row))
    // Rows cached before the column was renamed keep their photo.
    .map((c) => ({
      ...c.row!,
      photo: c.row!.photo ?? (c.row as { photo_to_upload?: string }).photo_to_upload ?? "",
      catalog_no: `="${c.row!.catalog_no}"`,
    }));
  writeFileSync(out, Papa.unparse({ fields: OUT_COLUMNS, data: rows.map((r) => OUT_COLUMNS.map((c) => r[c])) }));
  console.log(
    `\n${plural(rows.length, "listing", "listings")} with something to fill in: ${out}` +
      `\nThis run: ${plural(usage.searches, "search", "searches")}, ${usage.tokensIn} input and ${usage.tokensOut} output tokens.` +
      `\nCheck the sheet, delete anything wrong, then Import it as ${importAs(rows.map((r) => r.type))}.`,
  );
}

function summary(a: Answer, row: OutRow | null): string {
  const got = row
    ? (["instagram", "bandcamp", "website", "email", "members", "photo"] as const).filter((k) => row[k])
    : [];
  const parts = [got.length ? `found ${got.join(", ")}` : "nothing to fill in"];
  if (a.dropped.length) parts.push(`left out: ${a.dropped.join("; ")}`);
  return parts.join(". ");
}

// The band's own website: its homepage plus a few contact, about, or press pages.
async function scanWebsite(url: string): Promise<SiteScan | null> {
  if (kindOf(url) !== "website") return null;
  const origin = new URL(url).origin;
  const robots = await get(`${origin}/robots.txt`).catch(() => null);
  const allowed = (u: string) => !robots || robotsAllow(robots, new URL(u).pathname);
  if (!allowed(url)) return null;
  const home = await get(url).catch(() => null);
  if (!home) return null;
  const scan = scanSite(home, url);
  for (const page of scan.pages.slice(0, MAX_PAGES - 1).filter(allowed)) {
    const html = await get(page).catch(() => null);
    if (!html) continue;
    const more = scanSite(html, page);
    scan.emails = [...new Set([...scan.emails, ...more.emails])];
    scan.instagram = [...new Set([...scan.instagram, ...more.instagram])];
    scan.bandcamp = [...new Set([...scan.bandcamp, ...more.bandcamp])];
    // A press or EPK page's photo beats the homepage's share image.
    if (more.image && (/press|epk/i.test(new URL(page).pathname) || !scan.image)) scan.image = more.image;
    scan.logo ??= more.logo;
  }
  return scan;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  // Only the band's own site, even after a redirect.
  if (kindOf(res.url) !== "website") throw new Error("redirected off-site");
  return (await res.text()).slice(0, 2_000_000);
}

// Which choice in Import's "What's in it?": one type, or A Mix (the sheet's
// type column says which).
function importAs(rowTypes: string[]) {
  const kinds = new Set(rowTypes);
  if (kinds.size !== 1) return "A Mix";
  return ({ Band: "Bands", Venue: "Venues", Label: "A Mix" } as Record<string, string>)[[...kinds][0]] ?? "A Mix";
}
