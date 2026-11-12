import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseChangelog, type ChangelogDay } from "./changelog-parse";

export { formatChangelogDate, type ChangelogDay, type Inline } from "./changelog-parse";

// What's New (#216): content/changelog.md, written by hand as part of
// shipping. next.config.ts traces the file into the server build.
const FILE = path.join(process.cwd(), "content", "changelog.md");

/** The days, newest first, as the file has them. */
export async function getChangelog(): Promise<ChangelogDay[]> {
  // Only changes with a deploy, so the page can be built ahead of time.
  "use cache";
  return parseChangelog(await readFile(FILE, "utf8"));
}

/** The newest entry's date, or null when there are none. */
export async function latestChangelogDate() {
  return (await getChangelog())[0]?.date ?? null;
}
