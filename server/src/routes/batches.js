import { Router } from 'express';
import { actor } from '../auth.js';
import Batch from '../models/Batch.js';
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
    // Each farm has a fixed list of coops; new ones are added through /api/options/coops
    const name = await listedCoop(req.body.name, batch.shiftToFarm);
    if (!name) return res.status(400).json({ message: 'Select a coop from the list' });
    if (!Number.isInteger(birds) || birds < 1) {
      return res
        .status(400)
        .json({ message: 'Number of birds must be a whole number of at least 1' });
    }
    // Coops on another farm (birds shifted there) may share a name with one here
    const onOwnFarm = (coop) =>
      !coop.farm || coop.farm.toLowerCase() === (batch.shiftToFarm ?? '').toLowerCase();
    if (
      batch.coops.some((coop) => onOwnFarm(coop) && coop.name.toLowerCase() === name.toLowerCase())
    ) {
      return res.status(400).json({ message: `Coop "${name}" already exists in this batch` });
    }

    const allocated = batch.coops.reduce((sum, coop) => sum + coop.birds, 0);
    const unallocated = batch.numberOfBirds - batch.boxMortality - allocated;
    if (birds > unallocated) {
      return res
        .status(400)
        .json({ message: `Only ${unallocated} birds are left to allocate in this batch` });
    }

    batch.coops.push({ name, birds, addedBy: actor(req) });
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

    coop.deleteOne();
    await batch.save();
    res.json(batch);
  } catch (err) {
    next(err);
  }
});

export default router;
