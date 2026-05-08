import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * The `webServer` entries spin up both the Django backend and the Next.js
 * frontend automatically before the suite runs.
 *
 * Environment variables expected in CI:
 *   BACKEND_URL   — default http://localhost:8000
 *   FRONTEND_URL  — default http://localhost:3000
 *   TEST_USERNAME — an existing user in the test DB
 *   TEST_PASSWORD — that user's password
 */

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,   
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 120_000,

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: ["--use-gl=egl", "--enable-webgl"],
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: `cd backend && python manage.py runserver 8000 --settings=BrakePoint_Project.e2e_settings`,
      url: `${BACKEND_URL}/api/check-auth/`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "cd frontend/brakepoint_app && npm run dev",
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
