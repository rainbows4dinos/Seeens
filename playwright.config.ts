import { defineConfig, devices } from "@playwright/test";

// Smoke tests (#373): the main flows, end to end, against a local stack.
// Locally: npm run db:start, npm run dev, then npm run test:e2e.
// CI builds the app and starts it here (see .github/workflows/check.yml).

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // The flows share one seeded database; each test makes its own listings,
  // but one at a time keeps a failure easy to read.
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs in once and saves the session for the other tests.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/alex.json" },
      dependencies: ["setup"],
    },
    {
      // Chromium with a phone's size and user agent; the Directory opens as a
      // list on phones.
      name: "phone",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/alex.json" },
      dependencies: ["setup"],
      grep: /@phone/,
    },
  ],
  webServer: {
    command: CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
