import { expect, test } from "@playwright/test";
import { addBand, directoryEntry, signIn, uniqueName } from "./helpers";

// The main flows, end to end (#373). Each test makes its own listings with
// names no other run has used, so they can run on a database that isn't fresh.

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign in lands on Home @phone", async ({ page }) => {
    await signIn(page);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { name: "Up Next" })).toBeVisible();
  });
});

test("add a band, then find it in the Directory @phone", async ({ page }, info) => {
  const name = uniqueName("Band", info);
  await addBand(page, name);

  await page.goto(`/directory?type=bands&q=${encodeURIComponent(name)}`);
  await expect(directoryEntry(page, name)).toBeVisible();
});

test("change a status, and the Directory follows", async ({ page }, info) => {
  const name = uniqueName("Status", info);
  await addBand(page, name);

  await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Homies" });
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  // A new band has no status, so it only shows under Homies if the save landed.
  await page.goto(`/directory?type=bands&status=homies&q=${encodeURIComponent(name)}`);
  await expect(directoryEntry(page, name)).toBeVisible();
});

test("import a CSV of bands", async ({ page }, info) => {
  const first = uniqueName("Import A", info);
  const second = uniqueName("Import B", info);

  await page.goto("/import");
  // The file input is in the server's HTML, so a file picked before React
  // hydrates goes unnoticed. Pick it again until the wizard has read it.
  await expect(async () => {
    await page.locator('input[type="file"]').setInputFiles({
      name: "smoke-bands.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`Name,Notes\n${first},Fictional\n${second},Fictional\n`),
    });
    await expect(page.getByText("smoke-bands.csv: 2 rows, 2 columns.")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await page.getByRole("button", { name: "Next" }).click();

  // Columns: Name is guessed from the header.
  await expect(page.getByRole("heading", { name: "Where each column goes" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // No towns in the sheet, so it goes straight to Review.
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await page.getByRole("button", { name: "Import 2" }).click();
  await expect(page.getByText("Added 2.")).toBeVisible();

  await page.getByRole("link", { name: "See Them in the Directory" }).click();
  await expect(directoryEntry(page, first)).toBeVisible();
  await expect(directoryEntry(page, second)).toBeVisible();
});

test("merge two duplicates, then undo", async ({ page }, info) => {
  const name = uniqueName("Twin", info);
  const a = await addBand(page, name);
  const b = await addBand(page, name);

  await page.goto(`/merge?ids=${a}&ids=${b}&keep=${a}`);
  await expect(page.getByRole("heading", { name: `Merge ${name} and ${name}` })).toBeVisible();
  await page.getByRole("button", { name: `Merge ${name} into ${name}` }).click();

  await page.waitForURL(new RegExp(`/connections/${a}\\?merged=1`));
  await page.getByRole("button", { name: "Undo Merge" }).first().click();

  await page.waitForURL(/unmerged=/);
  await expect(page.getByText("Merge undone.")).toBeVisible();
  // Both are back: two listings by that name (a row can have more than one link).
  await page.goto(`/directory?type=bands&q=${encodeURIComponent(name)}`);
  await expect(directoryEntry(page, name)).toBeVisible();
  const listings = async () =>
    new Set(
      (
        await page
          .getByRole("link", { name: new RegExp(name) })
          .evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).pathname))
      ).filter((p) => p.startsWith("/connections/")),
    );
  expect(await listings()).toEqual(new Set([`/connections/${a}`, `/connections/${b}`]));
});
