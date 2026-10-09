-- AlterTable
ALTER TABLE "Mortality" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Mortality entered before it had a date of its own happened when it was entered
UPDATE "Mortality" SET "date" = "createdAt";

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "fromGallery" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "lat" DROP NOT NULL,
ALTER COLUMN "lng" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';
