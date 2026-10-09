import { Router } from 'express';
import { checkBroodingAge } from '../age.js';
import { actor } from '../auth.js';
import { findBatch, withCoops } from '../batches.js';
import prisma from '../db.js';
import { badRequest } from '../evidence.js';
import { checkCoopFree } from '../occupancy.js';
import { listedCoop, listedFarm } from '../options.js';
import { addedBy, batchJson, createdBy } from '../serialize.js';
import { parseDate, requiredText, text } from '../validate.js';

const router = Router();

const AGE_UNITS = ['days', 'weeks'];

router.get('/', async (req, res, next) => {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
      include: withCoops,
    });
    res.json(batches.map(batchJson));
  } catch (err) {
    next(err);
  }
});

// What the Enter Batch form sends, checked and as the columns of a batch
function parseBatch(body) {
  const { vendor } = body;
  const batchName = requiredText(body.batchName, 'Batch name is required');
  const startDate = parseDate(body.startDate, 'Batch start date is required');
  const breed = requiredText(body.breed, 'Breed is required');

  if (body.age == null || body.age === '') throw badRequest('Age of the birds is required');
  const age = Number(body.age);
  if (!Number.isFinite(age)) throw badRequest('Age of the birds is not valid');
  if (age < 0) throw badRequest('Age cannot be negative');
  const ageUnit = body.ageUnit || 'days';
  if (!AGE_UNITS.includes(ageUnit)) throw badRequest('Select days or weeks for the age');

  if (body.numberOfBirds == null || body.numberOfBirds === '') {
    throw badRequest('Number of birds is required');
  }
  const numberOfBirds = Number(body.numberOfBirds);
  if (!Number.isInteger(numberOfBirds)) throw badRequest('Number of birds must be a whole number');
  if (numberOfBirds < 1) throw badRequest('Number of birds must be at least 1');

  // Birds found dead in the delivery boxes on arrival
  const boxMortality = Number(body.boxMortality ?? 0);
  if (!Number.isInteger(boxMortality)) throw badRequest('Mortality must be a whole number');
  if (boxMortality < 0) throw badRequest('Mortality cannot be negative');
  if (boxMortality > numberOfBirds) {
    throw badRequest('Mortality cannot be more than the number of birds');
  }

  const vendorName = requiredText(vendor?.name, 'Vendor name is required');
  const enteredBy = requiredText(body.enteredBy, 'Entered by is required');
  if (enteredBy.length > 40) throw badRequest('Entered by is too long');

  return {
    batchName,
    startDate,
    breed,
    age,
    ageUnit,
    numberOfBirds,
    boxMortality,
    vendorName,
    vendorPhone: text(vendor?.phone),
    vendorDetails: text(vendor?.details),
    enteredBy,
  };
}

router.post('/', async (req, res, next) => {
  try {
    // Coops belong to a farm, so every batch needs one from the list
    const farm = await listedFarm(req.body.shiftToFarm);
    if (!farm) return res.status(400).json({ message: 'Select a farm' });

    const batch = await prisma.batch.create({
      data: { ...parseBatch(req.body), shiftToFarm: farm, ...createdBy(actor(req)) },
      include: withCoops,
    });
    res.status(201).json(batchJson(batch));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/coops', async (req, res, next) => {
  try {
    const batch = await findBatch(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const birds = Number(req.body.birds);
    if (!String(req.body.name ?? '').trim()) {
      return res.status(400).json({ message: 'Select a coop' });
    }
    // A batch can be spread over several farms; without one the coop is on the batch's own
    const farm = await listedFarm(req.body.farm || batch.shiftToFarm);
    if (!farm) return res.status(400).json({ message: 'Select a farm' });
    // Each farm has a fixed list of coops; new ones are added through /api/options/coops
    const name = await listedCoop(req.body.name, farm);
    if (!name) return res.status(400).json({ message: 'Select a coop from the list' });
    checkBroodingAge(batch, name);
    await checkCoopFree(batch, farm, name);
    if (!Number.isInteger(birds) || birds < 1) {
      return res
        .status(400)
        .json({ message: 'Number of birds must be a whole number of at least 1' });
    }
    // Coops on different farms may share a name
    const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const farmOf = (coop) => coop.farm || batch.shiftToFarm || '';
    const onOwnFarm = same(farm, batch.shiftToFarm ?? '');
    if (batch.coops.some((coop) => same(farmOf(coop), farm) && same(coop.name, name))) {
      return res.status(400).json({
        message: `Coop "${name}"${onOwnFarm ? '' : ` on ${farm}`} already exists in this batch`,
      });
    }

    const allocated = batch.coops.reduce((sum, coop) => sum + coop.birds, 0);
    const unallocated = batch.numberOfBirds - batch.boxMortality - allocated;
    if (birds > unallocated) {
      return res
        .status(400)
        .json({ message: `Only ${unallocated} birds are left to allocate in this batch` });
    }

    await prisma.coop.create({
      data: {
        batchId: batch.id,
        name,
        birds,
        ...(!onOwnFarm && { farm }),
        ...addedBy(actor(req)),
      },
    });
    res.status(201).json(batchJson(await findBatch(batch.id)));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/coops/:coopId', async (req, res, next) => {
  try {
    const batch = await findBatch(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const coop = batch.coops.find((other) => other.id === req.params.coopId);
    if (!coop) return res.status(404).json({ message: 'Coop not found' });

    if (coop.mortality > 0) {
      return res
        .status(400)
        .json({ message: `${coop.name} has registered mortality and cannot be removed` });
    }

    if (coop.sold > 0) {
      return res
        .status(400)
        .json({ message: `${coop.name} has birds sold from it and cannot be removed` });
    }

    await prisma.coop.delete({ where: { id: coop.id } });
    res.json(batchJson(await findBatch(batch.id)));
  } catch (err) {
    next(err);
  }
});

export default router;
