// What's New (#216): parsing content/changelog.md. Pure, so it's testable;
// changelog.ts reads the file. A day is "## YYYY-MM-DD"; each change is a
// "- " bullet. The format is small on purpose, so the parser is too.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };
export type ChangelogDay = { date: string; items: Inline[][] };

/** The days in a changelog file, in file order (newest first). */
export function parseChangelog(source: string): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  for (const line of source.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const day = line.match(/^## (\d{4}-\d{2}-\d{2})\s*$/);
    if (day) days.push({ date: day[1], items: [] });
    else if (line.startsWith("- ") && days.length) days[days.length - 1].items.push(parseInline(line.slice(2).trim()));
  }
  return days.filter((d) => d.items.length);
}

// **bold**, `code`, and [text](href). Links stay on Seeens or go to https.
function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\(([^)\s]+)\)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1]) out.push({ kind: "bold", text: m[1] });
    else if (m[2]) out.push({ kind: "code", text: m[2] });
    else if (/^(\/|https:\/\/)/.test(m[4])) out.push({ kind: "link", text: m[3], href: m[4] });
    else out.push({ kind: "text", text: m[3] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** "November 11, 2026", read as a calendar date (no time zone shift). */
export function formatChangelogDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
