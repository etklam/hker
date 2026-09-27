import { sql } from "drizzle-orm";
import { db, closeDatabase } from "../src/server/db";
import { listings, tags, listingTags } from "../src/db/schema/directory";
import { buildSearchWhere } from "../src/server/catalog/service";
import { searchSchema } from "../src/schemas/directory";
if (!process.env.DATABASE_URL?.endsWith("/hker_directory_test")) throw new Error("Use isolated hker_directory_test only");
async function main() {
const rollback = new Error("ROLLBACK_SYNTHETIC_DATA");
try {
  await db.transaction(async tx => {
    const [tag] = await tx.insert(tags).values({name: "測量標籤", slug: "explain-synthetic-tag"}).returning();
    const rows = await tx.insert(listings).values(Array.from({ length: 1000 }, (_, index) => ({ name: `測試商店 ${index}`, slug: `explain-synthetic-${index}`, enabled: true, description: index % 10 ? "社區服務" : "手機維修", aliases: index % 10 ? [] : ["維修"], attrs: { hours: "10:00–18:00" }, sortOrder: index }))).returning({id: listings.id});
    await tx.insert(listingTags).values(rows.filter((_, index) => index % 10 === 0).map(row => ({listingId: row.id, tagId: tag.id})));
    await tx.execute(sql`analyze directory_listings, directory_listing_tags, directory_tags, directory_tag_aliases, directory_categories, directory_areas`);
    for (const input of [{}, { query: "維修" }, { query: "測試商店 500" }, { tagIds: [tag.id] }]) {
      const plan = await tx.execute(sql`explain (analyze, buffers, format json) select id from ${listings} where ${buildSearchWhere(searchSchema.parse(input), "public")} order by sort_order, id limit 12`);
      console.log(JSON.stringify({ input, rows: 1000, plan }));
    }
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await closeDatabase(); }

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
