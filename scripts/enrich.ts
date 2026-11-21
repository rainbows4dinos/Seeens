// One listing's details from public pages (#321), shared by Look up and
// Discover: one Claude call with web search (3 searches at most), then a look
// at its own website (robots.txt respected, 4 pages at most). Never Bandcamp
// or Instagram pages.

import { search } from "./claude-search.ts";
import {
  kindOf,
  promptFor,
  readAnswer,
  robotsAllow,
  rowFor,
  scanSite,
  type Answer,
  type ExportBand,
  type Field,
  type OutRow,
  type SiteScan,
} from "../src/lib/look-up/parse.ts";

const MAX_SEARCHES = 3;
const MAX_PAGES = 4;
const USER_AGENT = "SeeensLookUp/0.1 (+https://www.seeens.com)";

/** The row for Import (only what was missing), and a one-line summary. */
export async function enrich(
  band: ExportBand,
  gaps: Field[],
  today: string,
): Promise<{ row: OutRow | null; note: string }> {
  const { text, searched } = await search(promptFor(band, gaps), { maxSearches: MAX_SEARCHES });
  const answer = readAnswer(text, searched);
  const siteUrl = band.links.find((l) => kindOf(l.url) === "website")?.url ?? answer.found.website?.value ?? null;
  const site = siteUrl ? await scanWebsite(siteUrl) : null;
  const row = rowFor(band, gaps, answer, site, siteUrl, today);
  return { row, note: summary(answer, row) };
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
export async function scanWebsite(url: string): Promise<SiteScan | null> {
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
