-- Add title and description columns to marketplace_listings (nullable first for backfill)
ALTER TABLE "marketplace_listings" ADD COLUMN "title" text;
ALTER TABLE "marketplace_listings" ADD COLUMN "description" text;

-- Backfill existing listings from their associated collections
UPDATE marketplace_listings ml
SET title = c.title, description = c.description
FROM collections c
WHERE ml.collection_id = c.id;

-- Make title NOT NULL after backfill
ALTER TABLE "marketplace_listings" ALTER COLUMN "title" SET NOT NULL;
