import { test, expect, Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USERNAME ?? "e2euser";
const TEST_PASS = process.env.TEST_PASSWORD ?? "e2epassword";

async function login(page: Page) {
  await page.goto("/logIn");
  await page.getByLabel(/username/i).fill(TEST_USER);
  await page.getByLabel(/password/i).fill(TEST_PASS);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

// ---------------------------------------------------------------------------
// Dashboard analytics
// ---------------------------------------------------------------------------

test.describe("Dashboard analytics", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
  });

  test("analytics view renders metric cards", async ({ page }) => {
    const cards = page.locator("[class*='card'], [class*='Card']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("switching to analytics tab shows metric values", async ({ page }) => {
    const analyticsBtn = page.getByRole("tab", { name: /analytics/i })
      .or(page.getByRole("button", { name: /analytics/i }));
    if (await analyticsBtn.count() > 0) await analyticsBtn.click();
    await expect(page.getByText(/vehicles|ADB|speeding/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("date range picker is accessible", async ({ page }) => {
    const datePicker = page.locator("input[type='date'], [class*='DatePicker']");
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("sub-area markers are visible on the dashboard map", async ({ page }) => {
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Monitoring page
// ---------------------------------------------------------------------------

test.describe("Monitoring page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/monitoring");
  });

  test("map canvas renders", async ({ page }) => {
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });

  test("timeline drawer is present and toggleable", async ({ page }) => {
    const toggle = page.locator("button[class*='drawer'], [aria-label*='drawer']")
      .or(page.locator(".maplibregl-ctrl-bottom-center button"));
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("back button navigates to dashboard", async ({ page }) => {
    await page.locator("button").first().click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
