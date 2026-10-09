// Fills an EMPTY database with demo batches, coops and records to try the app with.
// Run with `npm run seed:demo`. It refuses to run if any batch already exists.
import mongoose from 'mongoose';
import { connectDb } from './app.js';
import Batch from './models/Batch.js';
import Mortality, { placeType } from './models/Mortality.js';
import Shift from './models/Shift.js';
import User from './models/User.js';
import Vaccination from './models/Vaccination.js';
import { listOptions } from './options.js';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY);

// A 1×1 placeholder image: demo records have no real camera photo
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

await connectDb();

if ((await Batch.countDocuments()) > 0) {
  console.error('The database already has batches. Demo data is only added to an empty one.');
  await mongoose.disconnect();
  process.exit(1);
}

// Makes sure the default farms and their coops exist
await listOptions();

// Demo entries are credited to the first account, if anyone has signed up
const user = await User.findOne().sort({ _id: 1 });
const by = user ? { user: user._id, name: user.name } : undefined;

const evidence = (when) => ({
  photo: { data: PLACEHOLDER_JPEG, contentType: 'image/jpeg' },
  location: { lat: 16.8524, lng: 74.5815, accuracy: 12 },
  capturedAt: when,
});

async function createBatch({ coops, startedDaysAgo, ...details }) {
  const createdAt = daysAgo(startedDaysAgo);
  return Batch.create({
    ...details,
    startDate: createdAt,
    createdAt,
    enteredBy: by?.name ?? 'Demo',
    createdBy: by,
    coops: coops.map(([name, birds]) => ({ name, birds, addedBy: by })),
  });
}

const coopOf = (batch, name, farm) =>
  batch.coops.find((coop) => coop.name === name && (farm ? coop.farm === farm : !coop.farm));

async function addMortality(batch, coopName, birds, reason, days, type = placeType(coopName)) {
  const coop = coopOf(batch, coopName);
  const when = daysAgo(days);
  coop.mortality += birds;
  await Mortality.create({
    batch: batch._id,
    type,
    coopId: coop._id,
    coopName,
    birds,
    reason,
    ...evidence(when),
    createdBy: by,
    createdAt: when,
  });
}

async function addVaccination(batch, coopName, vaccine, days, remarks = '') {
  const coop = coopOf(batch, coopName);
  const when = daysAgo(days);
  await Vaccination.create({
    batch: batch._id,
    coopId: coop._id,
    coopName,
    date: when,
    vaccine,
    remarks,
    birds: coop.birds - coop.mortality,
    ...evidence(when),
    createdBy: by,
    createdAt: when,
  });
}

async function addShift(batch, fromName, toFarm, toName, birds, reason, days) {
  const from = coopOf(batch, fromName);
  const otherFarm = toFarm !== batch.shiftToFarm;
  let to = coopOf(batch, toName, otherFarm ? toFarm : undefined);
  if (!to) {
    batch.coops.push({ name: toName, birds: 0, farm: toFarm, fromShift: true, addedBy: by });
    to = batch.coops[batch.coops.length - 1];
  }
  from.birds -= birds;
  to.birds += birds;

  const when = daysAgo(days);
  await Shift.create({
    batch: batch._id,
    fromCoopId: from._id,
    fromCoopName: from.name,
    fromFarm: batch.shiftToFarm,
    toCoopId: to._id,
    toCoopName: to.name,
    toFarm,
    birds,
    reason,
    date: when,
    createdBy: by,
    createdAt: when,
  });
}

// 1. A fully allocated, vaccinated flock at HQ, part of it moved to Bhaktharahali
const sonali = await createBatch({
  batchName: 'Sonali Batch 01',
  breed: 'Sonali',
  age: 1,
  ageUnit: 'days',
  numberOfBirds: 4000,
  boxMortality: 25,
  vendor: { name: 'Sai Hatcheries', phone: '9876500011', details: 'Invoice SH-1042' },
  shiftToFarm: 'HQ',
  startedDaysAgo: 20,
  coops: [
    ['Coop 1', 2000],
    ['Coop 2', 1975],
  ],
});
await addVaccination(sonali, 'Coop 1', 'Lasota', 14, 'Eye drop');
await addVaccination(sonali, 'Coop 2', 'Lasota', 14, 'Eye drop');
await addMortality(sonali, 'Coop 1', 12, 'Heat stress', 9);
await addMortality(sonali, 'Coop 2', 8, 'Weak chicks', 8);
await addVaccination(sonali, 'Coop 1', 'Gumboro', 6, 'Drinking water');
await addShift(sonali, 'Coop 2', 'Bhaktharahali', 'Coop 7F', 300, 'Moved for grow-out', 4);
await sonali.save();

// 2. A larger flock at Bhaktharahali with some birds still to allocate
const kadaknath = await createBatch({
  batchName: 'Kadaknath Batch 02',
  breed: 'Kadaknath',
  age: 2,
  ageUnit: 'weeks',
  numberOfBirds: 6000,
  boxMortality: 40,
  vendor: { name: 'Green Valley Poultry', phone: '9876500022', details: '' },
  shiftToFarm: 'Bhaktharahali',
  startedDaysAgo: 10,
  coops: [
    ['Brooding A', 2000],
    ['Brooding B', 2000],
    ['Coop 1A', 1500],
  ],
});
await addVaccination(kadaknath, 'Brooding A', "Marek's", 7);
await addMortality(kadaknath, 'Coop 1A', 15, 'Pecking injuries', 5);
await addShift(kadaknath, 'Brooding B', 'Bhaktharahali', 'Coop 2A', 500, 'Overcrowding', 3);
await addMortality(kadaknath, 'Brooding A', 6, 'Unknown, found in the morning', 1);
await kadaknath.save();

// 3. A new arrival at HQ, not yet allocated to any coop
await createBatch({
  batchName: 'Aseel Batch 03',
  breed: 'Aseel',
  age: 5,
  ageUnit: 'days',
  numberOfBirds: 1500,
  boxMortality: 5,
  vendor: { name: 'Deccan Chicks', phone: '', details: 'Paid in cash' },
  shiftToFarm: 'HQ',
  startedDaysAgo: 2,
  coops: [],
});

console.log(
  `Demo data added: ${await Batch.countDocuments()} batches, ${await Mortality.countDocuments()} mortality records, ` +
    `${await Vaccination.countDocuments()} vaccinations, ${await Shift.countDocuments()} shifts` +
    (by ? `, credited to ${by.name}.` : '.')
);
await mongoose.disconnect();
