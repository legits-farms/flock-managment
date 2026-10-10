import { Router } from 'express';
import { checkBroodingAge } from '../age.js';
import { actor } from '../auth.js';
import { coopLive, findBatch } from '../batches.js';
import prisma from '../db.js';
import { badRequest, parseEvidence } from '../evidence.js';
import { checkCoopFree } from '../occupancy.js';
import { listedCoop, listedFarm } from '../options.js';
import { addedBy, batchJson, createdBy, recordJson } from '../serialize.js';
import { parseDate, parseId, requiredText } from '../validate.js';

const router = Router();

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

router.get('/', async (req, res, next) => {
  try {
    // ?batch=<id> lists one batch's shifts and ?all=true the whole history
    const { batch, all } = req.query;
    if (batch !== undefined && !parseId(batch)) return res.json([]);
    const shifts = await prisma.shift.findMany({
      where: batch ? { batchId: batch } : {},
      orderBy: { createdAt: 'desc' },
      take: batch || all === 'true' ? 1000 : 20,
      include: { batch: { select: { id: true, batchName: true } } },
    });
    res.json(shifts.map(recordJson));
  } catch (err) {
    next(err);
  }
});

// Moves live birds of one batch from one of its coops to another coop. Any that
// died on the way (`mortality`) need the same photo evidence as a mortality record.
// Responds with { id, batch } carrying the updated batch.
router.post('/', async (req, res, next) => {
  try {
    const { batchId, fromCoopId, toFarm, toCoop } = req.body;

    const batch = await findBatch(batchId);
    if (!batch) throw badRequest('Select the batch to shift');
    const from = batch.coops.find((coop) => coop.id === fromCoopId);
    if (!from) throw badRequest('Select the coop to shift from');

    const farm = await listedFarm(toFarm);
    if (!farm) throw badRequest('Select the farm to shift to');
    const coopName = await listedCoop(toCoop, farm);
    if (!coopName) throw badRequest('Select the coop to shift to');
    checkBroodingAge(batch, coopName);
    await checkCoopFree(batch, farm, coopName);

    const birds = Number(req.body.birds);
    if (!Number.isInteger(birds) || birds < 1) {
      throw badRequest('Number of birds must be a whole number of at least 1');
    }
    const live = coopLive(from);
    if (birds > live) throw badRequest(`Only ${live} live birds are in ${from.name}`);

    // Birds that died on the way: they leave the coop but never reach the other one
    const mortality = Number(req.body.mortality ?? 0);
    if (!Number.isInteger(mortality) || mortality < 0) {
      throw badRequest('Mortality during the shift must be a whole number');
    }
    if (mortality >= birds) {
      throw badRequest('Mortality during the shift must be less than the birds shifted');
    }

    // A coop without its own farm is on the batch's farm
    const farmOf = (coop) => coop.farm || batch.shiftToFarm || '';
    if (same(from.name, coopName) && same(farmOf(from), farm)) {
      throw badRequest('Choose a different coop to shift to');
    }

    const reason = requiredText(req.body.reason, 'Reason is required');
    const date = parseDate(req.body.date, 'Shift date is required');
    const photos = mortality > 0 ? parseEvidence(req.body, req.user) : null;
    const who = actor(req);
    const existing = batch.coops.find(
      (coop) => same(coop.name, coopName) && same(farmOf(coop), farm)
    );

    // The shift, its mortality and the two coops' counts are saved together or not at all
    const shift = await prisma.$transaction(async (tx) => {
      const to =
        existing ??
        (await tx.coop.create({
          data: {
            batchId: batch.id,
            name: coopName,
            birds: 0,
            farm,
            fromShift: true,
            ...addedBy(who),
          },
        }));

      const made = await tx.shift.create({
        data: {
          batchId: batch.id,
          fromCoopId: from.id,
          fromCoopName: from.name,
          fromFarm: farmOf(from),
          toCoopId: to.id,
          toCoopName: to.name,
          toFarm: farm,
          birds,
          mortality,
          reason,
          date,
          ...createdBy(who),
        },
      });

      // Shift mortality is registered like any other, against the coop the birds left
      if (photos) {
        await tx.mortality.create({
          data: {
            batchId: batch.id,
            type: 'shift',
            shiftId: made.id,
            coopId: from.id,
            coopName: from.name,
            birds: mortality,
            reason: `Died during the shift to ${to.name}`,
            date,
            photos: { create: photos },
            ...createdBy(who),
          },
        });
      }

      await tx.coop.update({
        where: { id: from.id },
        data: { birds: { decrement: birds - mortality }, mortality: { increment: mortality } },
      });
      await tx.coop.update({
        where: { id: to.id },
        data: { birds: { increment: birds - mortality } },
      });
      return made;
    });

    res.status(201).json({ id: shift.id, batch: batchJson(await findBatch(batch.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
