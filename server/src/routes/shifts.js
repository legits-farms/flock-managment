import { Router } from 'express';
import mongoose from 'mongoose';
import { actor } from '../auth.js';
import { badRequest } from '../evidence.js';
import Batch from '../models/Batch.js';
import Shift from '../models/Shift.js';
import { listedCoop, listedFarm } from '../options.js';

const router = Router();

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

router.get('/', async (req, res, next) => {
  try {
    // ?batch=<id> lists one batch's shifts and ?all=true the whole history
    const { batch, all } = req.query;
    if (batch !== undefined && !mongoose.isValidObjectId(batch)) return res.json([]);
    const shifts = await Shift.find(batch ? { batch } : {})
      .sort({ createdAt: -1 })
      .limit(batch || all === 'true' ? 1000 : 20)
      .populate('batch', 'batchName');
    res.json(shifts);
  } catch (err) {
    next(err);
  }
});

// Moves live birds of one batch from one of its coops to another coop.
// Responds with { id, batch } carrying the updated batch.
router.post('/', async (req, res, next) => {
  try {
    const { batchId, fromCoopId, toFarm, toCoop, reason, date } = req.body;

    const batch = mongoose.isValidObjectId(batchId) ? await Batch.findById(batchId) : null;
    if (!batch) throw badRequest('Select the batch to shift');
    const from = mongoose.isValidObjectId(fromCoopId) ? batch.coops.id(fromCoopId) : null;
    if (!from) throw badRequest('Select the coop to shift from');

    const farm = await listedFarm(toFarm);
    if (!farm) throw badRequest('Select the farm to shift to');
    const coopName = await listedCoop(toCoop, farm);
    if (!coopName) throw badRequest('Select the coop to shift to');

    const birds = Number(req.body.birds);
    if (!Number.isInteger(birds) || birds < 1) {
      throw badRequest('Number of birds must be a whole number of at least 1');
    }
    const live = from.birds - from.mortality;
    if (birds > live) throw badRequest(`Only ${live} live birds are in ${from.name}`);

    // A coop without its own farm is on the batch's farm
    const farmOf = (coop) => coop.farm || batch.shiftToFarm || '';
    if (same(from.name, coopName) && same(farmOf(from), farm)) {
      throw badRequest('Choose a different coop to shift to');
    }

    const addedBy = actor(req);
    let to = batch.coops.find((coop) => same(coop.name, coopName) && same(farmOf(coop), farm));
    if (!to) {
      batch.coops.push({ name: coopName, birds: 0, farm, fromShift: true, addedBy });
      to = batch.coops[batch.coops.length - 1];
    }

    const shift = new Shift({
      batch: batch._id,
      fromCoopId: from._id,
      fromCoopName: from.name,
      fromFarm: farmOf(from),
      toCoopId: to._id,
      toCoopName: to.name,
      toFarm: farm,
      birds,
      reason,
      date,
      createdBy: addedBy,
    });
    await shift.validate();

    from.birds -= birds;
    to.birds += birds;
    await batch.save();
    await shift.save();
    res.status(201).json({ id: shift._id, batch });
  } catch (err) {
    next(err);
  }
});

export default router;
