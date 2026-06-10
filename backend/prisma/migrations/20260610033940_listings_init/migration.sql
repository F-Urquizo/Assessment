-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'active', 'sold');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "odometer" INTEGER NOT NULL,
    "cylinders" INTEGER,
    "condition" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "titleStatus" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "drive" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paintColor" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "description" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "predictedValue" INTEGER,
    "predictedLow" INTEGER,
    "predictedHigh" INTEGER,
    "dealDeltaPct" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_userId_idx" ON "Listing"("userId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_manufacturer_idx" ON "Listing"("manufacturer");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
