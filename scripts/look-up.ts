// Look up (#321), outside the app: fill in band details from public pages.
//
//   npm run look-up -- path/to/seeens-export.csv [--limit 20] [--only BND-0042,BND-0057] [--fresh] [--dry-run]
//
// Reads a Seeens export (Directory > Export), looks up the bands missing an
// Instagram, Bandcamp, website, or email, and writes <export>.look-up.csv
// next to it. Check that sheet, delete anything wrong, then bring it in with
// Import: the catalog numbers fill in exactly those records, blanks only, and
// the photo column's links go through the copier for listings with no photo.
//
// Each band gets one Claude call with web search (3 searches at most), then a
// look at the band's own website (robots.txt respected, 4 pages at most).
// Seeens never fetches Bandcamp or Instagram pages. Results are cached for 30
// days in <export>.look-up-cache.json, so running it again only looks up
// what's new. Both files hold real contacts: keep them out of the repo.
//
// Needs ANTHROPIC_API_KEY, in the environment or .env.local.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Papa from "papaparse";
import {
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
  type OutRow,
  type SiteScan,
} from "../src/lib/look-up/parse.ts";

const MODEL = process.env.LOOK_UP_MODEL || "claude-sonnet-5-5";
const API = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
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
const input = args.find((a, i) => !a.startsWith("--") && !["--limit", "--only", "--out"].includes(args[i - 1]));
if (!input || !existsSync(input)) {
  console.error(
    "Usage: npm run look-up -- path/to/seeens-export.csv [--limit 20] [--only BND-0042] [--fresh] [--dry-run]",
  );
  process.exit(1);
}
const limit = Number(option("limit") ?? 20);
const only = option("only")
  ?.split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const out = option("out") ?? input.replace(/\.csv$/i, "") + ".look-up.csv";
const cachePath = out.replace(/\.csv$/i, "") + "-cache.json";
const dryRun = flag("dry-run");
const key = process.env.ANTHROPIC_API_KEY;
if (!dryRun && !key) {
  console.error("Set ANTHROPIC_API_KEY (in the environment or .env.local), or use --dry-run.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
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
  .filter((b) => !only || only.includes(b.catalogNo.toUpperCase()))
  .map((b) => ({ band: b, gaps: gapsFor(b) }))
  .filter((x) => x.gaps.length);

const todo = bands.filter((x) => !fresh(cache[x.band.catalogNo])).slice(0, limit);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cached = bands.filter((x) => fresh(cache[x.band.catalogNo])).length;
const waiting = bands.length - cached - todo.length;
console.log(
  [
    `${plural(bands.length, "band", "bands")} missing details`,
    cached ? `${cached} looked up in the last ${CACHE_DAYS} days` : null,
    `looking up ${todo.length} now`,
    waiting ? `${waiting} left for later runs (--limit ${limit})` : null,
  ]
    .filter(Boolean)
    .join("; ") + ".",
);

let searches = 0;
let tokensIn = 0;
let tokensOut = 0;

for (const { band, gaps } of todo) {
  const prompt = promptFor(band, gaps);
  if (dryRun) {
    console.log(`\n--- ${band.catalogNo} ${band.name}\n${prompt}`);
    continue;
  }
  try {
    const { text, searched } = await search(prompt);
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
    .map((c) => ({ ...c.row!, catalog_no: `="${c.row!.catalog_no}"` }));
  writeFileSync(out, Papa.unparse({ fields: OUT_COLUMNS, data: rows.map((r) => OUT_COLUMNS.map((c) => r[c])) }));
  console.log(
    `\n${plural(rows.length, "band", "bands")} with something to fill in: ${out}` +
      `\nThis run: ${plural(searches, "search", "searches")}, ${tokensIn} input and ${tokensOut} output tokens.` +
      `\nCheck the sheet, delete anything wrong, then Import it as Bands.`,
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

// One Claude call with web search. Returns its text and every page it saw.
async function search(prompt: string): Promise<{ text: string; searched: string[] }> {
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: prompt }];
  const searched: string[] = [];
  let text = "";
  for (let turn = 0; turn < 3; turn++) {
    const res = await call({
      model: MODEL,
      max_tokens: 2000,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    });
    tokensIn += res.usage?.input_tokens ?? 0;
    tokensOut += res.usage?.output_tokens ?? 0;
    searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const block of res.content ?? []) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r?.url) searched.push(r.url);
      }
      if (block.type === "text") {
        text += block.text;
        for (const c of block.citations ?? []) if (c?.url) searched.push(c.url);
      }
    }
    // A long search turn can pause; send it back to let it finish.
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  return { text, searched };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(body: unknown, attempt = 0): Promise<any> {
  const res = await fetch(`${API}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": key!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 3) {
    await sleep(Number(res.headers.get("retry-after") ?? 0) * 1000 || 5000 * (attempt + 1));
    return call(body, attempt + 1);
  }
  if (!res.ok) throw new Error(`the API said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
