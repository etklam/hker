import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";

const enabled = process.env.DIRECTORY_E2E_FIXTURE === "1";
const state =
  process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json";
if (
  process.env.DIRECTORY_ACCEPTANCE === "1" &&
  (!enabled || !existsSync(state))
)
  throw new Error("Phase 8 analytics requires isolated fixture");

test.describe("Phase 8 analytics workflow", () => {
  test.skip(!enabled, "Requires isolated fixture");
  test.use({ storageState: enabled ? state : undefined });

  test("filters by source and inspects a current result without changing history", async ({
    page,
  }) => {
    const query = "虛構分析檢查甲";
    await page.goto("/search");
    const receipt = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/catalog/events") &&
        response.request().method() === "GET",
    );
    await page.reload();
    expect((await receipt).ok()).toBe(true);

    await page.getByLabel("搜尋關鍵字").fill(query);
    const recorded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/catalog/events") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    expect((await recorded).ok()).toBe(true);

    await page.goto("/admin/analytics");
    await page.getByLabel("來源", { exact: true }).selectOption("web");
    const row = page.locator("tbody tr").filter({ hasText: query });
    await expect(row).toBeVisible();
    const historical = await row.locator("td").nth(3).textContent();
    await row.getByRole("button", { name: "查看目前結果" }).click();
    await expect(row.getByText(/檢查時間/)).toBeVisible();
    expect(await row.locator("td").nth(3).textContent()).toBe(historical);
    await expect(row.getByRole("link", { name: "編輯相關標籤" })).toHaveAttribute(
      "href",
      "/admin/tags",
    );
    await expect(row.getByRole("link", { name: "建立收錄草稿" })).toHaveAttribute(
      "href",
      "/admin/listings",
    );
  });
});
