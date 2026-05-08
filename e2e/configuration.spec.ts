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
// Configuration page — camera management
// ---------------------------------------------------------------------------

test.describe("Configuration mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/configuration");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });

  test("map renders in configuration mode", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("edit toggle button is present in bottom-right", async ({ page }) => {
    const editBtn = page.locator(".maplibregl-ctrl-bottom-right button").first();
    await expect(editBtn).toBeVisible({ timeout: 8_000 });
  });

  // Camera CRUD via API (bypass UI for speed, verify state) 

  test.describe("Camera API state management", () => {
    let accessToken: string;
    let cameraId: number;

    test.beforeAll(async ({ request }) => {
      const resp = await request.post("/api/login/", {
        data: { username: TEST_USER, password: TEST_PASS },
      });
      accessToken = (await resp.json()).access;
    });

    test("create camera returns 201 with camera data", async ({ request }) => {
      const resp = await request.post("/api/cameras/", {
        data: { lat: 14.60, lng: 120.99, name: "E2E Camera" },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(resp.status()).toBe(201);
      const body = await resp.json();
      expect(body.success).toBe(true);
      cameraId = body.camera.id;
    });

    test("camera appears in camera list after creation", async ({ request }) => {
      const resp = await request.get("/api/cameras/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const ids = (await resp.json()).cameras.map((c: any) => c.id);
      expect(ids).toContain(cameraId);
    });

    test("delete camera removes it from the list", async ({ request }) => {
      await request.delete(`/api/cameras/${cameraId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const resp = await request.get("/api/cameras/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const ids = (await resp.json()).cameras.map((c: any) => c.id);
      expect(ids).not.toContain(cameraId);
    });

    test("deleting camera also removes its associated videos (cascade)", async ({ request }) => {
      const camResp = await request.post("/api/cameras/", {
        data: { lat: 14.60, lng: 120.99 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const cam = (await camResp.json()).camera;

      const { Readable } = await import("stream");
      const file = Buffer.from("\x00".repeat(10));
      const uploadResp = await request.post("/api/upload_and_process/", {
        multipart: {
          file: { name: "test.mp4", mimeType: "video/mp4", buffer: file },
          camera_id: String(cam.id),
          video_name: "cascade_test",
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (uploadResp.status() === 201) {
        const vidId = (await uploadResp.json()).video_id;
        await request.delete(`/api/cameras/${cam.id}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const vidResp = await request.get(`/api/videos/${vidId}/progress/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        expect(vidResp.status()).toBe(404);
      }
    });
  });

  // Polygon assignment 

  test.describe("Polygon & camera association", () => {
    let accessToken: string;
    let cameraId: number;

    test.beforeAll(async ({ request }) => {
      const resp = await request.post("/api/login/", {
        data: { username: TEST_USER, password: TEST_PASS },
      });
      accessToken = (await resp.json()).access;

      const camResp = await request.post("/api/cameras/", {
        data: { lat: 14.60, lng: 120.99 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      cameraId = (await camResp.json()).camera.id;
    });

    test("set polygon on camera", async ({ request }) => {
      const polygon = [[120.985,14.595],[120.990,14.595],[120.990,14.600],[120.985,14.600]];
      const resp = await request.post(`/api/cameras/${cameraId}/polygon/`, {
        data: { polygon },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(resp.status()).toBe(200);
    });

    test("clear polygon from camera", async ({ request }) => {
      const resp = await request.post(`/api/cameras/${cameraId}/polygon/`, {
        data: { polygon: [] },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(resp.status()).toBe(200);
    });

    test.afterAll(async ({ request }) => {
      if (cameraId) {
        await request.delete(`/api/cameras/${cameraId}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    });
  });
});
