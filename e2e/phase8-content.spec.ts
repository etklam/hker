import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
const enabled = process.env.DIRECTORY_E2E_FIXTURE === "1";
const state =
  process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json";
if (
  process.env.DIRECTORY_ACCEPTANCE === "1" &&
  (!enabled || !existsSync(state))
)
  throw new Error("Phase 8 requires isolated fixture");
test.describe("Phase 8 content workflow", () => {
  test.skip(!enabled, "Requires isolated fixture");
  test.use({ storageState: enabled ? state : undefined });
  test("maps import, restores plan, publishes exact selection, exports and reads history", async ({
    page,
    request,
  }, testInfo) => {
    const slug = `phase8-browser-${Date.now()}`;
    const name = `虛構批次服務 ${slug}`;
    await page.goto("/admin/imports");
    await page
      .getByLabel("或貼上 CSV／JSON")
      .fill(
        `名稱,slug,category,area,website\n${name},${slug},來源分類,旺角,https://example.test/Exact#section`,
      );
    await page
      .getByText("欄位與分類對照（修改後須重新預覽）", { exact: true })
      .click();
    await page.getByLabel("來源欄位名稱", { exact: true }).fill("名稱");
    await page.getByRole("button", { name: "加入欄位對照" }).click();
    await page.getByLabel("來源值（精確比對）").fill("來源分類");
    await page
      .getByLabel("現有項目", { exact: true })
      .selectOption({ label: "維修服務 · repair" });
    await page.getByRole("button", { name: "加入分類對照" }).click();
    await page.getByRole("button", { name: "解析及預覽", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "確認匯入 1 項" }),
    ).toBeEnabled();
    await page.reload();
    await page.getByText("恢復近期計畫", { exact: true }).click();
    await page.getByRole("button", { name: /恢復$/ }).first().click();
    await expect(page.getByLabel("或貼上 CSV／JSON")).toContainText(name);
    await page.getByRole("button", { name: "確認匯入 1 項" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "已完成" }),
    ).toContainText("新增 1");
    await page.getByRole("button", { name: "查詢操作狀態" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "已完成" }),
    ).toContainText("新增 1");
    await page.goto("/admin/listings");
    await page
      .getByRole("textbox", { name: "搜尋收錄", exact: true })
      .fill(name);
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    await page
      .getByRole("checkbox", { name: `選取${name}`, exact: true })
      .check();
    await page.getByRole("button", { name: "預覽批次變更" }).click();
    await expect(
      page.getByRole("button", { name: "確認變更 1 項" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "確認變更 1 項" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "已完成" }),
    ).toContainText("更新 1");
    const row = page.locator("table.admin-table tr").filter({ hasText: name });
    await row.getByText("近期變更", { exact: true }).click();
    await expect(row.getByText(/publish/)).toBeVisible();
    await page
      .getByRole("checkbox", { name: `選取${name}`, exact: true })
      .check();
    const url = await page
      .getByRole("link", { name: "匯出所選 JSON" })
      .getAttribute("href");
    const download = await request.get(url!);
    expect(download.ok()).toBe(true);
    expect((await download.json()).listings[0].slug).toBe(slug);
    await page.goto(`/listing/${slug}`);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await mkdir(".impeccable/review/phase8", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/imports");
      await page.screenshot({
        path: `.impeccable/review/phase8/import-${width}.png`,
        fullPage: true,
      });
      await page.goto("/admin/listings");
      await page.screenshot({
        path: `.impeccable/review/phase8/bulk-${width}.png`,
        fullPage: true,
      });
      await page.goto("/admin/analytics");
      await expect(page.getByLabel("來源", { exact: true })).toBeVisible();
      await page.screenshot({
        path: `.impeccable/review/phase8/analytics-${width}.png`,
        fullPage: true,
      });
    }
    await testInfo.attach("portable-export", {
      body: await download.body(),
      contentType: "application/json",
    });
  });
});
