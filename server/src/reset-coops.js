// Replaces one farm's listed coops with that farm's default list.
// Run with `npm run reset:coops` (Bhaktharahali) or `npm run reset:coops -- <farm>`.
// Only the pick-lists change: batches keep the coops their birds are already in.
import { disconnectDb } from './db.js';
import { listOptions, listedFarm, removeCoops } from './options.js';

const farm = await listedFarm(process.argv[2] || 'Bhaktharahali');
if (!farm) {
  console.error('No such farm.');
  await disconnectDb();
  process.exit(1);
}

const removed = await removeCoops(farm);

// Listing the options adds the defaults of a farm that has no coops
const { coops } = await listOptions();
console.log(`${farm}: removed ${removed} coops, now ${coops[farm].length}: ${coops[farm].join(', ')}`);
await disconnectDb();
