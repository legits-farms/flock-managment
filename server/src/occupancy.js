import { badRequest } from './evidence.js';
import Batch from './models/Batch.js';

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// A coop holds one batch at a time: refuses to put `batch`'s birds in a coop
// where another batch still has live birds. A batch that only has history
// there (every bird shifted out or lost) does not count.
export async function checkCoopFree(batch, farm, coopName) {
  const others = await Batch.find({ _id: { $ne: batch._id }, 'coops.0': { $exists: true } });
  const occupant = others.find((other) =>
    other.coops.some(
      (coop) =>
        same(coop.name, coopName) &&
        same(coop.farm || other.shiftToFarm || '', farm) &&
        coop.birds - coop.mortality > 0
    )
  );
  if (occupant) {
    throw badRequest(
      `${coopName} already holds ${occupant.batchName}. A coop can hold only one batch at a time`
    );
  }
}
