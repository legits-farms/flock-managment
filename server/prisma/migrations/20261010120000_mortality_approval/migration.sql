-- AlterTable
ALTER TABLE "Mortality" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decidedByName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved';
