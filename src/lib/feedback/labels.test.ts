// Beta feedback helpers (#71). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPath, describeBrowser, issueDraftUrl } from "./labels.ts";

test("keeps the path and drops the query string", () => {
  assert.equal(cleanPath("/?type=all&q=Some+Name"), "/");
  assert.equal(cleanPath("/connections/abc#notes"), "/connections/abc");
  assert.equal(cleanPath("https://evil.example/"), null);
  assert.equal(cleanPath("//evil.example"), null);
  assert.equal(cleanPath(null), null);
});

test("describes browsers in plain words", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
  assert.equal(describeBrowser(mac), "Chrome 130 on macOS");
  assert.equal(describeBrowser(iphone), "Safari 18 on iOS");
  assert.equal(describeBrowser(firefox), "Firefox 132 on Windows");
  assert.equal(describeBrowser(null), "Unknown browser");
});

test("drafts an issue without the tester's name", () => {
  const url = new URL(
    issueDraftUrl({
      kind: "bug",
      body: "Save spins forever\nOn the venue page.",
      path: "/connections/abc",
      app_version: "abc1234",
      user_agent: null,
      screen: "390×844",
      error_digest: null,
    }),
  );
  assert.equal(url.origin + url.pathname, "https://github.com/rainbows4dinos/seeens/issues/new");
  assert.equal(url.searchParams.get("title"), "Bug: Save spins forever");
  assert.equal(url.searchParams.get("labels"), "bug");
  const body = url.searchParams.get("body") ?? "";
  assert.match(body, /> Save spins forever\n> On the venue page\./);
  assert.match(body, /- Page: `\/connections\/abc`/);
  assert.match(body, /- Screen: 390×844/);
});
