import { Router } from 'express';
import mongoose from 'mongoose';
import Batch from '../models/Batch.js';
import Mortality, { MORTALITY_TYPES, placeType } from '../models/Mortality.js';
import Feed from '../models/Feed.js';
import Vaccination from '../models/Vaccination.js';
import Weight from '../models/Weight.js';
import { actor } from '../auth.js';
import { badRequest, parseEvidence } from '../evidence.js';

async function findBatchAndCoop({ batchId, coopId }) {
  const batch = mongoose.isValidObjectId(batchId) ? await Batch.findById(batchId) : null;
  if (!batch) throw badRequest('Select a farm & batch');

  const coop = mongoose.isValidObjectId(coopId) ? batch.coops.id(coopId) : null;
  if (!coop) throw badRequest('Select a coop');

  return { batch, coop };
}

// A coop without its own farm is on the batch's farm
const farmOf = (batch, coop) => coop.farm || batch.shiftToFarm || '';

function parseBirds(value, coop) {
  const birds = Number(value);
  if (!Number.isInteger(birds) || birds < 1) {
    throw badRequest('Number of birds must be a whole number of at least 1');
  }
  const live = coop.birds - coop.mortality;
  if (birds > live) throw badRequest(`Only ${live} live birds are in ${coop.name}`);
  return birds;
}

function parseKg(value, label) {
  const kg = Number(value);
  if (!Number.isFinite(kg) || kg <= 0) throw badRequest(`${label} must be more than 0`);
  return kg;
}

// Every kind of record shares the same list / create endpoints, and those with
// photo evidence (mortality, vaccination) a photo endpoint
function recordRouter(Model, create, { photos = true } = {}) {
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
        .populate('batch', 'batchName shiftToFarm');
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  if (photos) {
    // /photo is the first photo, /photo/1 the second, and so on
    router.get('/:id/photo/:index?', async (req, res, next) => {
      try {
        const record = await Model.findById(req.params.id).select(
          '+photo.data +photo.contentType +morePhotos.data +morePhotos.contentType'
        );
        const index = Number(req.params.index ?? 0);
        const photo = index === 0 ? record?.photo : record?.morePhotos?.[index - 1];
        if (!photo?.data) return res.status(404).json({ message: 'Not found' });
        res.type(photo.contentType).send(photo.data);
      } catch (err) {
        next(err);
      }
    });
  }

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
  if (body.type && !MORTALITY_TYPES.includes(body.type)) {
    throw badRequest('Select the mortality type');
  }

  const record = new Mortality({
    batch: batch._id,
    type: body.type || placeType(coop.name),
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

export const feedRouter = recordRouter(
  Feed,
  async (body, createdBy) => {
    const { batch, coop } = await findBatchAndCoop(body);

    const record = await Feed.create({
      batch: batch._id,
      coopId: coop._id,
      coopName: coop.name,
      farm: farmOf(batch, coop),
      date: body.date,
      feedType: body.feedType,
      quantityKg: parseKg(body.quantityKg, 'Feed quantity'),
      remarks: body.remarks,
      createdBy,
    });
    return { id: record._id, batch };
  },
  { photos: false }
);

export const weightRouter = recordRouter(
  Weight,
  async (body, createdBy) => {
    const { batch, coop } = await findBatchAndCoop(body);
    const birds = parseBirds(body.birds, coop);
    const totalWeightKg = parseKg(body.totalWeightKg, 'Total weight');

    const record = await Weight.create({
      batch: batch._id,
      coopId: coop._id,
      coopName: coop.name,
      farm: farmOf(batch, coop),
      date: body.date,
      birds,
      totalWeightKg,
      avgWeightG: Math.round((totalWeightKg * 1000) / birds),
      remarks: body.remarks,
      createdBy,
    });
    return { id: record._id, batch };
  },
  { photos: false }
);
