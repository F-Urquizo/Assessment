-- AddIndex
-- Adds the listingId index that was missing from the initial Favorite creation.
CREATE INDEX IF NOT EXISTS "Favorite_listingId_idx" ON "Favorite"("listingId");
