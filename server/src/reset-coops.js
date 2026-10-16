// Replaces one farm's listed coops with that farm's default list.
// Run with `npm run reset:coops` (Bhaktharahali) or `npm run reset:coops -- <farm>`.
// Only the pick-lists change: batches keep the coops their birds are already in,
// and a part of a coop ("Coop 5A") that any batch has been in stays listed.
import prisma, { disconnectDb } from './db.js';
import { DEFAULT_COOPS, listOptions, listedFarm, partOf, removeCoops } from './options.js';

const farm = await listedFarm(process.argv[2] || 'Bhaktharahali');
if (!farm) {
  console.error('No such farm.');
  await disconnectDb();
  process.exit(1);
}

const keyOf = (name) => name.trim().toLowerCase();
const defaults = DEFAULT_COOPS[keyOf(farm)] ?? [];

// Parts of the default coops that batches have used on this farm
const coops = await prisma.coop.findMany({ include: { batch: { select: { shiftToFarm: true } } } });
const usedParts = [
  ...new Map(
    coops
      .filter((coop) => keyOf(coop.farm || coop.batch.shiftToFarm || '') === keyOf(farm))
      .filter((coop) => {
        const part = partOf(coop.name);
        return part && defaults.some((name) => keyOf(name) === keyOf(part.coop));
      })
      .map((coop) => [keyOf(coop.name), coop.name.trim()])
  ).values(),
].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const removed = await removeCoops(farm);

// Listed after the defaults, so each coop comes before its parts
await prisma.option.createMany({
  data: [...defaults, ...usedParts].map((name) => ({
    kind: 'coop',
    farm,
    name,
    key: `${keyOf(farm)}|${keyOf(name)}`,
  })),
  skipDuplicates: true,
});

const listed = (await listOptions()).coops[farm];
console.log(`${farm}: removed ${removed} coops, now ${listed.length}: ${listed.join(', ')}`);
await disconnectDb();
