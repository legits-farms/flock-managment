// What a farm manager is kept to: the coops on their own farm and what happened
// in them. Everyone else sees every farm, and each of these lets them through.
import prisma from './db.js';
import { badRequest } from './evidence.js';

// The farm the logged-in person is kept to, or null when they see every farm
export const managedFarm = (user) => (user?.role === 'manager' ? user.farm : null);

export const sameFarm = (a, b) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

// A coop without its own farm is on the batch's farm
export const coopFarm = (batch, coop) => coop.farm || batch.shiftToFarm || '';

const named = (farm) => ({ equals: farm, mode: 'insensitive' });

// Prisma filters: the batches with birds on a farm, now or before, and its coops
const batchesOn = (farm) => ({
  OR: [{ shiftToFarm: named(farm) }, { coops: { some: { farm: named(farm) } } }],
});
const coopsOn = (farm) => ({
  OR: [
    { farm: named(farm) },
    { OR: [{ farm: null }, { farm: '' }], batch: { shiftToFarm: named(farm) } },
  ],
});

// Each of these narrows a list to the person's farm, and is {} for those who see all

export const batchScope = (user) => {
  const farm = managedFarm(user);
  return farm ? batchesOn(farm) : {};
};

// Records kept against a coop (mortality, feed, weight): those of the farm's coops
export async function coopRecordScope(user) {
  const farm = managedFarm(user);
  if (!farm) return {};
  const coops = await prisma.coop.findMany({ where: coopsOn(farm), select: { id: true } });
  return { coopId: { in: coops.map((coop) => coop.id) } };
}

// Vaccinations follow the birds from farm to farm, so a manager gets the whole
// history of every batch on their farm: without it, birds shifted in would look
// due for vaccines they already had
export const batchRecordScope = (user) => {
  const farm = managedFarm(user);
  return farm ? { batch: batchesOn(farm) } : {};
};

// Shifts into, out of or within the farm
export const shiftScope = (user) => {
  const farm = managedFarm(user);
  return farm ? { OR: [{ fromFarm: named(farm) }, { toFarm: named(farm) }] } : {};
};

// Sales with birds out of the farm's coops
export const saleScope = (user) => {
  const farm = managedFarm(user);
  return farm ? { sets: { some: { farm: named(farm) } } } : {};
};

// Refuses a manager anything in a coop on another farm
export function checkCoopOnFarm(user, batch, coop) {
  const farm = managedFarm(user);
  if (farm && !sameFarm(coopFarm(batch, coop), farm)) {
    throw badRequest(`${coop.name} is not on ${farm}. Your account is only for ${farm}`);
  }
}

// Refuses a manager a farm other than their own
export function checkFarm(user, name) {
  const farm = managedFarm(user);
  if (farm && !sameFarm(name, farm)) throw badRequest(`Your account is only for ${farm}`);
}

// The lists to pick from (see listOptions), with only the manager's farm and its coops
export function optionsFor(user, options) {
  const farm = managedFarm(user);
  if (!farm) return options;
  const farms = options.farms.filter((name) => sameFarm(name, farm));
  return {
    ...options,
    farms,
    coops: Object.fromEntries(farms.map((name) => [name, options.coops[name] ?? []])),
  };
}
