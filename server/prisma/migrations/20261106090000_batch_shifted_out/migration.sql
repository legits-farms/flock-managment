-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "shiftedOut" INTEGER NOT NULL DEFAULT 0;

-- Birds that already joined another batch were taken off what their batch
-- received. Put them back there and count them as shifted out instead.
UPDATE "Batch" AS b
SET "shiftedOut" = joined.birds,
    "numberOfBirds" = b."numberOfBirds" + joined.birds
FROM (
    SELECT s."batchId", SUM(s."birds" - s."mortality")::INTEGER AS birds
    FROM "Shift" AS s
    JOIN "Coop" AS c ON c."id" = s."toCoopId"
    WHERE c."batchId" <> s."batchId"
    GROUP BY s."batchId"
) AS joined
WHERE b."id" = joined."batchId";
