-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farm" TEXT,
    "schedule" TEXT,
    "key" TEXT NOT NULL,
    "addedById" TEXT,
    "addedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "breed" TEXT NOT NULL,
    "age" DOUBLE PRECISION NOT NULL,
    "ageUnit" TEXT NOT NULL DEFAULT 'days',
    "numberOfBirds" INTEGER NOT NULL,
    "boxMortality" INTEGER NOT NULL DEFAULT 0,
    "vendorName" TEXT NOT NULL,
    "vendorPhone" TEXT NOT NULL DEFAULT '',
    "vendorDetails" TEXT NOT NULL DEFAULT '',
    "shiftToFarm" TEXT NOT NULL DEFAULT '',
    "enteredBy" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coop" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "farm" TEXT,
    "fromShift" BOOLEAN NOT NULL DEFAULT false,
    "mortality" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "addedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "mortalityId" TEXT,
    "vaccinationId" TEXT,
    "saleSetId" TEXT,
    "position" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mortality" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" TEXT,
    "shiftId" TEXT,
    "coopId" TEXT NOT NULL,
    "coopName" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mortality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "coopId" TEXT NOT NULL,
    "coopName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vaccine" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "birds" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "coopId" TEXT NOT NULL,
    "coopName" TEXT NOT NULL,
    "farm" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "feedType" TEXT NOT NULL,
    "feedCompany" TEXT NOT NULL DEFAULT '',
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weight" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "coopId" TEXT NOT NULL,
    "coopName" TEXT NOT NULL,
    "farm" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "birds" INTEGER NOT NULL,
    "totalWeightKg" DOUBLE PRECISION NOT NULL,
    "avgWeightG" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Weight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fromCoopId" TEXT NOT NULL,
    "fromCoopName" TEXT NOT NULL,
    "fromFarm" TEXT NOT NULL DEFAULT '',
    "toCoopId" TEXT NOT NULL,
    "toCoopName" TEXT NOT NULL,
    "toFarm" TEXT NOT NULL DEFAULT '',
    "birds" INTEGER NOT NULL,
    "mortality" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL DEFAULT '',
    "ratePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maleRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "femaleRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boxMode" TEXT NOT NULL DEFAULT 'own',
    "boxQty" INTEGER NOT NULL DEFAULT 0,
    "boxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boxReturned" INTEGER NOT NULL DEFAULT 0,
    "present" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "paymentReference" TEXT NOT NULL DEFAULT '',
    "paymentProof" BYTEA,
    "paymentProofType" TEXT,
    "hasProof" BOOLEAN NOT NULL DEFAULT false,
    "birds" INTEGER NOT NULL,
    "maleBirds" INTEGER NOT NULL DEFAULT 0,
    "femaleBirds" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maleWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "femaleWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birdBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maleBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "femaleBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boxBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleSet" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "coopId" TEXT NOT NULL,
    "coopName" TEXT NOT NULL,
    "farm" TEXT NOT NULL DEFAULT '',
    "gender" TEXT,
    "birds" INTEGER NOT NULL,
    "boxes" INTEGER NOT NULL DEFAULT 0,
    "boxWeightEmpty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boxWeightGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SaleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPurchase" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feedType" TEXT NOT NULL,
    "feedCompany" TEXT NOT NULL DEFAULT '',
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "ratePerKg" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Option_kind_key_key" ON "Option"("kind", "key");

-- CreateIndex
CREATE INDEX "Coop_batchId_idx" ON "Coop"("batchId");

-- CreateIndex
CREATE INDEX "Photo_mortalityId_idx" ON "Photo"("mortalityId");

-- CreateIndex
CREATE INDEX "Photo_vaccinationId_idx" ON "Photo"("vaccinationId");

-- CreateIndex
CREATE INDEX "Photo_saleSetId_idx" ON "Photo"("saleSetId");

-- CreateIndex
CREATE INDEX "Mortality_batchId_idx" ON "Mortality"("batchId");

-- CreateIndex
CREATE INDEX "Vaccination_batchId_idx" ON "Vaccination"("batchId");

-- CreateIndex
CREATE INDEX "Feed_batchId_idx" ON "Feed"("batchId");

-- CreateIndex
CREATE INDEX "Weight_batchId_idx" ON "Weight"("batchId");

-- CreateIndex
CREATE INDEX "Shift_batchId_idx" ON "Shift"("batchId");

-- CreateIndex
CREATE INDEX "SaleSet_saleId_idx" ON "SaleSet"("saleId");

-- CreateIndex
CREATE INDEX "SaleSet_batchId_idx" ON "SaleSet"("batchId");

-- AddForeignKey
ALTER TABLE "Coop" ADD CONSTRAINT "Coop_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_mortalityId_fkey" FOREIGN KEY ("mortalityId") REFERENCES "Mortality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_vaccinationId_fkey" FOREIGN KEY ("vaccinationId") REFERENCES "Vaccination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_saleSetId_fkey" FOREIGN KEY ("saleSetId") REFERENCES "SaleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mortality" ADD CONSTRAINT "Mortality_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feed" ADD CONSTRAINT "Feed_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weight" ADD CONSTRAINT "Weight_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleSet" ADD CONSTRAINT "SaleSet_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleSet" ADD CONSTRAINT "SaleSet_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
