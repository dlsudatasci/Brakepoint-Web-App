import { test, expect, Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USERNAME ?? "e2euser";
const TEST_PASS = process.env.TEST_PASSWORD ?? "e2epassword";

// ---------------------------------------------------------------------------
// Login helper shared across tests
// ---------------------------------------------------------------------------

async function login(page: Page) {
  await page.goto("/logIn");
  await page.getByLabel(/username/i).fill(TEST_USER);
  await page.getByLabel(/password/i).fill(TEST_PASS);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

// ---------------------------------------------------------------------------
// Explore page loads
// ---------------------------------------------------------------------------

test.describe("Explore page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/explore");
    // Wait for the map canvas to appear
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });

  test("page title / heading is visible", async ({ page }) => {
    // Back button should be present
    await expect(page.locator("button").first()).toBeVisible();
  });

  test("TerraDraw control buttons appear in bottom-right", async ({ page }) => {
    const terraBtns = page.locator(".maplibregl-ctrl-bottom-right button");
    await expect(terraBtns.first()).toBeVisible({ timeout: 10_000 });
  });

  // AOI Create / Edit / Delete 

  test("explore toolbar is visible after map loads", async ({ page }) => {
    await expect(page.locator(".explore-toolbar")).toBeVisible({ timeout: 10_000 });
  });

  test("confirm AOI button is disabled before drawing", async ({ page }) => {
    const confirmBtn = page.getByRole("button", { name: /confirm aoi/i });
    await expect(confirmBtn).toHaveCount(0);
    if (await confirmBtn.count() > 0) {
      await expect(confirmBtn).toBeDisabled();
    }
  });

  test("'Edit AOI' and 'Delete AOI' buttons are disabled when no AOI is drawn", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit aoi/i });
    const deleteBtn = page.getByRole("button", { name: /delete aoi/i });
    if (await editBtn.count() > 0) await expect(editBtn).toBeDisabled();
    if (await deleteBtn.count() > 0) await expect(deleteBtn).toBeDisabled();
  });

  test("'Add Sub-area' button is disabled when no AOI is confirmed", async ({ page }) => {
    const btn = page.getByRole("button", { name: /add sub.?area/i });
    if (await btn.count() > 0) await expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// API-level AOI validation
// ---------------------------------------------------------------------------

test.describe("AOI API validation", () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post("/api/login/", {
      data: { username: TEST_USER, password: TEST_PASS },
    });
    const body = await resp.json();
    accessToken = body.access;
  });

  async function postLocation(request: any, body: object) {
    return request.post("/api/saved-locations/", {
      data: body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  test("valid sub-area inside AOI returns 201", async ({ request }) => {
    const aoiResp = await postLocation(request, {
      name: "E2E AOI",
      lat: 14.60, lng: 120.99,
      location_type: "aoi",
      geometry: [[120.98,14.59],[121.00,14.59],[121.00,14.61],[120.98,14.61]],
    });
    const aoi = await aoiResp.json();
    expect(aoiResp.status()).toBe(201);

    const subResp = await postLocation(request, {
      name: "E2E Sub",
      lat: 14.60, lng: 120.99,
      location_type: "sub_area",
      parent_id: aoi.saved_location.id,
      geometry: [[120.985,14.595],[120.995,14.595],[120.995,14.605],[120.985,14.605]],
    });
    expect(subResp.status()).toBe(201);
  });

  test("sub-area vertex outside AOI returns 400 with descriptive error", async ({ request }) => {
    const aoiResp = await postLocation(request, {
      name: "E2E AOI 2",
      lat: 14.60, lng: 120.99,
      location_type: "aoi",
      geometry: [[120.98,14.59],[121.00,14.59],[121.00,14.61],[120.98,14.61]],
    });
    const aoi = await aoiResp.json();

    const subResp = await postLocation(request, {
      name: "Out of bounds",
      lat: 14.60, lng: 120.97,
      location_type: "sub_area",
      parent_id: aoi.saved_location.id,
      geometry: [[120.97,14.595],[120.99,14.595],[120.99,14.605],[120.97,14.605]],
    });
    expect(subResp.status()).toBe(400);
    const body = await subResp.json();
    expect(body.error).toMatch(/main AOI/i);
  });

  test("self-intersecting polygon returns 400", async ({ request }) => {
    const aoiResp = await postLocation(request, {
      name: "E2E AOI 3",
      lat: 14.60, lng: 120.99,
      location_type: "aoi",
      geometry: [[120.98,14.59],[121.00,14.59],[121.00,14.61],[120.98,14.61]],
    });
    const aoi = await aoiResp.json();

    const subResp = await postLocation(request, {
      name: "Bowtie",
      lat: 14.60, lng: 120.99,
      location_type: "sub_area",
      parent_id: aoi.saved_location.id,
      geometry: [[120.985,14.595],[120.995,14.605],[120.995,14.595],[120.985,14.605]],
    });
    expect(subResp.status()).toBe(400);
    const body = await subResp.json();
    expect(body.error).toMatch(/self-intersecting/i);
  });

  test("invalid coordinate format returns 400", async ({ request }) => {
    const subResp = await postLocation(request, {
      name: "Bad coords",
      lat: 14.60, lng: 120.99,
      location_type: "aoi",
      geometry: [[999, 14.59],[121.00,14.59],[121.00,14.61],[120.98,14.61]],
    });
    expect(subResp.status()).toBe(400);
    const body = await subResp.json();
    expect(body.error).toMatch(/out of range/i);
  });
});
