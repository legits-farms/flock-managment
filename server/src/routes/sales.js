import { Router } from 'express';
import mongoose from 'mongoose';
import { actor } from '../auth.js';
import { badRequest, parsePhoto } from '../evidence.js';
import Batch, { coopLive } from '../models/Batch.js';
import Sale, {
  BOX_MODES,
  GENDERS,
  MAX_SALE_PHOTOS,
  MAX_SET_PHOTOS,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
} from '../models/Sale.js';

const router = Router();

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
// { status, amountPaid, mode, reference, proof } with the proof a picture as a data URL
function parsePayment(raw = {}, amount) {
  const status = raw.status || 'unpaid';
  if (!PAYMENT_STATUSES.includes(status)) throw badRequest('Select paid, partly paid or unpaid');
  if (status === 'unpaid') return { status, amountPaid: 0 };

  let amountPaid = amount;
  if (status === 'partial') {
    amountPaid = Number(raw.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) throw badRequest('Enter the amount paid');
    if (amountPaid >= amount) {
      throw badRequest('The amount paid must be less than the total bill');
    }
  }
  if (!PAYMENT_MODES.includes(raw.mode)) throw badRequest('Select how it was paid');

  const payment = {
    status,
    amountPaid,
    mode: raw.mode,
    reference: String(raw.reference ?? '').trim().slice(0, 100),
  };
  if (!raw.proof) return payment;

  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+=*)$/.exec(
    typeof raw.proof === 'string' ? raw.proof : ''
  );
  if (!match) throw badRequest('The payment photo must be a picture');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_PROOF_BYTES) throw badRequest('Photo is too large');
  return { ...payment, proof: { data, contentType: match[1] }, hasProof: true };
}

// "+91 98765-43210" -> "9876543210"
function parsePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) throw badRequest('Enter a valid 10-digit mobile number');
  return digits;
}

router.get('/', async (req, res, next) => {
  try {
    // ?batch=<id> lists the sales out of one batch and ?all=true the whole history
    const { batch, all } = req.query;
    if (batch !== undefined && !mongoose.isValidObjectId(batch)) return res.json([]);
    const sales = await Sale.find(batch ? { 'sets.batch': batch } : {})
      .sort({ createdAt: -1 })
      .limit(batch || all === 'true' ? 1000 : 20)
      .populate('sets.batch', 'batchName breed');
    res.json(sales);
  } catch (err) {
    next(err);
  }
});

// A photo of one set of a sale: /photo is the set's first, /photo/1 its second.
// The set is given by its position in the sale.
router.get('/:id/sets/:set/photo/:index?', async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).select(
      '+sets.photos.data +sets.photos.contentType'
    );
    const photo = sale?.sets[Number(req.params.set)]?.photos[Number(req.params.index ?? 0)];
    if (!photo?.data) return res.status(404).json({ message: 'Not found' });
    res.type(photo.contentType).send(photo.data);
  } catch (err) {
    next(err);
  }
});

// The picture of the payment, when one was added
router.get('/:id/payment/photo', async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).select(
      '+payment.proof.data +payment.proof.contentType'
    );
    const proof = sale?.payment?.proof;
    if (!proof?.data) return res.status(404).json({ message: 'Not found' });
    res.type(proof.contentType).send(proof.data);
  } catch (err) {
    next(err);
  }
});

// Sells live birds out of one or more coops, weighed out in sets. The birds
// leave their coops. Responds with { id, batches } carrying the updated batches.
router.post('/', async (req, res, next) => {
  try {
    const { customer, date, notes } = req.body;
    const name = String(customer?.name ?? '').trim();
    if (!name) throw badRequest('Customer name is required');
    const phone = parsePhone(customer?.phone);

    if (!Array.isArray(req.body.sets) || req.body.sets.length === 0) {
      throw badRequest('Record at least one set of birds');
    }

    // Several sets can come out of the same batch, and out of the same coop
    const batches = new Map();
    const taken = new Map();
    const sets = [];
    for (const raw of req.body.sets) {
      const batchId = String(raw.batchId ?? '');
      if (!batches.has(batchId)) {
        const found = mongoose.isValidObjectId(batchId) ? await Batch.findById(batchId) : null;
        if (!found) throw badRequest('Select the batch of every set');
        batches.set(batchId, found);
      }
      const batch = batches.get(batchId);
      const coop = mongoose.isValidObjectId(raw.coopId) ? batch.coops.id(raw.coopId) : null;
      if (!coop) throw badRequest('Select the coop of every set');
      // The gender is optional: a sale need not be split into male and female
      if (raw.gender && !GENDERS.includes(raw.gender)) {
        throw badRequest('Select male or female for the set');
      }

      const birds = Number(raw.birds);
      if (!Number.isInteger(birds) || birds < 1) {
        throw badRequest('Number of birds must be a whole number of at least 1');
      }
      const soFar = taken.get(String(coop._id)) ?? 0;
      if (soFar + birds > coopLive(coop)) {
        throw badRequest(`Only ${coopLive(coop)} live birds are in ${coop.name}`);
      }
      taken.set(String(coop._id), soFar + birds);

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
        batch: batch._id,
        coopId: coop._id,
        coopName: coop.name,
        // A coop without its own farm is on the batch's farm
        farm: coop.farm || batch.shiftToFarm || '',
        ...(raw.gender && { gender: raw.gender }),
        birds,
        boxes: parseCount(raw.boxes, 'Boxes'),
        boxWeightEmpty,
        boxWeightGross,
        weightKg: round(boxWeightGross - boxWeightEmpty, 3),
        photos: photos.map((photo) => ({ ...parsePhoto(photo), contentType: 'image/jpeg' })),
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

    const sale = new Sale({
      date,
      customer: { name, phone, address: customer?.address },
      sets,
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
      notes,
      payment: parsePayment(req.body.payment, amount),
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
      createdBy: actor(req),
    });
    await sale.validate();

    for (const set of sets) {
      batches.get(String(set.batch)).coops.id(set.coopId).sold += set.birds;
    }
    for (const batch of batches.values()) await batch.save();
    await sale.save();
    res.status(201).json({ id: sale._id, batches: [...batches.values()] });
  } catch (err) {
    next(err);
  }
});

export default router;
