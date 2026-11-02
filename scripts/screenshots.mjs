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
const browser = await chromium.launch();

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

  await page.goto(`${BASE_URL}/`);
  await shot(page, "directory.png");

  await page.goto(`${BASE_URL}/?view=lets_play`);
  await page.locator("summary", { hasText: "Filters" }).click();
  await shot(page, "lets-play.png");

  await page.goto(`${BASE_URL}/`);
  await page.getByRole("link", { name: /The Tin Hollows/ }).first().click();
  await page.waitForURL(/\/connections\//);
  await shot(page, "connection.png", { fullPage: true });

  await page.goto(`${BASE_URL}/scenes`);
  await shot(page, "scenes.png");

  await page.goto(`${BASE_URL}/follow-ups`);
  await shot(page, "follow-ups.png");
  await desktop.close();

  // Mobile, signed in
  const mobile = await browser.newContext(MOBILE);
  const phone = await signIn(mobile);
  await phone.goto(`${BASE_URL}/`);
  await shot(phone, "mobile-directory.png");
  await mobile.close();
} finally {
  await browser.close();
}
