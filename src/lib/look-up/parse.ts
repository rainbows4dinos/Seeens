// Look up (#321), outside the app: the pure parts of scripts/look-up.ts.
// A Seeens export goes in; a sheet the importer fills blanks from comes out.
// Nothing here touches the network, so the tests run it directly.

import { parseLineup } from "../affiliations/lineup.ts";

/** One band from a Seeens export, with what it already has. */
export type ExportBand = {
  catalogNo: string;
  name: string;
  town: string;
  region: string;
  country: string;
  scenes: string[];
  email: string;
  links: { label: string; url: string }[];
};

export type Field = "instagram" | "bandcamp" | "website" | "email";
export const FIELDS: Field[] = ["instagram", "bandcamp", "website", "email"];

/** A value, where it came from, and why we think it's this band. */
export type Finding = { value: string; source: string; why: string };

/** A member as the importer reads one: a name, and roles if the source gave them. */
export type Member = { name: string; roles: string; source: string };

/** What the search call answers, after checking. */
export type Answer = {
  sameBand: boolean;
  confusions: string[];
  found: Partial<Record<Field, Finding>>;
  members: Member[];
  dropped: string[];
};

/** What a band's own website shows. */
export type SiteScan = {
  emails: string[];
  instagram: string[];
  bandcamp: string[];
  image: string | null;
  pages: string[];
};

/** Undo the export's spreadsheet guards, like unwrapCell in lib/import/rows. */
export function unwrap(v: string | undefined): string {
  const t = (v ?? "").trim();
  const text = /^="((?:[^"]|"")*)"$/.exec(t);
  if (text) return text[1].replace(/""/g, '"');
  return /^'[=+\-@\t\r]/.test(t) ? t.slice(1) : t;
}

const split = (v: string) =>
  v
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

/** An export row, or null when it isn't a band we'd look up (another type, or our own band). */
export function readExportRow(row: Record<string, string>): ExportBand | null {
  const get = (k: string) => unwrap(row[k]);
  if (get("kind") !== "group" || !/\bband\b/i.test(get("types")) || get("our_band") === "yes") return null;
  if (get("archived_on")) return null;
  const name = get("name");
  const catalogNo = get("catalog_no");
  if (!name || !catalogNo) return null;
  const links = split(get("links")).map((l) => {
    const m = /^([^:]+):\s+(https?:\/\/\S+)$/i.exec(l);
    return m ? { label: m[1].trim(), url: m[2] } : { label: "", url: l };
  });
  return {
    catalogNo,
    name,
    town: get("town"),
    region: get("region"),
    country: get("country"),
    scenes: split(get("scenes")),
    email: get("email"),
    links,
  };
}

const PLATFORM =
  /(^|\.)(instagram|bandcamp|facebook|spotify|soundcloud|youtube|youtu|subvert|tiktok|twitter|x|linktr|linktree|bsky|threads|apple|music\.apple|tidal|deezer|discogs|songkick|bandsintown|wikipedia)\.[a-z.]+$/i;

function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** What kind of link a URL is, for the fields Look up fills in. */
export function kindOf(url: string): "instagram" | "bandcamp" | "website" | "platform" | null {
  const h = host(url);
  if (!h || !/^https?:/i.test(url)) return null;
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(^|\.)bandcamp\.com$/.test(h)) return "bandcamp";
  if (PLATFORM.test(h)) return "platform";
  return "website";
}

/** The same page however it's written, like private.link_key in the database. */
export function linkKey(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\/(www\.|m\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** An Instagram profile, not a post or a reel; null for anything else. */
export function instagramProfile(url: string): string | null {
  if (kindOf(url) !== "instagram") return null;
  const m = /^\/([a-z0-9._]{1,30})\/?$/i.exec(new URL(url).pathname);
  if (!m || /^(p|reel|reels|explore|stories|accounts|tv)$/i.test(m[1])) return null;
  return `https://instagram.com/${m[1].toLowerCase()}`;
}

/** A Bandcamp artist page (its root), not one album; null for anything else. */
export function bandcampRoot(url: string): string | null {
  if (kindOf(url) !== "bandcamp") return null;
  const h = new URL(url).hostname.toLowerCase();
  if (h === "bandcamp.com" || h === "www.bandcamp.com" || h === "daily.bandcamp.com") return null;
  return `https://${h}`;
}

/** Which fields this band is missing. Website counts only the band's own site. */
export function gapsFor(b: ExportBand): Field[] {
  const kinds = new Set(b.links.map((l) => kindOf(l.url)));
  return FIELDS.filter((f) => (f === "email" ? !b.email : !kinds.has(f)));
}

/** The search prompt: scoped and anchored, never a bare name. */
export function promptFor(b: ExportBand, gaps: Field[]): string {
  const place = [b.town, b.region, b.country].filter(Boolean).join(", ");
  const anchors = [
    place ? `Based in: ${place}` : "Based in: unknown",
    b.scenes.length ? `Scenes: ${b.scenes.join(", ")}` : null,
    ...b.links.map((l) => `Known link: ${l.url}`),
  ].filter(Boolean);
  return [
    `Find public details for this band.`,
    ``,
    `Band: ${b.name}`,
    ...anchors,
    ``,
    `Find: ${gaps.join(", ")}, and its current members.`,
    `- website: the band's own site only (not a label page, link-in-bio page, or streaming profile)`,
    `- email: only an address the band posted publicly for booking or contact`,
    `- members: current members, one per person, with what they play in "role". Use names as the source gives them, stage names included.`,
    ``,
    `Rules:`,
    `- Many bands share a name. Only report something when a source ties it to this band through a known link or the place. Say which anchor matched.`,
    `- Every value needs the URL of the page that shows it. Leave out anything you can't source.`,
    `- If you're not sure it's the same band, say so and report nothing.`,
    `- Keep "why" under 15 words. List at most 3 possible confusions, a few words each.`,
    ``,
    `Answer with only this JSON, in a \`\`\`json block:`,
    `{"same_band": true, "possible_confusions": ["..."],`,
    ` "instagram": {"value": "url", "source": "url", "why": "anchor that matched"} or null,`,
    ` "bandcamp": ..., "website": ..., "email": ...,`,
    ` "members": [{"value": "name", "role": "drums", "source": "url"}]}`,
  ].join("\n");
}

function finding(v: unknown): Finding | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const value = typeof o.value === "string" ? o.value.trim() : "";
  const source = typeof o.source === "string" ? o.source.trim() : "";
  const why = typeof o.why === "string" ? o.why.trim() : "";
  return value && source ? { value, source, why } : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Read the model's JSON and keep only what checks out: every finding cites a
 * page the search actually returned, and each value is the kind of thing it
 * says it is. Everything left out is listed in `dropped`, so it's never silent.
 */
export function readAnswer(text: string, searched: string[]): Answer {
  const out: Answer = { sameBand: false, confusions: [], found: {}, members: [], dropped: [] };
  const block = /```json\s*([\s\S]*?)```/i.exec(text)?.[1] ?? /\{[\s\S]*\}/.exec(text)?.[0];
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(block ?? "");
  } catch {
    out.dropped.push("the answer wasn't readable");
    return out;
  }
  out.sameBand = data.same_band === true;
  out.confusions = Array.isArray(data.possible_confusions)
    ? data.possible_confusions.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  if (!out.sameBand) {
    out.dropped.push("not sure it's the same band");
    return out;
  }

  const seen = new Set(searched.map(linkKey));
  const cited = (f: Finding) => seen.has(linkKey(f.source));

  for (const field of FIELDS) {
    const f = finding(data[field]);
    if (!f) continue;
    if (!cited(f)) {
      out.dropped.push(`${field}: its source wasn't in the search results`);
      continue;
    }
    const value =
      field === "instagram"
        ? instagramProfile(f.value)
        : field === "bandcamp"
          ? bandcampRoot(f.value)
          : field === "website"
            ? kindOf(f.value) === "website"
              ? f.value
              : null
            : EMAIL.test(f.value)
              ? f.value.toLowerCase()
              : null;
    if (!value) out.dropped.push(`${field}: "${f.value}" isn't one`);
    else out.found[field] = { ...f, value };
  }

  const members = Array.isArray(data.members) ? data.members : [];
  const named = new Set<string>();
  for (const m of members) {
    const f = finding(m);
    if (!f) continue;
    if (!cited(f)) {
      out.dropped.push(`member ${f.value}: its source wasn't in the search results`);
      continue;
    }
    // Read like a pasted lineup, so "Kay Test (vox/guitar)" is Kay Test, who
    // plays vocals and guitar, whether the role came separately or not.
    const role = typeof (m as { role?: unknown }).role === "string" ? (m as { role: string }).role.trim() : "";
    const [row] = parseLineup(role ? `${f.value} - ${role}` : f.value);
    if (!row || row.name.length > 120) {
      out.dropped.push(`member "${f.value}" isn't a name`);
      continue;
    }
    if (named.has(row.name.toLowerCase())) continue;
    named.add(row.name.toLowerCase());
    out.members.push({ name: row.name, roles: row.roles, source: f.source });
  }
  return out;
}

/** Whether robots.txt lets anyone ("*") fetch a path. Unreadable rules mean yes. */
export function robotsAllow(txt: string, path: string): boolean {
  let applies = false;
  let inGroup = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (val === "*") applies = true;
      continue;
    }
    inGroup = false;
    if (!applies || !val) continue;
    if (key === "disallow") disallow.push(val);
    if (key === "allow") allow.push(val);
  }
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter((r) => path.startsWith(r)).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}

/** Emails, Instagram and Bandcamp links, the share image, and pages worth a look. */
export function scanSite(html: string, pageUrl: string): SiteScan {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  const abs = (h: string) => {
    try {
      return new URL(h, pageUrl).toString();
    } catch {
      return null;
    }
  };
  const emails = new Set<string>();
  for (const h of hrefs) {
    const m = /^mailto:([^?]+)/i.exec(h);
    if (m && EMAIL.test(decodeURIComponent(m[1]).trim())) emails.add(decodeURIComponent(m[1]).trim().toLowerCase());
  }
  const urls = hrefs.map(abs).filter((u): u is string => Boolean(u));
  const instagram = [...new Set(urls.map(instagramProfile).filter((u): u is string => Boolean(u)))];
  const bandcamp = [...new Set(urls.map(bandcampRoot).filter((u): u is string => Boolean(u)))];
  const site = host(pageUrl);
  const pages = [
    ...new Set(
      urls.filter(
        (u) =>
          host(u) === site &&
          /contact|about|press|epk|bio|booking/i.test(new URL(u).pathname) &&
          linkKey(u) !== linkKey(pageUrl),
      ),
    ),
  ];
  const og =
    /<meta[^>]+property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i.exec(html)?.[1] ??
    null;
  return { emails: [...emails], instagram, bandcamp, image: og ? abs(og.replace(/&amp;/g, "&")) : null, pages };
}

/** One row for the importer: only the blanks, with every source in the notes. */
export type OutRow = {
  catalog_no: string;
  name: string;
  type: string;
  instagram: string;
  bandcamp: string;
  website: string;
  email: string;
  members: string;
  photo_to_upload: string;
  notes: string;
};

export const OUT_COLUMNS: (keyof OutRow)[] = [
  "catalog_no",
  "name",
  "type",
  "instagram",
  "bandcamp",
  "website",
  "email",
  "members",
  "photo_to_upload",
  "notes",
];

/**
 * Put the answer and the site together. The band's own website wins over the
 * search when they disagree, and agreeing is worth saying. Only blanks are
 * filled; members are always offered (the importer skips ones already linked).
 */
export function rowFor(
  b: ExportBand,
  gaps: Field[],
  answer: Answer,
  site: SiteScan | null,
  siteUrl: string | null,
  day: string,
): OutRow | null {
  const notes: string[] = [];
  const pick: Partial<Record<Field, string>> = {};

  for (const field of gaps) {
    const fromSite =
      field === "instagram"
        ? site?.instagram
        : field === "bandcamp"
          ? site?.bandcamp
          : field === "email"
            ? site?.emails
            : undefined;
    const searched = answer.found[field];
    if (fromSite?.length === 1) {
      pick[field] = fromSite[0];
      const agrees = searched && linkKey(searched.value) === linkKey(fromSite[0]);
      notes.push(`${label(field)}: from the band's website (${siteUrl})${agrees ? ", and the search agrees" : ""}`);
      if (searched && !agrees) notes.push(`  The search said ${searched.value} (${searched.source}); the website wins`);
    } else if (searched) {
      pick[field] = searched.value;
      notes.push(`${label(field)}: ${searched.source}${searched.why ? ` (${short(searched.why, 120)})` : ""}`);
    }
  }
  if (gaps.includes("website") && !pick.website && siteUrl) pick.website = siteUrl;

  // One per member, in the importer's terms: "Name - Roles; Name".
  const members = answer.members.map((m) => (m.roles ? `${m.name} - ${m.roles}` : m.name));
  if (members.length) notes.push(`Members: ${[...new Set(answer.members.map((m) => m.source))].join(", ")}`);
  const photo = site?.image ?? "";
  if (photo) notes.push(`Photo: the website's share image; upload it if it's right`);

  if (!Object.keys(pick).length && !members.length && !photo) return null;
  if (answer.confusions.length) {
    notes.push(
      `Not to be confused with: ${answer.confusions
        .slice(0, 3)
        .map((c) => short(c, 80))
        .join("; ")}`,
    );
  }
  notes.unshift(`Look up, ${day}. Sources:`);

  return {
    catalog_no: b.catalogNo,
    name: b.name,
    type: "Band",
    instagram: pick.instagram ?? "",
    bandcamp: pick.bandcamp ?? "",
    website: pick.website ?? "",
    email: pick.email ?? "",
    members: members.join("; "),
    photo_to_upload: photo,
    notes: notes.join("\n"),
  };
}

function short(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function label(f: Field) {
  return { instagram: "Instagram", bandcamp: "Bandcamp", website: "Website", email: "Email" }[f];
}
