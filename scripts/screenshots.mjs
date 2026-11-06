// Captures the README screenshots in docs/screenshots from a local stack.
//
// Needs the seeded local database and a running app:
//   npm run db:start && npm run db:reset   (seed.sql: fictional data only)
//   npm run dev
//   npm run screenshots
//
// First run only: npx playwright install chromium
// Set BASE_URL to point at a different local server.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../docs/screenshots");
const EMAIL = "alex@example.com"; // seed.sql user, local only
const PASSWORD = "password123";

const DESKTOP = { viewport: { width: 1280, height: 860 } };

// Sample photos (AI-generated, fictional people and places) for the seed
// connections, so the screenshots aren't all initials. Each goes through the
// app's own photo copier, like a real upload. Some connections keep their
// initials on purpose. The number lightens dark shots in the copier.
const PHOTOS_DIR = path.resolve(import.meta.dirname, "../supabase/seed-photos");
const PHOTOS = [
  ["The Tin Hollows", "the-tin-hollows.jpg", 0.2],
  ["Glass Coyote", "glass-coyote.jpg"],
  ["Night Gleaners", "night-gleaners.jpg", 0.15],
  ["Dee Sample", "dee-sample.jpg"],
  ["Jo Example", "jo-example.jpg", 0.25],
  ["Morgan Placeholder", "morgan-placeholder.jpg", 0.25],
  ["Static Basement", "static-basement.jpg"],
  ["The Lantern Room", "the-lantern-room.jpg", 0.3],
  ["Grey Static Records", "grey-static-records.jpg"],
  ["KXXX Night Shift", "kxxx-night-shift.jpg", 0.3],
];
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page, name, options = {}) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, name), ...options });
  console.log(`saved ${name}`);
}

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

await mkdir(OUT, { recursive: true });
// Loads a connection's full page. Clicking a directory row opens the quick
// view instead (#126), so go to the row's address directly.
async function openFullPage(page, name) {
  const href = await page.getByRole("link", { name: new RegExp(name) }).first().getAttribute("href");
  await page.goto(`${BASE_URL}${href}`);
}

// Adds each sample photo through the photo copier, skipping any connection
// that already has one, so running the script twice is fine.
async function addPhotos(page) {
  for (const [name, file, lighter = 0] of PHOTOS) {
    await page.goto(`${BASE_URL}/?type=all&layout=list&q=${encodeURIComponent(name)}`);
    // A row click opens the quick view; the photo copier is on the full page.
    await openFullPage(page, name);
    // The print's button says Add or Change; only add where there's none.
    const print = page.getByRole("button", { name: new RegExp(`(Add a|Change the) photo of ${name}`) });
    await print.waitFor();
    const add = page.getByRole("button", { name: `Add a photo of ${name}` });
    if (!(await add.count())) continue;
    await add.click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(path.join(PHOTOS_DIR, file));
    const save = dialog.getByRole("button", { name: "Save Photo" });
    await save.waitFor();
    await page.waitForFunction((el) => !el.disabled, await save.elementHandle());
    if (lighter) await dialog.getByLabel("Lighter / Darker").fill(String(lighter));
    await save.click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    console.log(`photo: ${name}`);
  }
}

const browser = await chromium.launch();
// Hide the Next dev-tools badge so it never lands in a screenshot.
const newContext = browser.newContext.bind(browser);
browser.newContext = async (options) => {
  const context = await newContext(options);
  await context.addInitScript(() =>
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    }),
  );
  return context;
};

try {
  // Signed out
  const anon = await browser.newContext(DESKTOP);
  const login = await anon.newPage();
  await login.goto(`${BASE_URL}/login`);
  await shot(login, "login.png");
  await anon.close();

  // Desktop, signed in
  const desktop = await browser.newContext(DESKTOP);
  const page = await signIn(desktop);
  await addPhotos(page);

  // All, so the first row shows several kinds of connection.
  await page.goto(`${BASE_URL}/?type=all`);
  await shot(page, "directory.png");

  // From 1280 the filter fields sit in the bar, so there's nothing to open.
  await page.goto(`${BASE_URL}/?type=all&status=lets_play`);
  await shot(page, "lets-play.png");

  // A row opens the quick view beside the list.
  await page.goto(`${BASE_URL}/?type=bands`);
  await page.getByRole("link", { name: /The Tin Hollows/ }).first().click();
  await page.getByRole("complementary", { name: "Quick view" }).getByRole("heading", { name: "The Tin Hollows" }).waitFor();
  await shot(page, "quick-view.png");

  await page.goto(`${BASE_URL}/`);
  await openFullPage(page, "The Tin Hollows");
  await shot(page, "connection.png", { fullPage: true });

  await page.goto(`${BASE_URL}/scenes`);
  await shot(page, "scenes.png");

  await page.goto(`${BASE_URL}/follow-ups`);
  await shot(page, "follow-ups.png");

  // Band Settings with one pending invite, then that invite as the person
  // receiving it sees it (signed out).
  await page.goto(`${BASE_URL}/band`);
  await page.getByLabel("Email").fill("jo@example.com");
  await page.getByLabel("Name (Optional)").fill("Jo");
  await page.getByRole("button", { name: "Send Invite" }).click();
  const linkBox = page.getByRole("textbox", { name: "Invite link" });
  await linkBox.waitFor();
  const inviteLink = await linkBox.inputValue();
  await page.goto(`${BASE_URL}/band`);
  await shot(page, "band-settings.png", { fullPage: true });
  await desktop.close();

  const invitee = await browser.newContext(DESKTOP);
  const invitePage = await invitee.newPage();
  await invitePage.goto(inviteLink);
  await shot(invitePage, "invite.png");
  await invitee.close();

  // Mobile, signed in
  const mobile = await browser.newContext(MOBILE);
  const phone = await signIn(mobile);
  await phone.goto(`${BASE_URL}/`);
  await shot(phone, "mobile-directory.png");

  // On a phone the quick view is a sheet under the header.
  await phone.goto(`${BASE_URL}/?type=venues`);
  await phone.getByRole("link", { name: /The Lantern Room/ }).first().click();
  await phone.getByRole("complementary", { name: "Quick view" }).getByRole("heading", { name: "The Lantern Room" }).waitFor();
  await shot(phone, "mobile-quick-view.png");
  await mobile.close();
} finally {
  await browser.close();
}
