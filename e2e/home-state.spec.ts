import { test, expect } from "@playwright/test";
const enabled = process.env.DIRECTORY_E2E_FIXTURE === "1";
test.describe("home catalog states", () => {
  test.skip(!enabled, "Requires isolated directory fixture");
  test.use({ storageState: enabled ? process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json" : undefined });
  test("distinguishes no featured content from a genuinely empty catalog", async ({ page, request }, testInfo) => {
    const origin = new URL(testInfo.project.use.baseURL as string).origin;
    const headers = { origin };
    const rows = (await (await request.get("/api/admin/catalog?pageSize=100&status=enabled")).json()).items;
    try {
      for (const row of rows.filter((item: { featured: boolean }) => item.featured)) {
        const response = await request.post("/api/admin/catalog", { headers, data: { kind: "listings", id: row.id, data: { ...row, priceMin: row.priceMin === null ? null : Number(row.priceMin), priceMax: row.priceMax === null ? null : Number(row.priceMax), featured: false, tagIds: row.tags.map((tag: { id: number }) => tag.id) } } });
        expect(response.ok()).toBe(true);
      }
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "最新收錄" })).toBeVisible();
      await expect(page.locator(".listing-card").first()).toBeVisible();
      const current = (await (await request.get("/api/admin/catalog?pageSize=100&status=enabled")).json()).items;
      for (const row of current) {
        const response = await request.patch("/api/admin/catalog", { headers, data: { action: "publish", kind: "listings", id: row.id, revision: row.revision, enabled: false } });
        expect(response.ok()).toBe(true);
      }
      await page.reload();
      await expect(page.getByRole("heading", { name: "目錄準備中" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "暫時未有符合的收錄" })).toHaveCount(0);
    } finally {
      for (const row of rows) {
        const all = (await (await request.get("/api/admin/catalog?pageSize=100")).json()).items;
        const item = all.find((item: {id:number}) => item.id === row.id);
        if (item) expect((await request.post("/api/admin/catalog", { headers, data: { kind: "listings", id: row.id, data: { ...item, priceMin: item.priceMin === null ? null : Number(item.priceMin), priceMax: item.priceMax === null ? null : Number(item.priceMax), enabled: row.enabled, featured: row.featured, tagIds: row.tags.map((tag: {id:number})=>tag.id) } } })).ok()).toBe(true);
      }
    }
  });
});
