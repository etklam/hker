import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, closeDatabase } from "../src/server/db";
import { users } from "../src/db/schema/users";
import { createSession } from "../src/server/services/session-service";
import { saveListing, saveTaxonomy } from "../src/server/catalog/service";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    process.env.ALLOW_DIRECTORY_TEST_RESET !== "1" ||
    url.pathname !== "/hker_directory_test" ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "E2E fixture requires ALLOW_DIRECTORY_TEST_RESET=1 and a loopback hker_directory_test database",
    );
  }
  if (!process.env.AUTH_SESSION_SECRET)
    throw new Error(
      "Set the same AUTH_SESSION_SECRET for fixture and test server",
    );
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(
      new URL(baseURL).hostname,
    )
  )
    throw new Error("E2E browser target must be loopback");
  await db.execute(
    sql`truncate directory_content_plans, directory_content_history, directory_listings, directory_categories, directory_areas, directory_tags, directory_tag_groups, directory_navigation_presets, directory_bot_sessions, directory_bot_updates restart identity cascade`,
  );
  const category = await saveTaxonomy("categories", {
    name: "維修服務",
    slug: "repair",
  });
  const area = await saveTaxonomy("areas", { name: "九龍", slug: "kowloon" });
  const child = await saveTaxonomy("areas", {
    name: "旺角",
    slug: "mong-kok",
    parentId: area.id,
  });
  const group = await saveTaxonomy("groups", {
    name: "服務特色",
    slug: "service",
  });
  const tag = await saveTaxonomy("tags", {
    name: "手機",
    slug: "phone",
    groupId: group.id,
    aliases: ["手提電話"],
    botFeatured: true,
  });
  const tag2 = await saveTaxonomy("tags", {
    name: "即日",
    slug: "same-day",
    groupId: group.id,
  });
  for (let index = 0; index < 85; index++)
    await saveTaxonomy("tags", {
      name: `測試標籤 ${index + 1}`,
      slug: `fixture-tag-${index + 1}`,
      groupId: group.id,
      aliases: [`alias-${index + 1}`],
    });
  await saveListing({
    name: "測試維修店",
    slug: "repair-shop",
    description: "手機維修",
    categoryId: category.id,
    areaId: child.id,
    priceMin: 100,
    priceMax: 500,
    enabled: true,
    featured: true,
    tagIds: [tag.id, tag2.id],
    links: [
      { type: "website", label: "Website", url: "https://example.com" },
      { type: "telegram", label: "Telegram", url: "https://t.me/example" },
      {
        type: "website",
        label: "Hidden",
        url: "https://hidden.example.com",
        enabled: false,
      },
    ],
  });
  await saveListing({
    name: "網上社群",
    slug: "online",
    enabled: true,
    tagIds: [tag.id],
    priceMin: 600,
    sortOrder: 10,
  });
  await saveListing({
    name: "隱藏店",
    slug: "disabled",
    enabled: false,
    tagIds: [tag.id, tag2.id],
    sortOrder: 20,
  });
  const hiddenTag = await saveTaxonomy("tags", { name: "內部測試", slug: "internal-fixture", publicVisible: false, botVisible: false });
  const displayTag = await saveTaxonomy("tags", { name: "展示標籤", slug: "display-fixture", filterable: false });
  await saveListing({ name: "網站專用資源", slug: "website-only", enabled: true, priceMin: 0, priceMax: 0, tagIds: [hiddenTag.id, displayTag.id], links: [{ type: "website", label: "資源網站", url: "https://example.test/resource" }] });
  await saveListing({ name: "外幣參考資源", slug: "foreign-currency", enabled: true, priceMin: 25, priceCurrency: "USD" });
  await saveListing({ name: "同名資源", slug: "duplicate-name-one", enabled: true });
  await saveListing({ name: "同名資源", slug: "duplicate-name-two", enabled: true });
  await saveListing({ name: "長內容測試資源", slug: "long-content", enabled: true, description: "這是一段詳細的服務介紹，包含營業方式與使用須知。".repeat(100), shortDescription: "提供清楚的介紹與使用方法。".repeat(10) });
  const preset = await saveTaxonomy("navigation", {
    label: "手機或即日",
    tagIds: [tag.id, tag2.id],
    matchMode: "or",
    placement: "both",
  });
  const [admin] = await db
    .insert(users)
    .values({
      email: "directory-e2e@example.test",
      displayName: "目錄測試管理員",
      role: "admin",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: "admin", banned: false },
    })
    .returning();
  const token = await createSession(admin.id);
  const output = resolve(
    process.env.DIRECTORY_E2E_STATE ?? ".next/directory-e2e-state.json",
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify({
      cookies: [
        {
          name: process.env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session",
          value: token,
          domain: new URL(baseURL).hostname,
          path: "/",
          httpOnly: true,
          secure:
            (
              process.env.AUTH_SESSION_COOKIE_NAME ?? "__Host-hker_session"
            ).startsWith("__Host-") || baseURL.startsWith("https:"),
          sameSite: "Lax",
          expires: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
      origins: [],
    }),
    { mode: 0o600 },
  );
  await writeFile(
    `${output}.fixture.json`,
    JSON.stringify({
      categoryId: category.id,
      areaId: child.id,
      tagIds: [tag.id, tag2.id],
      presetId: preset.id,
    }),
  );
  console.log(
    `Isolated directory fixture ready; browser state written to ${output}`,
  );
}
main()
  .finally(closeDatabase)
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
