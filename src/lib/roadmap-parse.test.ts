// Roadmap parsing (#217). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRoadmap } from "./roadmap-parse.ts";

test("Now, Next, Later in order, with issue links pulled off the end", () => {
  const sections = parseRoadmap(
    "<!-- ## Now\n- hidden -->\n## Later\n- **C.** Three.\n## Now\n- **A.** One. (#12)\n- B.\n## Someday\n- skipped\n",
  );
  assert.deepEqual(
    sections.map((s) => [s.label, s.items.length]),
    [
      ["Now", 2],
      ["Next", 0],
      ["Later", 1],
    ],
  );
  assert.equal(sections[0].items[0].issue, 12);
  assert.deepEqual(sections[0].items[0].parts.at(-1), { kind: "text", text: " One." });
  assert.equal(sections[0].items[1].issue, null);
});

test("the real roadmap has no dates and something in Now", () => {
  const source = readFileSync(new URL("../../content/roadmap.md", import.meta.url), "utf8");
  const sections = parseRoadmap(source);
  assert.ok(sections[0].items.length > 0);
  const text = JSON.stringify(sections);
  assert.doesNotMatch(
    text,
    /\b(20\d\d|January|February|March|April|June|July|August|September|October|November|December|Q[1-4])\b/,
  );
});
