-- AlterTable
ALTER TABLE "FeedPurchase" ADD COLUMN     "extraChargeLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "extraCharges" DOUBLE PRECISION NOT NULL DEFAULT 0;
