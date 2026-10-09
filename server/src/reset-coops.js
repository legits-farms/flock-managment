// Replaces one farm's listed coops with that farm's default list.
// Run with `npm run reset:coops` (Bhaktharahali) or `npm run reset:coops -- <farm>`.
// Only the pick-lists change: batches keep the coops their birds are already in.
import mongoose from 'mongoose';
import { connectDb } from './app.js';
import Option from './models/Option.js';
import { listOptions, listedFarm } from './options.js';

await connectDb();

const farm = await listedFarm(process.argv[2] || 'Bhaktharahali');
if (!farm) {
  console.error('No such farm.');
  await mongoose.disconnect();
  process.exit(1);
}

const { deletedCount } = await Option.deleteMany({
  kind: 'coop',
  farm: new RegExp(`^${farm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
});

// Listing the options adds the defaults of a farm that has no coops
const { coops } = await listOptions();
console.log(`${farm}: removed ${deletedCount} coops, now ${coops[farm].length}: ${coops[farm].join(', ')}`);
await mongoose.disconnect();
