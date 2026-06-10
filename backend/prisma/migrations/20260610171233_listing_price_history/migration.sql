-- CreateEnum
CREATE TYPE "PriceChangeReason" AS ENUM ('created', 'asking_price_change', 'revaluation');

-- CreateTable
CREATE TABLE "ListingPriceHistory" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "oldAskingPrice" INTEGER,
    "newAskingPrice" INTEGER NOT NULL,
    "oldPredictedValue" INTEGER,
    "newPredictedValue" INTEGER,
    "oldPredictedLow" INTEGER,
    "newPredictedLow" INTEGER,
    "oldPredictedHigh" INTEGER,
    "newPredictedHigh" INTEGER,
    "reason" "PriceChangeReason" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingPriceHistory_listingId_idx" ON "ListingPriceHistory"("listingId");

-- CreateIndex
CREATE INDEX "ListingPriceHistory_changedAt_idx" ON "ListingPriceHistory"("changedAt");

-- AddForeignKey
ALTER TABLE "ListingPriceHistory" ADD CONSTRAINT "ListingPriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
