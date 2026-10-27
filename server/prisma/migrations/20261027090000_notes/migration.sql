-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "farm" TEXT,
    "coopName" TEXT,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_batchId_idx" ON "Note"("batchId");

-- CreateIndex
CREATE INDEX "Note_farm_coopName_idx" ON "Note"("farm", "coopName");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
