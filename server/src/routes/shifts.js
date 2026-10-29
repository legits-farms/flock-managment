import { Router } from 'express';
import { checkBroodingAge } from '../age.js';
import { actor } from '../auth.js';
import { coopLive, findBatch } from '../batches.js';
import prisma from '../db.js';
import { badRequest, parseEvidence } from '../evidence.js';
import { checkCoopFree, coopOccupant } from '../occupancy.js';
import { addCoop, checkWholeCoop, listedCoop, listedFarm, nextPartName } from '../options.js';
import { checkCoopOnFarm, checkFarm, optionsFor, shiftScope } from '../scope.js';
import { addedBy, batchJsonFor, createdBy, recordJson } from '../serialize.js';
import { parseDate, parseId, requiredText } from '../validate.js';

const router = Router();

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

router.get('/', async (req, res, next) => {
  try {
    // ?batch=<id> lists one batch's shifts and ?all=true the whole history
    const { batch, all } = req.query;
    if (batch !== undefined && !parseId(batch)) return res.json([]);
    const shifts = await prisma.shift.findMany({
      where: { ...(batch && { batchId: batch }), ...shiftScope(req.user) },
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
// A coop another batch is in takes the birds only when `into` says how:
//   'batch' – they join that batch in the same coop
//   'part'  – a new part of the coop is added and they go there
// Responds with { id, batch } carrying the updated batch, plus `joined` (the
// batch the birds joined) or `options` (the lists with the new part).
router.post('/', async (req, res, next) => {
  try {
    const { batchId, fromCoopId, toFarm, into } = req.body;
    if (into !== undefined && into !== 'batch' && into !== 'part') {
      throw badRequest('Choose whether the birds join the batch in the coop or go to a new part');
    }

    const batch = await findBatch(batchId);
    if (!batch) throw badRequest('Select the batch to shift');
    const from = batch.coops.find((coop) => coop.id === fromCoopId);
    if (!from) throw badRequest('Select the coop to shift from');
    checkCoopOnFarm(req.user, batch, from);

    const farm = await listedFarm(toFarm);
    if (!farm) throw badRequest('Select the farm to shift to');
    // A manager moves birds about their own farm; sending them to another is for staff
    checkFarm(req.user, farm);
    const chosen = await listedCoop(req.body.toCoop, farm);
    if (!chosen) throw badRequest('Select the coop to shift to');
    checkBroodingAge(batch, chosen);
    await checkWholeCoop(chosen, farm);
    // The batch the birds join, when they go into its coop
    const occupant = into === 'batch' ? await coopOccupant(batch, farm, chosen) : null;
    if (into === 'batch' && !occupant) {
      throw badRequest(`No other batch is in ${chosen}. Shift the birds there as usual`);
    }
    if (!into) await checkCoopFree(batch, farm, chosen);
    // The new part is only named here; it is added once everything else checks out
    const coopName = into === 'part' ? await nextPartName(chosen, farm) : chosen;

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
    const existing = occupant
      ? occupant.coop
      : batch.coops.find((coop) => same(coop.name, coopName) && same(farmOf(coop), farm));
    const arrived = birds - mortality;
    const options = into === 'part' ? await addCoop(farm, coopName, who) : null;

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
        data: { birds: { increment: arrived } },
      });

      // Birds that joined another batch are counted with that batch from now on,
      // so each batch's coops still add up to the birds it has
      if (occupant) {
        await tx.batch.update({
          where: { id: batch.id },
          data: { numberOfBirds: { decrement: arrived } },
        });
        await tx.batch.update({
          where: { id: occupant.batch.id },
          data: { numberOfBirds: { increment: arrived } },
        });
      }
      return made;
    });

    const json = batchJsonFor(req.user);
    res.status(201).json({
      id: shift.id,
      batch: json(await findBatch(batch.id)),
      ...(occupant && { joined: json(await findBatch(occupant.batch.id)) }),
      ...(options && { options: optionsFor(req.user, options) }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
