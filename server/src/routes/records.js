import { Router } from 'express';
import { actor } from '../auth.js';
import { MORTALITY_TYPES, coopLive, findBatch, placeType } from '../batches.js';
import prisma from '../db.js';
import { badRequest, parseEvidence } from '../evidence.js';
import { batchJsonFor, createdBy, recordJson } from '../serialize.js';
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
const created = async (record, batch, user) => ({
  id: record.id,
  batch: batchJsonFor(user)(await findBatch(batch.id)),
});

// Every kind of record shares the same list / create endpoints, and those with
// photo evidence (mortality, vaccination) a photo endpoint. `model` is the name
// of the record's table in Prisma. `only` narrows what a request lists, and
// `extend` adds endpoints of the record's own.
function recordRouter(model, create, { photos = true, only = () => ({}), extend } = {}) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      // ?batch=<id> lists everything for one batch and ?all=true the whole history;
      // otherwise just the latest few overall
      const { batch, all } = req.query;
      if (batch !== undefined && !parseId(batch)) return res.json([]);
      const records = await prisma[model].findMany({
        where: { ...(batch && { batchId: batch }), ...only(req) },
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
      res.status(201).json(await create(req.body, createdBy(actor(req)), req.user));
    } catch (err) {
      next(err);
    }
  });

  extend?.(router);
  return router;
}

// When the birds were lost. Only an admin may say: for everyone else it is now.
function parseMortalityDate(value, user) {
  if (value == null || value === '') return new Date();
  if (!user.isAdmin) throw badRequest('Only an admin can set the date of a mortality');
  const date = parseDate(value, 'The date is not valid');
  if (date > new Date()) throw badRequest('The date cannot be in the future');
  return date;
}

// Which mortality a request lists. Everything counted elsewhere is approved, so
// that is all the app is given, apart from the admin's list of what is waiting
// (?status=pending) and a security guard, who sees what became of their entries.
function mortalityListed(req) {
  if (req.query.status === 'pending') return { status: 'pending' };
  if (req.user.role === 'security') return {};
  return { status: 'approved' };
}

// An admin approving or rejecting mortality a security guard registered. Only on
// approval are the birds taken off the coop.
function mortalityDecisions(router) {
  router.post('/:id/decision', async (req, res, next) => {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Only an admin can approve mortality' });
      }
      const { decision } = req.body;
      if (decision !== 'approve' && decision !== 'reject') {
        throw badRequest('Choose Approve or Reject');
      }
      const record = await prisma.mortality.findUnique({ where: { id: req.params.id } });
      if (!record) return res.status(404).json({ message: 'Not found' });

      const approved = decision === 'approve';
      if (approved) {
        // Birds may have been sold or shifted since it was registered
        const batch = await findBatch(record.batchId);
        const coop = batch?.coops.find((other) => other.id === record.coopId);
        if (!coop) throw badRequest(`${record.coopName} no longer holds this batch`);
        parseBirds(record.birds, coop);
      }

      // Decided and taken off the coop together or not at all, and only while it
      // is still waiting, so two admins cannot count the same birds twice
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.mortality.updateMany({
          where: { id: record.id, status: 'pending' },
          data: {
            status: approved ? 'approved' : 'rejected',
            decidedById: req.user.id,
            decidedByName: req.user.name,
            decidedAt: new Date(),
          },
        });
        if (count === 0) throw badRequest('This mortality was already approved or rejected');
        if (approved) {
          await tx.coop.update({
            where: { id: record.coopId },
            data: { mortality: { increment: record.birds } },
          });
        }
      });

      res.json({
        id: record.id,
        status: approved ? 'approved' : 'rejected',
        batch: batchJsonFor(req.user)(await findBatch(record.batchId)),
      });
    } catch (err) {
      next(err);
    }
  });
}

export const mortalityRouter = recordRouter(
  'mortality',
  async (body, by, user) => {
    const { batch, coop } = await findBatchAndCoop(body);
    const birds = parseBirds(body.birds, coop);
    if (body.type && !MORTALITY_TYPES.includes(body.type)) {
      throw badRequest('Select the mortality type');
    }
    const reason = requiredText(body.reason, 'Reason is required');
    const date = parseMortalityDate(body.date, user);
    const photos = parseEvidence(body, user);

    // What a security guard registers waits for an admin, and takes no birds off the coop yet
    const pending = user.role === 'security';
    const save = prisma.mortality.create({
      data: {
        batchId: batch.id,
        type: body.type || placeType(coop.name),
        coopId: coop.id,
        coopName: coop.name,
        birds,
        reason,
        date,
        status: pending ? 'pending' : 'approved',
        photos: { create: photos },
        ...by,
      },
    });
    // Otherwise the record and the coop's count are saved together or not at all
    const [record] = await prisma.$transaction(
      pending
        ? [save]
        : [
            save,
            prisma.coop.update({ where: { id: coop.id }, data: { mortality: { increment: birds } } }),
          ]
    );
    return created(record, batch, user);
  },
  { only: mortalityListed, extend: mortalityDecisions }
);

export const vaccinationRouter = recordRouter('vaccination', async (body, by, user) => {
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
      photos: { create: parseEvidence(body, user) },
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
