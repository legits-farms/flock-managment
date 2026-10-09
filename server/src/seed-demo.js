// Fills an EMPTY database with demo batches, coops and records to try the app with.
// Run with `npm run seed:demo`. It refuses to run if any batch already exists.
import { findBatch, placeType } from './batches.js';
import prisma, { disconnectDb } from './db.js';
import { listOptions } from './options.js';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY);

// A 1×1 placeholder image: demo records have no real camera photo
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

if ((await prisma.batch.count()) > 0) {
  console.error('The database already has batches. Demo data is only added to an empty one.');
  await disconnectDb();
  process.exit(1);
}

// Makes sure the default farms and their coops exist
await listOptions();

// Demo entries are credited to the first account, if anyone has signed up
const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
const createdBy = user ? { createdById: user.id, createdByName: user.name } : {};
const addedBy = user ? { addedById: user.id, addedByName: user.name } : {};

const evidence = (when) => ({
  create: [
    {
      position: 0,
      data: PLACEHOLDER_JPEG,
      contentType: 'image/jpeg',
      lat: 16.8524,
      lng: 74.5815,
      accuracy: 12,
      capturedAt: when,
    },
  ],
});

async function createBatch({ coops, startedDaysAgo, vendor, ...details }) {
  const createdAt = daysAgo(startedDaysAgo);
  const { id } = await prisma.batch.create({
    data: {
      ...details,
      vendorName: vendor.name,
      vendorPhone: vendor.phone,
      vendorDetails: vendor.details,
      startDate: createdAt,
      createdAt,
      enteredBy: user?.name ?? 'Demo',
      ...createdBy,
    },
  });
  // One at a time, so the coops keep this order
  for (const [name, birds] of coops) {
    await prisma.coop.create({ data: { batchId: id, name, birds, ...addedBy } });
  }
  return id;
}

// The batch's coop of that name: on `farm`, or on the batch's own when none is given
async function coopOf(batchId, name, farm) {
  const batch = await findBatch(batchId);
  const coop = batch.coops.find(
    (other) => other.name === name && (farm ? other.farm === farm : !other.farm)
  );
  return { batch, coop };
}

async function addMortality(batchId, coopName, birds, reason, days, type = placeType(coopName)) {
  const { coop } = await coopOf(batchId, coopName);
  const when = daysAgo(days);
  await prisma.mortality.create({
    data: {
      batchId,
      type,
      coopId: coop.id,
      coopName,
      birds,
      reason,
      photos: evidence(when),
      ...createdBy,
      createdAt: when,
    },
  });
  await prisma.coop.update({ where: { id: coop.id }, data: { mortality: { increment: birds } } });
}

async function addVaccination(batchId, coopName, vaccine, days, remarks = '') {
  const { coop } = await coopOf(batchId, coopName);
  const when = daysAgo(days);
  await prisma.vaccination.create({
    data: {
      batchId,
      coopId: coop.id,
      coopName,
      date: when,
      vaccine,
      remarks,
      birds: coop.birds - coop.mortality,
      photos: evidence(when),
      ...createdBy,
      createdAt: when,
    },
  });
}

async function addShift(batchId, fromName, toFarm, toName, birds, reason, days) {
  const { batch, coop: from } = await coopOf(batchId, fromName);
  const otherFarm = toFarm !== batch.shiftToFarm;
  const to =
    (await coopOf(batchId, toName, otherFarm ? toFarm : undefined)).coop ??
    (await prisma.coop.create({
      data: { batchId, name: toName, birds: 0, farm: toFarm, fromShift: true, ...addedBy },
    }));
  await prisma.coop.update({ where: { id: from.id }, data: { birds: { decrement: birds } } });
  await prisma.coop.update({ where: { id: to.id }, data: { birds: { increment: birds } } });

  const when = daysAgo(days);
  await prisma.shift.create({
    data: {
      batchId,
      fromCoopId: from.id,
      fromCoopName: from.name,
      fromFarm: batch.shiftToFarm,
      toCoopId: to.id,
      toCoopName: to.name,
      toFarm,
      birds,
      reason,
      date: when,
      ...createdBy,
      createdAt: when,
    },
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
  `Demo data added: ${await prisma.batch.count()} batches, ${await prisma.mortality.count()} mortality records, ` +
    `${await prisma.vaccination.count()} vaccinations, ${await prisma.shift.count()} shifts` +
    (user ? `, credited to ${user.name}.` : '.')
);
await disconnectDb();
