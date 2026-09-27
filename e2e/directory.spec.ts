import { test, expect } from "@playwright/test";
test("search form keeps automatic sorting distinct from an explicit selection", async ({ page }) => {
  await page.goto("/search");
  const main = page.getByRole("main");
  await expect(main.getByRole("combobox", { name: "排序", exact: true })).toHaveValue("");
  await main.getByRole("textbox", { name: "搜尋關鍵字", exact: true }).fill("維修");
  await main.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("");
  await main.getByRole("combobox", { name: "排序", exact: true }).selectOption("newest");
  await main.getByRole("button", { name: "套用篩選" }).click();
  await expect(page).toHaveURL(/sort=newest/);
  await main.getByRole("textbox", { name: "搜尋關鍵字", exact: true }).fill("社群");
  await main.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page).toHaveURL(/sort=newest/);
});
test("mobile search explains empty results and invalid filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search?q=phase7-no-matching-fixture");
  await expect(page.getByRole("heading", { name: "暫時未有符合的收錄" })).toBeVisible();
  await page.goto("/search?tagIds=,");
  await expect(page.getByRole("heading", { name: "搜尋條件無效" })).toBeVisible();
  await page.getByRole("link", { name: "重設搜尋" }).click();
  await expect(page.getByRole("heading", { name: "探索香港生活目錄" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test.describe("directory seeded integration browser checks", () => {
  test.skip(
    !process.env.DIRECTORY_E2E_FIXTURE,
    "Run the integration suite against hker_directory_test first",
  );
  test("slug filters are shareable and disabled listings remain private", async ({
    page,
    request,
  }) => {
    await page.goto("/search?q=手提電話&area=kowloon");
    await expect(
      page.getByRole("link", { name: "測試維修店", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "網上社群", exact: true }),
    ).toHaveCount(0);
    const hidden = await request.get("/listing/disabled");
    const hiddenHtml = await hidden.text();
    expect(hiddenHtml).not.toContain("隱藏店");
    expect(hiddenHtml).toContain("noindex");
    await page.goto("/listing/repair-shop");
    await expect(
      page.getByRole("heading", { name: "測試維修店" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Website" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hidden" })).toHaveCount(0);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "測試維修店",
    );
  });
  test("mobile filters collapse and public pages do not overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search");
    await expect(
      page.getByRole("main").locator("details.filters"),
    ).not.toHaveAttribute("open");
    await page.getByRole("main").getByText("篩選條件", { exact: true }).click();
    await expect(
      page.getByRole("main").getByLabel("最低預算（HK$）"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

test('out-of-range pages recover without displaying an impossible page fraction', async ({page}) => {
 await page.goto('/search?page=999');
 await expect(page.getByRole('heading', {name:'這一頁已沒有結果'})).toBeVisible();
 await page.getByRole('link',{name:'返回第一頁'}).click();
 await expect(page.locator('.listing-card').first()).toBeVisible();
});
