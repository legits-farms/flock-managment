import { coopLive, withCoops } from './batches.js';
import prisma from './db.js';
import { badRequest } from './evidence.js';

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The batch other than `batch` that still has live birds in the named coop of
// the farm, as { batch, coop }, or null when the coop is free for `batch`. A
// batch that only has history there (every bird shifted out, lost or sold)
// does not count.
export async function coopOccupant(batch, farm, coopName) {
  const others = await prisma.batch.findMany({
    where: { id: { not: batch.id }, coops: { some: {} } },
    include: withCoops,
  });
  for (const other of others) {
    const coop = other.coops.find(
      (coop) =>
        same(coop.name, coopName) &&
        same(coop.farm || other.shiftToFarm || '', farm) &&
        coopLive(coop) > 0
    );
    if (coop) return { batch: other, coop };
  }
  return null;
}

// A coop holds one batch at a time: refuses to put `batch`'s birds in a coop
// where another batch still has live birds
export async function checkCoopFree(batch, farm, coopName) {
  const occupant = await coopOccupant(batch, farm, coopName);
  if (occupant) {
    throw badRequest(
      `${coopName} already holds ${occupant.batch.batchName}. A coop can hold only one batch at a time`
    );
  }
}
