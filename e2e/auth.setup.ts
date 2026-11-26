import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";

// Signs in once; the other tests start from this session.
setup("sign in", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: "e2e/.auth/alex.json" });
});
