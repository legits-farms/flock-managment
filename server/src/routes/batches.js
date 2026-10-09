import { Router } from 'express';
import { actor } from '../auth.js';
import Batch from '../models/Batch.js';
import { checkBroodingAge } from '../age.js';
import { checkCoopFree } from '../occupancy.js';
import { listedCoop, listedFarm } from '../options.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const batches = await Batch.find().sort({ createdAt: -1 });
    res.json(batches);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      batchName,
      startDate,
      breed,
      age,
      ageUnit,
      numberOfBirds,
      boxMortality,
      vendor,
      shiftToFarm,
      enteredBy,
    } = req.body;

    // Coops belong to a farm, so every batch needs one from the list
    const farm = await listedFarm(shiftToFarm);
    if (!farm) return res.status(400).json({ message: 'Select a farm' });

    const batch = await Batch.create({
      batchName,
      startDate,
      breed,
      age,
      ageUnit,
      numberOfBirds,
      boxMortality,
      vendor: {
        name: vendor?.name,
        phone: vendor?.phone,
        details: vendor?.details,
      },
      shiftToFarm: farm,
      enteredBy,
      createdBy: actor(req),
    });
    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/coops', async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
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

    batch.coops.push({ name, birds, ...(!onOwnFarm && { farm }), addedBy: actor(req) });
    await batch.save();
    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/coops/:coopId', async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const coop = batch.coops.id(req.params.coopId);
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

    coop.deleteOne();
    await batch.save();
    res.json(batch);
  } catch (err) {
    next(err);
  }
});

export default router;
