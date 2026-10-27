import { Router } from 'express';
import { actor } from '../auth.js';
import prisma from '../db.js';
import { badRequest } from '../evidence.js';
import { listedFarm } from '../options.js';
import { batchScope, checkFarm } from '../scope.js';
import { createdBy } from '../serialize.js';
import { parseId, requiredText, text } from '../validate.js';

const router = Router();

const named = (value) => ({ equals: value, mode: 'insensitive' });

// Which page's notes a request is about, from ?batch=<id> or ?farm=<farm>&coop=<name>
// (or the same in the body): a Prisma filter, checked against a manager's farm
async function notesOf({ batch: rawBatch, batchId, farm: rawFarm, coop: rawCoop }, user) {
  const id = parseId(batchId ?? rawBatch);
  if (id) {
    const batch = await prisma.batch.findFirst({
      where: { id, ...batchScope(user) },
      select: { id: true },
    });
    if (!batch) throw badRequest('Batch not found');
    return { batchId: batch.id };
  }

  const farm = await listedFarm(rawFarm);
  const coop = text(rawCoop);
  if (!farm || !coop) throw badRequest('Select a batch, or a farm and a coop');
  checkFarm(user, farm);
  return { farm: named(farm), coopName: named(coop) };
}

const noteJson = (note, user) => ({
  _id: note.id,
  text: note.text,
  createdBy: { name: note.createdByName },
  createdAt: note.createdAt,
  // Whoever wrote a note, or an admin, can delete it
  canDelete: user.isAdmin || note.createdById === user.id,
});

// A page's notes, newest first
router.get('/', async (req, res, next) => {
  try {
    const where = await notesOf(req.query, req.user);
    const notes = await prisma.note.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(notes.map((note) => noteJson(note, req.user)));
  } catch (err) {
    next(err);
  }
});

// { batchId } or { farm, coop }, with the note's text
router.post('/', async (req, res, next) => {
  try {
    const where = await notesOf(req.body, req.user);
    const body = requiredText(req.body.text, 'Write the note');
    if (body.length > 2000) throw badRequest('The note is too long');
    const page = where.batchId
      ? { batchId: where.batchId }
      : { farm: where.farm.equals, coopName: text(req.body.coop) };
    const note = await prisma.note.create({
      data: { ...page, text: body, ...createdBy(actor(req)) },
    });
    res.status(201).json(noteJson(note, req.user));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!noteJson(note, req.user).canDelete) {
      return res.status(403).json({ message: 'Only whoever wrote the note or an admin can delete it' });
    }
    await prisma.note.delete({ where: { id: note.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
