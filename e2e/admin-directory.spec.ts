import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const statePath = resolve(
  process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json",
);
const enabled = process.env.DIRECTORY_E2E_FIXTURE === "1";
if (enabled && !existsSync(statePath))
  throw new Error(
    "Run scripts/e2e-fixture.ts against the isolated test database before acceptance E2E",
  );

test.describe("directory admin acceptance", () => {
  test.skip(
    !enabled,
    "Requires isolated directory fixture and admin browser state",
  );
  test.use({ storageState: enabled ? statePath : undefined });

  test("creates, edits, publishes and preserves stable links", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    const name = `瀏覽器驗收 ${suffix}`;
    await page.goto("/admin/listings");
    await page.getByRole("button", { name: "新增收錄", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("名稱", { exact: true }).fill(name);
    await dialog.getByRole("button", { name: "由名稱產生網址代稱" }).click();
    await expect(
      dialog.getByLabel("網址代稱（英文小寫及連字號）"),
    ).not.toHaveValue("");
    await dialog.getByLabel("搜尋別名（每行一個）").fill(`alias-${suffix}`);
    await dialog.getByLabel("搜尋標籤或別名").fill("手提電話");
    await dialog.getByText("手機", { exact: true }).click();
    await dialog.getByRole("button", { name: "新增連結" }).click();
    await dialog
      .getByLabel("網址", { exact: true })
      .fill("https://example.com/Branch#Contact");
    await dialog.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("textbox", { name: "搜尋收錄", exact: true }).fill(name);
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    const firstResponse = await request.get(
      `/api/admin/catalog?q=${encodeURIComponent(name)}`,
    );
    const first = (await firstResponse.json()).items[0];
    try {
      await row.getByRole("button", { name: "編輯", exact: true }).click();
      await dialog.getByLabel("簡介", { exact: true }).fill("已修改的簡介");
      await dialog.getByRole("button", { name: "儲存", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await row.getByRole("button", { name: "發佈", exact: true }).click();
      await expect(
        row.getByRole("button", { name: "取消發佈", exact: true }),
      ).toBeVisible();
      const updated = (
        await (
          await request.get(`/api/admin/catalog?q=${encodeURIComponent(name)}`)
        ).json()
      ).items[0];
      expect(updated.links[0].id).toBe(first.links[0].id);
      expect(updated.links[0].url).toBe("https://example.com/Branch#Contact");
      expect(updated.aliases).toContain(`alias-${suffix}`);
      await page.goto(`/listing/${updated.slug}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "官方網站" }),
      ).toHaveAttribute("href", `/out/${first.links[0].id}?source=web`);
      await page.goto("/admin/listings");
      await page.getByRole("textbox", { name: "搜尋收錄", exact: true }).fill(name);
      await page.getByRole("button", { name: "搜尋", exact: true }).click();
      await row.getByRole("button", { name: "取消發佈", exact: true }).click();
      await expect(row.getByRole("button", { name: "發佈", exact: true })).toBeVisible();
      const unpublished = await request.get(`/listing/${updated.slug}`);
      expect(await unpublished.text()).not.toContain(name);
    } finally {
      await request.delete("/api/admin/catalog", {
        data: { kind: "listings", id: first.id },
        headers: {
          origin: new URL(
            (testInfo.project.use.baseURL as string) ||
              process.env.E2E_BASE_URL ||
              "http://localhost:3000",
          ).origin,
        },
      });
    }
  });

  test("retains stale draft, protects unsaved changes and restores focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/listings");
    const edit = page
      .getByRole("row")
      .filter({ hasText: "測試維修店" })
      .getByRole("button", { name: "編輯", exact: true });
    await edit.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("名稱", { exact: true }).fill("不可遺失的草稿");
    await page.route("**/api/admin/catalog", async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "此收錄已被更新" }),
        });
      else await route.continue();
    });
    await dialog.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("你的草稿已保留");
    await expect(dialog.getByLabel("名稱", { exact: true })).toHaveValue(
      "不可遺失的草稿",
    );
    page.once("dialog", (prompt) => prompt.dismiss());
    await dialog.getByRole("button", { name: "關閉編輯器" }).click();
    await expect(dialog).toBeVisible();
    page.once("dialog", (prompt) => prompt.accept());
    await dialog.getByRole("button", { name: "關閉編輯器" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(edit).toBeFocused();
  });

  test("two editor tabs cannot overwrite a newer save", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    const name = `雙分頁衝突 ${suffix}`;
    const origin = new URL(
      (testInfo.project.use.baseURL as string) ||
        process.env.E2E_BASE_URL ||
        "http://localhost:3000",
    ).origin;
    const createdResponse = await request.post("/api/admin/catalog", {
      headers: { origin },
      data: {
        kind: "listings",
        data: { name, slug: `two-tab-${suffix}` },
      },
    });
    expect(createdResponse.ok()).toBe(true);
    const created = await createdResponse.json();
    const second = await page.context().newPage();
    const openEditor = async (target: typeof page) => {
      await target.goto("/admin/listings");
      await target.getByRole("textbox", { name: "搜尋收錄" }).fill(name);
      await target.getByRole("button", { name: "搜尋", exact: true }).click();
      await target
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("button", { name: "編輯", exact: true })
        .click();
      return target.getByRole("dialog");
    };
    try {
      const [firstDialog, secondDialog] = await Promise.all([
        openEditor(page),
        openEditor(second),
      ]);
      await firstDialog.getByLabel("簡介", { exact: true }).fill("第一分頁已儲存");
      await secondDialog.getByRole("textbox", { name: "簡介", exact: true }).fill("第二分頁舊草稿");
      await firstDialog.getByRole("button", { name: "儲存", exact: true }).click();
      await expect(firstDialog).not.toBeVisible();
      await secondDialog.getByRole("button", { name: "儲存", exact: true }).click();
      await expect(secondDialog.getByRole("alert")).toContainText("草稿已保留");
      await expect(secondDialog.getByRole("textbox", { name: "簡介", exact: true })).toHaveValue(
        "第二分頁舊草稿",
      );
      const latest = (
        await (
          await request.get(`/api/admin/catalog?q=${encodeURIComponent(name)}`)
        ).json()
      ).items[0];
      expect(latest.shortDescription).toBe("第一分頁已儲存");
    } finally {
      await second.close();
      await request.delete("/api/admin/catalog", {
        headers: { origin },
        data: { kind: "listings", id: created.id },
      });
    }
  });

  test("rejects taxonomy dependency deletion and offers disable", async ({
    page,
  }) => {
    await page.goto("/admin/categories");
    const row = page.getByRole("row").filter({ hasText: "維修服務" });
    page.once("dialog", (prompt) => prompt.accept());
    await row.getByRole("button", { name: "刪除", exact: true }).click();
    await expect(
      page.locator(".admin-content").getByRole("alert"),
    ).toContainText("受影響");
    await expect(
      row.getByRole("button", { name: "停用", exact: true }),
    ).toBeVisible();
  });

  test("OR navigation remains editable and search survives back navigation", async ({
    page,
  }) => {
    const fixture = JSON.parse(
      readFileSync(`${statePath}.fixture.json`, "utf8"),
    );
    await page.goto(`/search?preset=${fixture.presetId}`);
    const main = page.getByRole("main");
    const filters = main.locator("details.filters");
    await expect(filters).toHaveCount(1);
    if ((page.viewportSize()?.width ?? 1280) <= 760) {
      await expect(filters).not.toHaveAttribute("open");
      await filters.locator("summary").click();
    } else await expect(filters).toHaveAttribute("open");
    await expect(
      main.getByRole("combobox", { name: "標籤配對", exact: true }),
    ).toHaveValue("or");
    await main
      .getByRole("combobox", { name: "精選收錄", exact: true })
      .selectOption("true");
    await main.getByRole("button", { name: "套用篩選" }).click();
    await expect(page).toHaveURL(/tagMatchMode=or/);
    await expect(page).toHaveURL(/featured=true/);
    expect(new URL(page.url()).searchParams.has("preset")).toBe(false);
    await main.getByRole("link", { name: "移除 精選", exact: true }).click();
    await expect(page).not.toHaveURL(/featured=true/);
    await page.goBack();
    await expect(page).toHaveURL(/featured=true/);
    await expect(
      main.getByRole("combobox", { name: "精選收錄", exact: true }),
    ).toHaveValue("true");
    await expect(
      main.getByRole("link", { name: "移除 精選", exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(page).not.toHaveURL(/featured=true/);
    await expect(
      main.getByRole("combobox", { name: "精選收錄", exact: true }),
    ).toHaveValue("");
    await page.goBack();
    await expect(page).toHaveURL(/featured=true/);
    await expect(
      main.getByRole("combobox", { name: "精選收錄", exact: true }),
    ).toHaveValue("true");
  });
  test("reorders a filtered visible set without changing an unseen row", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000")
      .origin;
    const rows = [];
    for (const [index, name] of [
      `重排 ${suffix} A`,
      `重排 ${suffix} B`,
      `其他 ${suffix}`,
    ].entries()) {
      const response = await request.post("/api/admin/catalog", {
        headers: { origin },
        data: {
          kind: "listings",
          data: {
            name,
            slug: `reorder-${suffix}-${index}`,
            sortOrder: index * 10,
          },
        },
      });
      expect(response.ok()).toBe(true);
      rows.push(await response.json());
    }
    try {
      await page.goto("/admin/listings");
      await page.getByRole("textbox", { name: "搜尋收錄", exact: true }).fill(`重排 ${suffix}`);
      await page.getByRole("button", { name: "搜尋", exact: true }).click();
      await page
        .getByRole("button", { name: `上移重排 ${suffix} B`, exact: true })
        .click();
      await expect
        .poll(async () => {
          const result = await request.get(
            `/api/admin/catalog?q=${encodeURIComponent(`重排 ${suffix}`)}`,
          );
          return (await result.json()).items[0].id;
        })
        .toBe(rows[1].id);
      const unseen = (
        await (
          await request.get(
            `/api/admin/catalog?q=${encodeURIComponent(`其他 ${suffix}`)}`,
          )
        ).json()
      ).items[0];
      expect(unseen.sortOrder).toBe(20);
    } finally {
      for (const row of rows)
        await request.delete("/api/admin/catalog", {
          headers: { origin },
          data: { kind: "listings", id: row.id },
        });
    }
  });

  test("returns to the previous page after deleting its final item without clearing filters", async ({ page, request }) => {
    const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin;
    const prefix = `pagination-${Date.now()}`;
    const ids: number[] = [];
    try {
      for (let index = 0; index < 21; index++) {
        const response = await request.post("/api/admin/catalog", { headers: { origin }, data: { kind: "listings", data: { name: `${prefix} ${index}`, slug: `${prefix}-${index}` } } });
        expect(response.ok()).toBe(true);
        ids.push((await response.json()).id);
      }
      await page.goto("/admin/listings");
      await page.getByRole("textbox", { name: "搜尋收錄", exact: true }).fill(prefix);
      await page.getByRole("button", { name: "搜尋", exact: true }).click();
      await expect(page.getByRole("button", { name: "刪除", exact: true })).toHaveCount(20);
      await page.getByRole("button", { name: "下一頁", exact: true }).click();
      await expect(page.getByRole("button", { name: "刪除", exact: true })).toHaveCount(1);
      page.once("dialog", prompt => prompt.accept());
      await page.getByRole("button", { name: "刪除", exact: true }).click();
      await expect(page.getByRole("button", { name: "刪除", exact: true })).toHaveCount(20);
      await expect(page.getByRole("textbox", { name: "搜尋收錄", exact: true })).toHaveValue(prefix);
      await expect(page.getByRole("button", { name: "上一頁", exact: true })).toBeDisabled();
    } finally {
      for (const id of ids) await request.delete("/api/admin/catalog", { headers: { origin }, data: { kind: "listings", id } });
    }
  });

  test("previews and imports mapped taxonomy and multiple links as a draft", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    const name = `CSV 驗收 ${suffix}`;
    const fields = [
      name,
      `csv-e2e-${suffix}`,
      "repair",
      "mong-kok",
      "phone|same-day",
      JSON.stringify([
        {
          type: "website",
          label: "分店",
          url: `https://example.com/Branch-${suffix}#Contact`,
        },
        {
          type: "website",
          label: "支援",
          url: `https://example.com/Support-${suffix}`,
        },
      ]),
      JSON.stringify([`匯入別名 ${suffix}`]),
      JSON.stringify({ 營業時間: "每天" }),
    ];
    const csv = `name,slug,category,area,tags,links,aliases,attrs\n${fields.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")}`;
    await page.goto("/admin/imports");
    await page.getByLabel("或貼上 CSV").fill(csv);
    await page.getByRole("button", { name: "解析及預覽" }).click();
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "確認匯入 1 項" }).click();
    await expect(page.getByRole("status")).toContainText("已匯入 1 項草稿");
    const row = (
      await (
        await request.get(`/api/admin/catalog?q=${encodeURIComponent(name)}`)
      ).json()
    ).items[0];
    try {
      expect(row.enabled).toBe(false);
      expect(row.links).toHaveLength(2);
      expect(row.links[0].url).toBe(
        `https://example.com/Branch-${suffix}#Contact`,
      );
      expect(row.tags).toHaveLength(2);
      expect(row.attrs).toEqual({ 營業時間: "每天" });
    } finally {
      await request.delete("/api/admin/catalog", {
        headers: {
          origin: new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000")
            .origin,
        },
        data: { kind: "listings", id: row.id },
      });
    }
  });
});
