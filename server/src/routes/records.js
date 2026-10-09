import { Router } from 'express';
import { actor } from '../auth.js';
import { MORTALITY_TYPES, coopLive, findBatch, placeType } from '../batches.js';
import prisma from '../db.js';
import { badRequest, parseEvidence } from '../evidence.js';
import { batchJson, createdBy, recordJson } from '../serialize.js';
import { parseDate, parseId, requiredText, text } from '../validate.js';

async function findBatchAndCoop({ batchId, coopId }) {
  const batch = await findBatch(batchId);
  if (!batch) throw badRequest('Select a farm & batch');

  const coop = batch.coops.find((other) => other.id === coopId);
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
  const live = coopLive(coop);
  if (birds > live) throw badRequest(`Only ${live} live birds are in ${coop.name}`);
  return birds;
}

function parseKg(value, label) {
  const kg = Number(value);
  if (!Number.isFinite(kg) || kg <= 0) throw badRequest(`${label} must be more than 0`);
  return kg;
}

// What a new record answers with: its id and the batch as it is now
const created = async (record, batch) => ({
  id: record.id,
  batch: batchJson(await findBatch(batch.id)),
});

// Every kind of record shares the same list / create endpoints, and those with
// photo evidence (mortality, vaccination) a photo endpoint. `model` is the name
// of the record's table in Prisma.
function recordRouter(model, create, { photos = true } = {}) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      // ?batch=<id> lists everything for one batch and ?all=true the whole history;
      // otherwise just the latest few overall
      const { batch, all } = req.query;
      if (batch !== undefined && !parseId(batch)) return res.json([]);
      const records = await prisma[model].findMany({
        where: batch ? { batchId: batch } : {},
        orderBy: { createdAt: 'desc' },
        take: batch || all === 'true' ? 1000 : 20,
        include: {
          batch: { select: { id: true, batchName: true, shiftToFarm: true } },
          // Where and when each photo was taken; the images are left out
          ...(photos && { photos: { orderBy: { position: 'asc' } } }),
        },
      });
      res.json(records.map(recordJson));
    } catch (err) {
      next(err);
    }
  });

  if (photos) {
    // /photo is the first photo, /photo/1 the second, and so on
    router.get('/:id/photo/:index?', async (req, res, next) => {
      try {
        const position = Number(req.params.index ?? 0);
        const photo = Number.isInteger(position)
          ? await prisma.photo.findFirst({
              where: { [`${model}Id`]: req.params.id, position },
              omit: { data: false },
            })
          : null;
        if (!photo) return res.status(404).json({ message: 'Not found' });
        res.type(photo.contentType).send(Buffer.from(photo.data));
      } catch (err) {
        next(err);
      }
    });
  }

  router.post('/', async (req, res, next) => {
    try {
      res.status(201).json(await create(req.body, createdBy(actor(req))));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const mortalityRouter = recordRouter('mortality', async (body, by) => {
  const { batch, coop } = await findBatchAndCoop(body);
  const birds = parseBirds(body.birds, coop);
  if (body.type && !MORTALITY_TYPES.includes(body.type)) {
    throw badRequest('Select the mortality type');
  }
  const reason = requiredText(body.reason, 'Reason is required');
  const photos = parseEvidence(body);

  // The record and the coop's count are saved together or not at all
  const [record] = await prisma.$transaction([
    prisma.mortality.create({
      data: {
        batchId: batch.id,
        type: body.type || placeType(coop.name),
        coopId: coop.id,
        coopName: coop.name,
        birds,
        reason,
        photos: { create: photos },
        ...by,
      },
    }),
    prisma.coop.update({ where: { id: coop.id }, data: { mortality: { increment: birds } } }),
  ]);
  return created(record, batch);
});

export const vaccinationRouter = recordRouter('vaccination', async (body, by) => {
  const { batch, coop } = await findBatchAndCoop(body);
  const birds = parseBirds(body.birds, coop);

  const record = await prisma.vaccination.create({
    data: {
      batchId: batch.id,
      coopId: coop.id,
      coopName: coop.name,
      date: parseDate(body.date, 'Vaccination date is required'),
      vaccine: requiredText(body.vaccine, 'Vaccine is required'),
      schedule: text(body.schedule),
      remarks: text(body.remarks),
      birds,
      photos: { create: parseEvidence(body) },
      ...by,
    },
  });
  return created(record, batch);
});

export const feedRouter = recordRouter(
  'feed',
  async (body, by) => {
    const { batch, coop } = await findBatchAndCoop(body);

    const record = await prisma.feed.create({
      data: {
        batchId: batch.id,
        coopId: coop.id,
        coopName: coop.name,
        farm: farmOf(batch, coop),
        date: parseDate(body.date, 'Date is required'),
        feedType: requiredText(body.feedType, 'Feed type is required'),
        feedCompany: text(body.feedCompany),
        quantityKg: parseKg(body.quantityKg, 'Feed quantity'),
        remarks: text(body.remarks),
        ...by,
      },
    });
    return created(record, batch);
  },
  { photos: false }
);

export const weightRouter = recordRouter(
  'weight',
  async (body, by) => {
    const { batch, coop } = await findBatchAndCoop(body);
    const birds = parseBirds(body.birds, coop);
    const totalWeightKg = parseKg(body.totalWeightKg, 'Total weight');

    const record = await prisma.weight.create({
      data: {
        batchId: batch.id,
        coopId: coop.id,
        coopName: coop.name,
        farm: farmOf(batch, coop),
        date: parseDate(body.date, 'Date is required'),
        birds,
        totalWeightKg,
        avgWeightG: Math.round((totalWeightKg * 1000) / birds),
        remarks: text(body.remarks),
        ...by,
      },
    });
    return created(record, batch);
  },
  { photos: false }
);
