import { test, expect, Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USERNAME ?? "e2euser";
const TEST_PASS = process.env.TEST_PASSWORD ?? "e2epassword";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillLoginForm(page: Page, username: string, password: string) {
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /^login$/i }).click();
}

// ---------------------------------------------------------------------------
// Valid auth flow
// ---------------------------------------------------------------------------

test.describe("Login — valid flow", () => {
  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto("/logIn");
    await fillLoginForm(page, TEST_USER, TEST_PASS);
    await expect(page).toHaveURL(/dashboard/);
  });

  test("dashboard is accessible after login", async ({ page }) => {
    await page.goto("/logIn");
    await fillLoginForm(page, TEST_USER, TEST_PASS);
    await page.waitForURL(/dashboard/);
    await expect(page.getByText(/analytics|monitoring/i).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Invalid auth flows
// ---------------------------------------------------------------------------

test.describe("Login — invalid flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/logIn");
  });

  test("wrong password shows error message", async ({ page }) => {
    await fillLoginForm(page, TEST_USER, "wrongpassword");
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
  });

  test("nonexistent user shows error", async ({ page }) => {
    await fillLoginForm(page, "nobody_at_all", "anypass");
    await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible();
  });

  test("empty form shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /^login$/i }).click();
    const hasError = await page.locator("[aria-invalid='true'], .error, [role='alert']").count() > 0;
    expect(hasError).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sign-up flow
// ---------------------------------------------------------------------------

test.describe("Sign-up", () => {
  const unique = () => `user_${Date.now()}`;

  test("valid sign-up succeeds and redirects to login or dashboard", async ({ page }) => {
    await page.goto("/signUp");
    const username = unique();
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/email/i).fill(`${username}@test.com`);
    await page.getByLabel(/password/i).first().fill("StrongPass99!");
    await page.getByRole("button", { name: /^sign up$/i }).click();
    await expect(page).toHaveURL(/login|logIn|dashboard/, { timeout: 10_000 });
  });

  test("duplicate username shows error", async ({ page }) => {
    await page.goto("/signUp");
    await page.getByLabel(/username/i).fill(TEST_USER);
    await page.getByLabel(/email/i).fill("dup@test.com");
    await page.getByLabel(/password/i).first().fill("StrongPass99!");
    await page.getByRole("button", { name: /^sign up$/i }).click();
    await expect(page.locator("[role='alert'], p").filter({ hasText: /error|already|taken|exist|invalid/i }).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Protected route redirect
// ---------------------------------------------------------------------------

test("unauthenticated visit to /dashboard redirects to login", async ({ page }) => {
  await page.goto("/logIn");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login|logIn/);
});
