import { Router } from 'express';
import mongoose from 'mongoose';
import Batch from '../models/Batch.js';
import Mortality from '../models/Mortality.js';
import Vaccination from '../models/Vaccination.js';
import { actor } from '../auth.js';
import { badRequest, parseEvidence } from '../evidence.js';

async function findBatchAndCoop({ batchId, coopId }) {
  const batch = mongoose.isValidObjectId(batchId) ? await Batch.findById(batchId) : null;
  if (!batch) throw badRequest('Select a farm & batch');

  const coop = mongoose.isValidObjectId(coopId) ? batch.coops.id(coopId) : null;
  if (!coop) throw badRequest('Select a coop');

  return { batch, coop };
}

function parseBirds(value, coop) {
  const birds = Number(value);
  if (!Number.isInteger(birds) || birds < 1) {
    throw badRequest('Number of birds must be a whole number of at least 1');
  }
  const live = coop.birds - coop.mortality;
  if (birds > live) throw badRequest(`Only ${live} live birds are in ${coop.name}`);
  return birds;
}

// Mortality and vaccination records share the same list / photo / create endpoints
function recordRouter(Model, create) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      // ?batch=<id> lists everything for one batch and ?all=true the whole history;
      // otherwise just the latest few overall
      const { batch, all } = req.query;
      if (batch !== undefined && !mongoose.isValidObjectId(batch)) return res.json([]);
      const records = await Model.find(batch ? { batch } : {})
        .sort({ createdAt: -1 })
        .limit(batch || all === 'true' ? 1000 : 20)
        .populate('batch', 'batchName');
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/photo', async (req, res, next) => {
    try {
      const record = await Model.findById(req.params.id).select('+photo.data +photo.contentType');
      if (!record) return res.status(404).json({ message: 'Not found' });
      res.type(record.photo.contentType).send(record.photo.data);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      res.status(201).json(await create(req.body, actor(req)));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const mortalityRouter = recordRouter(Mortality, async (body, createdBy) => {
  const { batch, coop } = await findBatchAndCoop(body);
  const birds = parseBirds(body.birds, coop);

  const record = new Mortality({
    batch: batch._id,
    coopId: coop._id,
    coopName: coop.name,
    birds,
    reason: body.reason,
    ...parseEvidence(body),
    createdBy,
  });
  await record.validate();

  coop.mortality += birds;
  await batch.save();
  await record.save();
  return { id: record._id, batch };
});

export const vaccinationRouter = recordRouter(Vaccination, async (body, createdBy) => {
  const { batch, coop } = await findBatchAndCoop(body);
  const birds = parseBirds(body.birds, coop);

  const record = await Vaccination.create({
    batch: batch._id,
    coopId: coop._id,
    coopName: coop.name,
    date: body.date,
    vaccine: body.vaccine,
    remarks: body.remarks,
    birds,
    ...parseEvidence(body),
    createdBy,
  });
  return { id: record._id, batch };
});
