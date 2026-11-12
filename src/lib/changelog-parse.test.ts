// What's New parsing (#216). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatChangelogDate, parseChangelog } from "./changelog-parse.ts";

test("days and bullets, comments skipped", () => {
  const days = parseChangelog(
    "<!-- notes\n## 2020-01-01\n- hidden -->\n\n## 2026-11-11\n\n- **New.** One.\n- Two.\n\n## 2026-11-10\n- Three.\n",
  );
  assert.deepEqual(
    days.map((d) => [d.date, d.items.length]),
    [
      ["2026-11-11", 2],
      ["2026-11-10", 1],
    ],
  );
});

test("bold, code, and links", () => {
  const [day] = parseChangelog("## 2026-11-11\n- **Bold.** Press `J`, see [Help](/help#shortcuts).\n");
  assert.deepEqual(day.items[0], [
    { kind: "bold", text: "Bold." },
    { kind: "text", text: " Press " },
    { kind: "code", text: "J" },
    { kind: "text", text: ", see " },
    { kind: "link", text: "Help", href: "/help#shortcuts" },
    { kind: "text", text: "." },
  ]);
});

test("only Seeens or https links", () => {
  const [day] = parseChangelog("## 2026-11-11\n- [bad](javascript:alert(1)) [ok](https://example.com)\n");
  assert.deepEqual(
    day.items[0].filter((x) => x.kind === "link").map((x) => x.text),
    ["ok"],
  );
});

test("a day with no bullets is left out", () => {
  assert.deepEqual(
    parseChangelog("## 2026-11-11\n\n## 2026-11-10\n- One.\n").map((d) => d.date),
    ["2026-11-10"],
  );
});

test("dates read as calendar dates", () => {
  assert.equal(formatChangelogDate("2026-11-01"), "November 1, 2026");
});

test("the real changelog parses, newest first, every day with entries", () => {
  const days = parseChangelog(readFileSync(new URL("../../content/changelog.md", import.meta.url), "utf8"));
  assert.ok(days.length > 0);
  const dates = days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), "newest first");
  assert.equal(new Set(dates).size, dates.length, "one heading per day");
});
