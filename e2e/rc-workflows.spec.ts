import { expect, test, type APIRequestContext } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";

const enabled = process.env.DIRECTORY_E2E_FIXTURE === "1";
const state =
  process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json";
if (
  process.env.DIRECTORY_ACCEPTANCE === "1" &&
  (!enabled || !existsSync(state))
)
  throw new Error("Phase 9 RC workflows require the isolated fixture");

const origin = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100")
  .origin;
const headers = { origin };

async function resetAdminCatalogReadLimit() {
  const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    process.env.DIRECTORY_ACCEPTANCE !== "1" ||
    process.env.ALLOW_DIRECTORY_TEST_RESET !== "1" ||
    database.pathname !== "/hker_directory_test" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  )
    throw new Error("RC rate-limit isolation requires the disposable test database");
  const sql = postgres(database.toString(), { max: 1 });
  try {
    await sql`delete from rate_limit_entries where key = ${"rl:untrusted-shared:GET:/api/admin/catalog"}`;
  } finally {
    await sql.end();
  }
}

async function listing(request: APIRequestContext, name: string) {
  const response = await request.get(
    `/api/admin/catalog?q=${encodeURIComponent(name)}`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).items.find(
    (item: { name: string }) => item.name === name,
  );
}

test.describe("Phase 9 release-candidate browser workflows", () => {
  test.skip(!enabled, "Requires isolated directory fixture");
  test.setTimeout(90_000);
  test.use({ storageState: enabled ? state : undefined });
  test.beforeAll(resetAdminCatalogReadLimit);

  test("RC update import isolates a malformed row and replays the reviewed result", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    const goodName = `虛構 RC 有效 ${suffix}`;
    const badName = `虛構 RC 略過 ${suffix}`;
    const create = async (name: string, slug: string, links: unknown[]) => {
      const response = await request.post("/api/admin/catalog", {
        headers,
        data: { kind: "listings", data: { name, slug, links } },
      });
      expect(response.ok()).toBe(true);
      return response.json();
    };
    const good = await create(goodName, `rc-good-${suffix}`, [
      {
        type: "website",
        label: "主網站",
        url: `https://example.test/${suffix}/main`,
      },
      {
        type: "website",
        label: "預約",
        url: `https://example.test/${suffix}/booking`,
      },
    ]);
    const bad = await create(badName, `rc-bad-${suffix}`, [
      {
        type: "website",
        label: "原連結",
        url: `https://example.test/${suffix}/unchanged`,
      },
    ]);
    const beforeGood = await listing(request, goodName);
    const beforeBad = await listing(request, badName);
    const source = [
      "formatVersion,slug,shortDescription,attrsJson",
      `2,${good.slug},RC09 已更新,"{""版本"":""rc09""}"`,
      `2,${bad.slug},不應更新,"{broken"`,
    ].join("\n");

    try {
      const anonymous = await page
        .context()
        .browser()!
        .newContext({
          baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
          storageState: { cookies: [], origins: [] },
        });
      try {
        for (const protectedUrl of [
          `/api/admin/catalog/export?format=json&ids=${good.id}`,
          `/api/admin/catalog/history?id=${good.id}`,
          "/api/admin/catalog/operations",
        ])
          expect((await anonymous.request.get(protectedUrl)).status()).toBe(
            401,
          );
        expect(
          (
            await anonymous.request.post("/api/admin/catalog/operations", {
              headers,
              data: {
                action: "import",
                source: "name\nunauthorized",
                settings: { mode: "create" },
              },
            })
          ).status(),
        ).toBe(401);
      } finally {
        await anonymous.close();
      }
      for (const data of [
        {
          action: "import",
          source: "name\ncross-origin",
          settings: { mode: "create" },
        },
        {
          action: "bulk",
          input: {
            targets: [{ id: good.id, revision: beforeGood.revision }],
            changes: { featured: true },
          },
        },
      ])
        expect(
          (
            await request.post("/api/admin/catalog/operations", {
              headers: { origin: "https://cross-origin.invalid" },
              data,
            })
          ).status(),
        ).toBe(403);
      expect(
        (
          await request.post("/api/admin/catalog/import", {
            headers: { origin: "https://cross-origin.invalid" },
            data: { csv: "name\ncross-origin" },
          })
        ).status(),
      ).toBe(403);

      const invalidJson = await request.post("/api/admin/catalog/operations", {
        headers: { ...headers, "Content-Type": "application/json" },
        data: "{broken",
      });
      expect(invalidJson.status()).toBe(400);

      const routePreview = await request.post("/api/admin/catalog/operations", {
        headers,
        data: {
          action: "import",
          source,
          settings: {
            mode: "update",
            linksMode: "append",
            tagsMode: "append",
            clear: [],
            decisions: {},
            mappings: [],
            columns: {},
          },
        },
      });
      expect(routePreview.ok()).toBe(true);
      const routePlan = await routePreview.json();
      expect(routePlan.payload.rows[0].errors).toEqual([]);
      expect(routePlan.payload.rows[0].diff).toHaveProperty("shortDescription");
      expect(routePlan.payload.rows[1].errors.join(" ")).toMatch(/attrs/);

      await page.goto("/admin/imports");
      await page.getByLabel("或貼上 CSV／JSON").fill("{broken");
      await page
        .getByRole("button", { name: "解析及預覽", exact: true })
        .click();
      await expect(
        page.getByRole("alert").filter({ hasText: /JSON|格式/ }),
      ).toBeVisible();

      await page
        .getByRole("combobox", { name: "操作模式", exact: true })
        .selectOption("update");
      await page.getByLabel("或貼上 CSV／JSON").fill(source);
      await page
        .getByRole("button", { name: "解析及預覽", exact: true })
        .click();
      const preview = page.getByRole("region", { name: "匯入預覽" });
      await expect(
        preview.getByRole("cell", { name: "attrs: JSON 格式不正確" }),
      ).toBeVisible();
      await preview
        .getByText(/欄位變更/)
        .first()
        .click();
      await expect(
        preview.getByText("shortDescription", { exact: true }),
      ).toBeVisible();
      await preview
        .getByRole("combobox", { name: /^第 3 行 ·/ })
        .selectOption("skip");
      await expect(preview.getByText(/請重新預覽/)).toBeVisible();

      const reviewedResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin/catalog/operations") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "解析及預覽", exact: true })
        .click();
      const reviewedPlan = await (await reviewedResponse).json();
      await expect(
        page.getByRole("button", { name: "確認匯入 1 項" }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "確認匯入 1 項" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "已完成" }),
      ).toContainText("更新 1");

      const afterGood = await listing(request, goodName);
      const afterBad = await listing(request, badName);
      expect(afterGood.revision).toBe(beforeGood.revision + 1);
      expect(afterGood.shortDescription).toBe("RC09 已更新");
      expect(afterGood.links.map((link: { id: number }) => link.id)).toEqual(
        beforeGood.links.map((link: { id: number }) => link.id),
      );
      expect(afterBad).toEqual(beforeBad);

      const history = await request.get(
        `/api/admin/catalog/history?id=${good.id}`,
      );
      expect(history.ok()).toBe(true);
      expect(
        (await history.json()).some(
          (entry: { operationId: string }) =>
            entry.operationId === reviewedPlan.id,
        ),
      ).toBe(true);
      const replay = await request.post("/api/admin/catalog/operations", {
        headers,
        data: {
          action: "commit",
          id: reviewedPlan.id,
          digest: reviewedPlan.digest,
        },
      });
      expect(replay.ok()).toBe(true);
      expect(await replay.json()).toMatchObject({
        updated: 1,
        skipped: 1,
        replayed: true,
      });

      await page.goto("/admin/listings");
      await page
        .getByRole("textbox", { name: "搜尋收錄", exact: true })
        .fill(goodName);
      await page.getByRole("button", { name: "搜尋", exact: true }).click();
      await page
        .getByRole("checkbox", { name: `選取${goodName}`, exact: true })
        .check();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("link", { name: "匯出所選 JSON" }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe("hker-catalog.json");
      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      await testInfo.attach("rc-portable-export", {
        path: downloadPath!,
        contentType: "application/json",
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/imports");
      await expect(
        page.getByRole("textbox", {
          name: "或貼上 CSV／JSON",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await mkdir("artifacts/release-candidate/screenshots", {
        recursive: true,
      });
      await page.screenshot({
        path: "artifacts/release-candidate/screenshots/rc-import-mobile.png",
        fullPage: true,
      });
    } finally {
      for (const name of [goodName, badName]) {
        const current = await listing(request, name).catch(() => undefined);
        if (current)
          await request.delete("/api/admin/catalog", {
            headers,
            data: {
              kind: "listings",
              id: current.id,
              revision: current.revision,
            },
          });
      }
    }
  });

  test("portable search round-trip and native unsaved dialog remain usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search");
    const search = page.locator("main");
    await search
      .getByRole("textbox", { name: "搜尋關鍵字", exact: true })
      .fill("手機維修");
    await search.getByText("篩選條件", { exact: true }).click();
    const area = search.getByLabel("地區");
    const mongKok = await area
      .locator("option")
      .filter({ hasText: "旺角" })
      .getAttribute("value");
    expect(mongKok).not.toBeNull();
    await area.selectOption(mongKok!);
    await search.getByRole("button", { name: "搜尋", exact: true }).click();
    await expect(page).toHaveURL(/q=/);
    await page.goBack();
    await page.goForward();
    await expect(
      page
        .locator("main")
        .getByRole("textbox", { name: "搜尋關鍵字", exact: true }),
    ).toHaveValue("手機維修");
    await expect(page.locator("main").getByLabel("地區")).not.toHaveValue("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.goto("/admin/listings");
    const edit = page
      .getByRole("row")
      .filter({ hasText: "測試維修店" })
      .getByRole("button", { name: "編輯", exact: true });
    await edit.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("名稱", { exact: true }).fill("未儲存 WebKit 草稿");
    page.once("dialog", (prompt) => prompt.dismiss());
    await dialog.getByRole("button", { name: "關閉編輯器" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("名稱", { exact: true })).toHaveValue(
      "未儲存 WebKit 草稿",
    );
    page.once("dialog", (prompt) => prompt.accept());
    await dialog.getByRole("button", { name: "關閉編輯器" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(edit).toBeFocused();
  });
});
