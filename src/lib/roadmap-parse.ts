// Roadmap (#217): parsing content/roadmap.md. Pure, so it's testable;
// roadmap.ts reads the file. Three sections, "## Now", "## Next", and
// "## Later", each a list of "- " bullets. A bullet ending in "(#123)" links
// that public issue. Inline formatting is the changelog's.
import { parseInline, type Inline } from "./changelog-parse.ts";

export const ROADMAP_SECTIONS = ["Now", "Next", "Later"] as const;
export type RoadmapItem = { parts: Inline[]; issue: number | null };
export type RoadmapSection = { label: (typeof ROADMAP_SECTIONS)[number]; items: RoadmapItem[] };

/** Now, Next, and Later, in that order, each with its items (maybe none). */
export function parseRoadmap(source: string): RoadmapSection[] {
  const sections = ROADMAP_SECTIONS.map((label) => ({ label, items: [] as RoadmapItem[] }));
  let current: RoadmapSection | undefined;
  for (const line of source.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const head = line.match(/^## (.+?)\s*$/);
    if (head) current = sections.find((s) => s.label.toLowerCase() === head[1].toLowerCase());
    else if (line.startsWith("- ") && current) {
      let text = line.slice(2).trim();
      const ref = text.match(/\s*\(#(\d+)\)$/);
      if (ref) text = text.slice(0, ref.index);
      current.items.push({ parts: parseInline(text), issue: ref ? Number(ref[1]) : null });
    }
  }
  return sections;
}
