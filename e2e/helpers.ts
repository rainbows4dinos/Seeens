import { expect, type Page, type TestInfo } from "@playwright/test";

// seed.sql's local sign-in (fictional, local only).
export const EMAIL = "alex@example.com";
export const PASSWORD = "password123";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** A listing name no other test or run has used, so reruns never collide. */
export function uniqueName(label: string, info: TestInfo) {
  return `Smoke ${label} ${info.project.name} ${Date.now().toString(36)}`;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A listing's row or card in the Directory. */
export function directoryEntry(page: Page, name: string) {
  return page.getByRole("link", { name: new RegExp(escape(name)) }).first();
}

/** Adds a band from the Add page and returns its id, on its new page. */
export async function addBand(page: Page, name: string) {
  await page.goto("/add?type=band");
  await expect(page.getByRole("heading", { name: "Add Band" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add Band" }).click();
  await page.waitForURL(/\/connections\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}
