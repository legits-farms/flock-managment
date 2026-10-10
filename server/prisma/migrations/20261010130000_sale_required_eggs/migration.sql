-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "requiredEggFertile" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requiredEggGrade" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requiredEggWash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requiredEggs" INTEGER;
