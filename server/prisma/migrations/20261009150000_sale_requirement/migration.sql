-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "requiredAvgKg" DOUBLE PRECISION,
ADD COLUMN     "requiredBirds" INTEGER,
ADD COLUMN     "requiredBreed" TEXT NOT NULL DEFAULT '';
