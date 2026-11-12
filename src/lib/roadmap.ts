import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRoadmap, type RoadmapSection } from "./roadmap-parse";

export type { RoadmapItem, RoadmapSection } from "./roadmap-parse";

// Roadmap (#217): content/roadmap.md, kept by hand. next.config.ts traces
// the file into the server build.
const FILE = path.join(process.cwd(), "content", "roadmap.md");

/** Now, Next, and Later. */
export async function getRoadmap(): Promise<RoadmapSection[]> {
  // Only changes with a deploy, so the page can be built ahead of time.
  "use cache";
  return parseRoadmap(await readFile(FILE, "utf8"));
}
