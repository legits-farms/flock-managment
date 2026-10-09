import { Router } from 'express';
import { actor } from '../auth.js';
import { coopLive, findBatch } from '../batches.js';
import prisma from '../db.js';
import { badRequest, parsePhoto, photoRows } from '../evidence.js';
import { batchJson, createdBy, saleJson } from '../serialize.js';
import { parseDate, parseId, text } from '../validate.js';

const router = Router();

const GENDERS = ['male', 'female'];
// Whose boxes the birds left in: the customer's own, ours on loan, or ours sold with the birds
const BOX_MODES = ['own', 'borrow', 'buy'];

// How much of the bill has been paid, and how it was paid
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
const PAYMENT_MODES = ['cash', 'upi', 'bank'];

// Photos of one weighed set, and of a whole sale. Keeps a request under the JSON body limit.
const MAX_SET_PHOTOS = 2;
const MAX_SALE_PHOTOS = 8;

const round = (value, places) => Number(value.toFixed(places));

// An amount that may be left empty: 0 or more
function parseAmount(value, label) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw badRequest(`${label} cannot be negative`);
  return amount;
}

function parseCount(value, label) {
  const count = parseAmount(value, label);
  if (!Number.isInteger(count)) throw badRequest(`${label} must be a whole number`);
  return count;
}

const MAX_PROOF_BYTES = 3 * 1024 * 1024;

// What was paid towards a bill of `amount` rupees, from the `payment` of the request:
// { status, amountPaid, mode, reference, proof } with the proof a picture as a data URL.
// Resolves to the payment columns of a sale.
function parsePayment(raw = {}, amount) {
  const paymentStatus = raw.status || 'unpaid';
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    throw badRequest('Select paid, partly paid or unpaid');
  }
  if (paymentStatus === 'unpaid') return { paymentStatus, amountPaid: 0 };

  let amountPaid = amount;
  if (paymentStatus === 'partial') {
    amountPaid = Number(raw.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) throw badRequest('Enter the amount paid');
    if (amountPaid >= amount) {
      throw badRequest('The amount paid must be less than the total bill');
    }
  }
  if (!PAYMENT_MODES.includes(raw.mode)) throw badRequest('Select how it was paid');

  const payment = {
    paymentStatus,
    amountPaid,
    paymentMode: raw.mode,
    paymentReference: String(raw.reference ?? '').trim().slice(0, 100),
  };
  if (!raw.proof) return payment;

  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+=*)$/.exec(
    typeof raw.proof === 'string' ? raw.proof : ''
  );
  if (!match) throw badRequest('The payment photo must be a picture');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_PROOF_BYTES) throw badRequest('Photo is too large');
  return { ...payment, paymentProof: data, paymentProofType: match[1], hasProof: true };
}

// "+91 98765-43210" -> "9876543210"
function parsePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) throw badRequest('Enter a valid 10-digit mobile number');
  return digits;
}

// The n-th of something, from the address: a whole number from 0, or null
function parseIndex(value) {
  const index = Number(value ?? 0);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

router.get('/', async (req, res, next) => {
  try {
    // ?batch=<id> lists the sales out of one batch and ?all=true the whole history
    const { batch, all } = req.query;
    if (batch !== undefined && !parseId(batch)) return res.json([]);
    const sales = await prisma.sale.findMany({
      where: batch ? { sets: { some: { batchId: batch } } } : {},
      orderBy: { createdAt: 'desc' },
      take: batch || all === 'true' ? 1000 : 20,
      include: {
        sets: {
          orderBy: { position: 'asc' },
          include: {
            batch: { select: { id: true, batchName: true, breed: true } },
            // Where and when each photo was taken; the images are left out
            photos: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    res.json(sales.map(saleJson));
  } catch (err) {
    next(err);
  }
});

// A photo of one set of a sale: /photo is the set's first, /photo/1 its second.
// The set is given by its position in the sale.
router.get('/:id/sets/:set/photo/:index?', async (req, res, next) => {
  try {
    const set = parseIndex(req.params.set);
    const position = parseIndex(req.params.index);
    const photo =
      set === null || position === null
        ? null
        : await prisma.photo.findFirst({
            where: { saleSet: { saleId: req.params.id, position: set }, position },
            omit: { data: false },
          });
    if (!photo) return res.status(404).json({ message: 'Not found' });
    res.type(photo.contentType).send(Buffer.from(photo.data));
  } catch (err) {
    next(err);
  }
});

// The picture of the payment, when one was added
router.get('/:id/payment/photo', async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      select: { paymentProof: true, paymentProofType: true },
    });
    if (!sale?.paymentProof) return res.status(404).json({ message: 'Not found' });
    res.type(sale.paymentProofType).send(Buffer.from(sale.paymentProof));
  } catch (err) {
    next(err);
  }
});

// Sells live birds out of one or more coops, weighed out in sets. The birds
// leave their coops. Responds with { id, batches } carrying the updated batches.
router.post('/', async (req, res, next) => {
  try {
    const { customer } = req.body;
    const name = String(customer?.name ?? '').trim();
    if (!name) throw badRequest('Customer name is required');
    const phone = parsePhone(customer?.phone);
    const date = parseDate(req.body.date, 'Sale date is required');

    if (!Array.isArray(req.body.sets) || req.body.sets.length === 0) {
      throw badRequest('Record at least one set of birds');
    }

    // Several sets can come out of the same batch, and out of the same coop
    const batches = new Map();
    // Birds taken out of each coop, by the coop's id
    const taken = new Map();
    const sets = [];
    for (const raw of req.body.sets) {
      const batchId = String(raw.batchId ?? '');
      if (!batches.has(batchId)) {
        const found = await findBatch(batchId);
        if (!found) throw badRequest('Select the batch of every set');
        batches.set(batchId, found);
      }
      const batch = batches.get(batchId);
      const coop = batch.coops.find((other) => other.id === raw.coopId);
      if (!coop) throw badRequest('Select the coop of every set');
      // The gender is optional: a sale need not be split into male and female
      if (raw.gender && !GENDERS.includes(raw.gender)) {
        throw badRequest('Select male or female for the set');
      }

      const birds = Number(raw.birds);
      if (!Number.isInteger(birds) || birds < 1) {
        throw badRequest('Number of birds must be a whole number of at least 1');
      }
      const soFar = taken.get(coop.id) ?? 0;
      if (soFar + birds > coopLive(coop)) {
        throw badRequest(`Only ${coopLive(coop)} live birds are in ${coop.name}`);
      }
      taken.set(coop.id, soFar + birds);

      const boxWeightEmpty = parseAmount(raw.boxWeightEmpty, 'Empty box weight');
      const boxWeightGross = parseAmount(raw.boxWeightGross, 'Loaded weight');
      if (boxWeightGross < boxWeightEmpty) {
        throw badRequest('Loaded weight cannot be less than the empty box weight');
      }

      const photos = raw.photos ?? [];
      if (!Array.isArray(photos) || photos.length > MAX_SET_PHOTOS) {
        throw badRequest(`A set can have up to ${MAX_SET_PHOTOS} photos`);
      }

      sets.push({
        position: sets.length,
        batchId: batch.id,
        coopId: coop.id,
        coopName: coop.name,
        // A coop without its own farm is on the batch's farm
        farm: coop.farm || batch.shiftToFarm || '',
        ...(raw.gender && { gender: raw.gender }),
        birds,
        boxes: parseCount(raw.boxes, 'Boxes'),
        boxWeightEmpty,
        boxWeightGross,
        weightKg: round(boxWeightGross - boxWeightEmpty, 3),
        photos: photoRows(photos.map((photo) => parsePhoto(photo, req.user))),
      });
    }
    if (sets.reduce((sum, set) => sum + set.photos.length, 0) > MAX_SALE_PHOTOS) {
      throw badRequest(`A sale can have up to ${MAX_SALE_PHOTOS} photos`);
    }

    const boxMode = req.body.boxMode || 'own';
    if (!BOX_MODES.includes(boxMode)) throw badRequest('Select whose boxes were used');
    const boxQty = boxMode === 'own' ? 0 : parseCount(req.body.boxQty, 'Number of boxes');
    const boxRate = boxMode === 'buy' ? parseAmount(req.body.boxRate, 'Rate per box') : 0;
    const boxReturned =
      boxMode === 'borrow' ? parseCount(req.body.boxReturned, 'Boxes returned') : 0;
    if (boxReturned > boxQty) throw badRequest('Boxes returned cannot be more than boxes given');

    const ratePerKg = parseAmount(req.body.ratePerKg, 'Rate per kg');
    const maleRate = parseAmount(req.body.maleRate, 'Male rate');
    const femaleRate = parseAmount(req.body.femaleRate, 'Female rate');

    // Each gender is billed on its own weight at its own rate per kg, and the
    // sets without a gender (`undefined`) at the plain rate
    const total = (gender, field) =>
      sets.filter((set) => set.gender === gender).reduce((sum, set) => sum + set[field], 0);
    const plainWeightKg = round(total(undefined, 'weightKg'), 3);
    const birdBill = round(plainWeightKg * ratePerKg, 2);
    const maleBirds = total('male', 'birds');
    const femaleBirds = total('female', 'birds');
    const maleWeightKg = round(total('male', 'weightKg'), 3);
    const femaleWeightKg = round(total('female', 'weightKg'), 3);
    const maleBill = round(maleWeightKg * maleRate, 2);
    const femaleBill = round(femaleWeightKg * femaleRate, 2);
    const boxBill = round(boxQty * boxRate, 2);

    const amount = round(birdBill + maleBill + femaleBill + boxBill, 2);

    // The sale and the coops' sold counts are saved together or not at all
    const [sale] = await prisma.$transaction([
      prisma.sale.create({
        data: {
          date,
          customerName: name,
          customerPhone: phone,
          customerAddress: text(customer?.address),
          sets: {
            create: sets.map(({ photos, ...set }) => ({ ...set, photos: { create: photos } })),
          },
          ratePerKg,
          maleRate,
          femaleRate,
          boxMode,
          boxQty,
          boxRate,
          boxReturned,
          present: (Array.isArray(req.body.present) ? req.body.present : [])
            .map((person) => ({
              name: String(person?.name ?? '').trim(),
              phone: String(person?.phone ?? '').replace(/\D/g, ''),
            }))
            .filter((person) => person.name),
          notes: text(req.body.notes),
          ...parsePayment(req.body.payment, amount),
          birds: total(undefined, 'birds') + maleBirds + femaleBirds,
          maleBirds,
          femaleBirds,
          weightKg: round(plainWeightKg + maleWeightKg + femaleWeightKg, 3),
          maleWeightKg,
          femaleWeightKg,
          birdBill,
          maleBill,
          femaleBill,
          boxBill,
          amount,
          ...createdBy(actor(req)),
        },
      }),
      ...[...taken].map(([id, birds]) =>
        prisma.coop.update({ where: { id }, data: { sold: { increment: birds } } })
      ),
    ]);

    const updated = await Promise.all([...batches.values()].map((batch) => findBatch(batch.id)));
    res.status(201).json({ id: sale.id, batches: updated.map(batchJson) });
  } catch (err) {
    next(err);
  }
});

export default router;
