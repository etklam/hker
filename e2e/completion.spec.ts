import { expect, test } from "@playwright/test";

test("anonymous navigation preserves search context without session bootstrap", async ({ page }) => {
  let sessions = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/session") sessions++; });
  await page.route("**/api/auth/session", route => route.abort());
  await page.goto("/search?sort=newest&page=1&tagMatchMode=or&priceMin=0");
  const search = page.url();
  const detail = page.locator('.listing-card a').first();
  await expect(detail).toBeVisible();
  await detail.click();
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).not.toContain("returnTo");
  await page.getByRole("link", { name: "← 返回目錄" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/search" && url.searchParams.get("sort") === "newest");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("newest");
  expect(new URL(page.url()).searchParams.get("priceMin")).toBe("0");
  await page.goto("/categories");
  await page.goto("/tags");
  await page.goto("/");
  expect(sessions).toBe(0);
  expect(search).toContain("priceMin=0");
});

test("sitemaps, disclosures and effective nonce policy", async ({ page, request }) => {
  const index = await request.get("/sitemap.xml");
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain("/sitemaps/0");
  const sitemap = await request.get("/sitemaps/0");
  const xml = await sitemap.text();
  expect(xml).toContain("/listing/");
  expect(xml).not.toContain("returnTo");
  expect(xml).not.toContain("/admin");
  const response = await page.goto("/");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["content-security-policy"]).toContain("'nonce-");
  await page.getByRole("link", { name: "更正或移除", exact: true }).click();
  await expect(page.getByRole("heading", { name: "更正或移除資料" })).toBeVisible();
  await expect(page.getByText("營運者尚未設定更正聯絡方式。目前此頁不接受提交。")).toBeVisible();
});

test("native public search works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/search");
  await page.getByRole("textbox", { name: "搜尋關鍵字" }).fill("完全不存在的虛構名稱");
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.getByText("暫時未有符合的收錄")).toBeVisible();
  await context.close();
});
