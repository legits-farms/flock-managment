// One-time move from the old MongoDB database: copies everything in it into
// PostgreSQL, keeping the ids so people stay logged in and links keep working.
// Run with `npm run copy:mongo` after `npm run db:migrate`, with both MONGO_URI
// and DATABASE_URL in server/.env.
//
// It only reads from MongoDB, and refuses to run unless PostgreSQL is empty.
import 'dotenv/config';
import dns from 'node:dns';
import { MongoClient } from 'mongodb';
import prisma, { disconnectDb } from '../src/db.js';

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Put the old MongoDB address in server/.env');
  process.exit(1);
}
// A mongodb+srv:// address needs a DNS lookup that some PCs' default DNS refuses
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()));
}

const mongo = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
await mongo.connect();
const from = mongo.db();

async function finish(code) {
  await mongo.close();
  await disconnectDb();
  process.exit(code);
}

if ((await prisma.user.count()) + (await prisma.batch.count()) + (await prisma.option.count()) > 0) {
  console.error('PostgreSQL already has data. This only fills an empty database.');
  await finish(1);
}

// Oldest first, one document at a time: records carry photos
const each = (collection) => from.collection(collection).find().sort({ _id: 1 });
const id = (value) => (value ? String(value) : undefined);
const createdBy = (who) => ({ createdById: id(who?.user), createdByName: who?.name });
const addedBy = (who) => ({ addedById: id(who?.user), addedByName: who?.name });
const stamps = (doc) => ({ createdAt: doc.createdAt, updatedAt: doc.updatedAt });

// How many of each were copied, and how many left out
const copied = {};
const skipped = {};
const count = (tally, what) => {
  tally[what] = (tally[what] ?? 0) + 1;
};

// --- Accounts
for await (const user of each('users')) {
  await prisma.user.create({
    data: {
      id: id(user._id),
      name: user.name,
      phone: user.phone,
      passwordHash: user.passwordHash,
      // Accounts made before approval existed keep their access
      status: user.status ?? 'approved',
      ...stamps(user),
    },
  });
  count(copied, 'accounts');
}

// --- Pick-lists. In the order they were added, which is the order they are listed in.
// Coops listed before coops belonged to a farm were Bhaktharahali's
const LEGACY_COOP_FARM = 'Bhaktharahali';
for await (const option of each('options')) {
  const legacy = option.kind === 'coop' && !option.farm;
  const { count: added } = await prisma.option.createMany({
    data: [
      {
        id: id(option._id),
        kind: option.kind,
        name: option.name,
        farm: legacy ? LEGACY_COOP_FARM : option.farm,
        schedule: option.schedule,
        key: legacy ? `${LEGACY_COOP_FARM.toLowerCase()}|${option.key}` : option.key,
        ...addedBy(option.addedBy),
        ...stamps(option),
      },
    ],
    skipDuplicates: true,
  });
  count(added ? copied : skipped, 'options');
}

// --- Batches, each with its coops in the order they were added
const batchIds = new Set();
for await (const batch of each('batches')) {
  await prisma.batch.create({
    data: {
      id: id(batch._id),
      batchName: batch.batchName,
      // Batches entered before the start date was asked started when they were entered
      startDate: batch.startDate ?? batch.createdAt,
      breed: batch.breed,
      age: batch.age,
      ageUnit: batch.ageUnit ?? 'days',
      numberOfBirds: batch.numberOfBirds,
      boxMortality: batch.boxMortality ?? 0,
      vendorName: batch.vendor?.name ?? '',
      vendorPhone: batch.vendor?.phone ?? '',
      vendorDetails: batch.vendor?.details ?? '',
      shiftToFarm: batch.shiftToFarm ?? '',
      enteredBy: batch.enteredBy,
      ...createdBy(batch.createdBy),
      ...stamps(batch),
    },
  });
  for (const coop of batch.coops ?? []) {
    await prisma.coop.create({
      data: {
        id: id(coop._id),
        batchId: id(batch._id),
        name: coop.name,
        birds: coop.birds,
        farm: coop.farm || undefined,
        fromShift: coop.fromShift ?? false,
        mortality: coop.mortality ?? 0,
        sold: coop.sold ?? 0,
        ...addedBy(coop.addedBy),
        // A MongoDB id carries the time it was made at
        createdAt: coop._id.getTimestamp(),
      },
    });
  }
  batchIds.add(id(batch._id));
  count(copied, 'batches');
}

// A photo as stored in MongoDB, as a Photo row; null when it has no image
function photoRow(photo, position, fallback = {}) {
  if (!photo?.data) return null;
  const location = photo.location ?? fallback.location ?? {};
  return {
    position,
    data: Buffer.from(photo.data.buffer ?? photo.data),
    contentType: photo.contentType ?? 'image/jpeg',
    lat: location.lat ?? 0,
    lng: location.lng ?? 0,
    accuracy: location.accuracy,
    capturedAt: photo.capturedAt ?? fallback.capturedAt ?? fallback.createdAt,
  };
}

// The photos of a mortality or vaccination record: the first one's position and
// time are on the record itself, the further ones in `morePhotos`
const evidence = (record) =>
  [record.photo, ...(record.morePhotos ?? [])]
    .map((photo, position) =>
      photoRow(photo, position, position === 0 ? record : { createdAt: record.createdAt })
    )
    .filter(Boolean)
    .map((photo, position) => ({ ...photo, position }));

// Copies the records of one collection. `row` gives the columns that are not
// shared by every kind of record. One whose batch is gone is left out.
async function copyRecords(collection, model, row) {
  for await (const record of each(collection)) {
    if (!batchIds.has(id(record.batch))) {
      count(skipped, collection);
      continue;
    }
    await prisma[model].create({
      data: {
        id: id(record._id),
        batchId: id(record.batch),
        ...row(record),
        ...createdBy(record.createdBy),
        ...stamps(record),
      },
    });
    count(copied, collection);
  }
}

// The coop a record is about, as every such record has it
const coopOf = (record) => ({ coopId: id(record.coopId), coopName: record.coopName });

await copyRecords('shifts', 'shift', (shift) => ({
  fromCoopId: id(shift.fromCoopId),
  fromCoopName: shift.fromCoopName,
  fromFarm: shift.fromFarm ?? '',
  toCoopId: id(shift.toCoopId),
  toCoopName: shift.toCoopName,
  toFarm: shift.toFarm ?? '',
  birds: shift.birds,
  mortality: shift.mortality ?? 0,
  reason: shift.reason,
  date: shift.date ?? shift.createdAt,
}));

await copyRecords('mortalities', 'mortality', (record) => ({
  ...coopOf(record),
  type: record.type,
  shiftId: id(record.shift),
  birds: record.birds,
  reason: record.reason,
  photos: { create: evidence(record) },
}));

await copyRecords('vaccinations', 'vaccination', (record) => ({
  ...coopOf(record),
  date: record.date,
  vaccine: record.vaccine,
  schedule: record.schedule ?? '',
  remarks: record.remarks ?? '',
  birds: record.birds,
  photos: { create: evidence(record) },
}));

await copyRecords('feeds', 'feed', (record) => ({
  ...coopOf(record),
  farm: record.farm ?? '',
  date: record.date,
  feedType: record.feedType,
  feedCompany: record.feedCompany ?? '',
  quantityKg: record.quantityKg,
  remarks: record.remarks ?? '',
}));

await copyRecords('weights', 'weight', (record) => ({
  ...coopOf(record),
  farm: record.farm ?? '',
  date: record.date,
  birds: record.birds,
  totalWeightKg: record.totalWeightKg,
  avgWeightG: record.avgWeightG,
  remarks: record.remarks ?? '',
}));

// --- Sales, each with its sets and their photos
for await (const sale of each('sales')) {
  const sets = sale.sets ?? [];
  if (sets.some((set) => !batchIds.has(id(set.batch)))) {
    count(skipped, 'sales');
    continue;
  }
  const payment = sale.payment ?? {};
  await prisma.sale.create({
    data: {
      id: id(sale._id),
      date: sale.date,
      customerName: sale.customer?.name ?? '',
      customerPhone: sale.customer?.phone ?? '',
      customerAddress: sale.customer?.address ?? '',
      sets: {
        create: sets.map((set, position) => ({
          position,
          batchId: id(set.batch),
          ...coopOf(set),
          farm: set.farm ?? '',
          gender: set.gender,
          birds: set.birds,
          boxes: set.boxes ?? 0,
          boxWeightEmpty: set.boxWeightEmpty ?? 0,
          boxWeightGross: set.boxWeightGross ?? 0,
          weightKg: set.weightKg ?? 0,
          photos: {
            create: (set.photos ?? [])
              .map((photo) => photoRow(photo, 0, sale))
              .filter(Boolean)
              .map((photo, at) => ({ ...photo, position: at })),
          },
        })),
      },
      ratePerKg: sale.ratePerKg ?? 0,
      maleRate: sale.maleRate ?? 0,
      femaleRate: sale.femaleRate ?? 0,
      boxMode: sale.boxMode ?? 'own',
      boxQty: sale.boxQty ?? 0,
      boxRate: sale.boxRate ?? 0,
      boxReturned: sale.boxReturned ?? 0,
      present: (sale.present ?? []).map((person) => ({
        name: person.name ?? '',
        phone: person.phone ?? '',
      })),
      notes: sale.notes ?? '',
      paymentStatus: payment.status ?? 'unpaid',
      amountPaid: payment.amountPaid ?? 0,
      paymentMode: payment.mode,
      paymentReference: payment.reference ?? '',
      ...(payment.proof?.data && {
        paymentProof: Buffer.from(payment.proof.data.buffer ?? payment.proof.data),
        paymentProofType: payment.proof.contentType ?? 'image/jpeg',
      }),
      hasProof: Boolean(payment.proof?.data),
      birds: sale.birds,
      maleBirds: sale.maleBirds ?? 0,
      femaleBirds: sale.femaleBirds ?? 0,
      weightKg: sale.weightKg ?? 0,
      maleWeightKg: sale.maleWeightKg ?? 0,
      femaleWeightKg: sale.femaleWeightKg ?? 0,
      birdBill: sale.birdBill ?? 0,
      maleBill: sale.maleBill ?? 0,
      femaleBill: sale.femaleBill ?? 0,
      boxBill: sale.boxBill ?? 0,
      amount: sale.amount ?? 0,
      ...createdBy(sale.createdBy),
      ...stamps(sale),
    },
  });
  count(copied, 'sales');
}

// --- Feed bought into the store
for await (const purchase of each('feedpurchases')) {
  await prisma.feedPurchase.create({
    data: {
      id: id(purchase._id),
      date: purchase.date,
      feedType: purchase.feedType,
      feedCompany: purchase.feedCompany ?? '',
      quantityKg: purchase.quantityKg,
      ratePerKg: purchase.ratePerKg,
      amount: purchase.amount,
      remarks: purchase.remarks ?? '',
      ...createdBy(purchase.createdBy),
      ...stamps(purchase),
    },
  });
  count(copied, 'feed purchases');
}

const list = (tally) =>
  Object.entries(tally)
    .map(([what, many]) => `${many} ${what}`)
    .join(', ');
console.log(`Copied: ${list(copied) || 'nothing, MongoDB is empty'}.`);
if (Object.keys(skipped).length > 0) {
  // Options doubled in MongoDB, and records of a batch that no longer exists
  console.warn(`Left out: ${list(skipped)}.`);
}
await finish(0);
