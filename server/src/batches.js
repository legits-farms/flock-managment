import prisma from './db.js';
import { parseId } from './validate.js';

// Where the birds were lost. Box mortality (dead on arrival) is not a record:
// it is entered with the batch.
export const MORTALITY_TYPES = ['shift', 'brooding', 'coop'];

// Records without a type go by their coop: a brooding house or an ordinary coop
export const placeType = (coopName) => (/^brooding\b/i.test(coopName.trim()) ? 'brooding' : 'coop');

// Birds alive in a coop now: those put in it, less the ones lost and sold
export const coopLive = (coop) => coop.birds - coop.mortality - (coop.sold ?? 0);

// A batch is always loaded with its coops, in the order they were added
export const withCoops = { coops: { orderBy: { seq: 'asc' } } };

// The batch with its coops, or null when there is no such batch
export async function findBatch(id) {
  const batchId = parseId(id);
  return batchId ? prisma.batch.findUnique({ where: { id: batchId }, include: withCoops }) : null;
}
