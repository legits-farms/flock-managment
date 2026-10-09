import { Router } from 'express';
import { actor } from '../auth.js';
import prisma from '../db.js';
import { badRequest } from '../evidence.js';
import { createdBy, recordJson } from '../serialize.js';
import { parseDate, requiredText, text } from '../validate.js';

const router = Router();

// Every purchase, newest first
router.get('/', async (req, res, next) => {
  try {
    const purchases = await prisma.feedPurchase.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    res.json(purchases.map(recordJson));
  } catch (err) {
    next(err);
  }
});

const round = (value) => Number(value.toFixed(2));

// What was paid on top of the feed itself, sent as `charges`: [{ label, amount }]
function parseCharges(raw = []) {
  if (!Array.isArray(raw) || raw.length > 10) throw badRequest('Too many extra charges');
  return raw.map((charge) => {
    const label = requiredText(charge?.label, 'Say what each extra charge is for');
    if (label.length > 40) throw badRequest('The name of an extra charge is too long');
    const amount = Number(charge.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest(`Enter the amount of ${label}`);
    }
    return { label, amount };
  });
}

// One purchase can cover several feed types: `items` holds each one's type, quantity
// and price, and each is stored as a purchase of its own. Extra charges on the
// purchase are split over them by weight. Resolves to the purchases made.
router.post('/', async (req, res, next) => {
  try {
    // An app opened before feed types could be combined sends a single one, without `items`
    const combined = Array.isArray(req.body.items);
    const items = combined ? req.body.items : [req.body];
    if (items.length === 0) throw badRequest('Add at least one feed type');
    if (items.length > 50) throw badRequest('Too many feed types in one purchase');

    const shared = {
      date: parseDate(req.body.date, 'Date is required'),
      feedCompany: text(req.body.feedCompany),
      remarks: text(req.body.remarks),
      ...createdBy(actor(req)),
    };
    const purchases = items.map((item) => {
      const quantityKg = Number(item?.quantityKg);
      if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
        throw badRequest('Feed quantity must be more than 0');
      }
      const ratePerKg = Number(item.ratePerKg);
      if (item.ratePerKg === '' || !Number.isFinite(ratePerKg) || ratePerKg < 0) {
        throw badRequest('Enter the price per kg');
      }
      return {
        ...shared,
        feedType: requiredText(item.feedType, 'Feed type is required'),
        quantityKg,
        ratePerKg,
        amount: round(quantityKg * ratePerKg),
      };
    });

    const charges = parseCharges(req.body.charges);
    const extra = round(charges.reduce((sum, charge) => sum + charge.amount, 0));
    if (extra > 0) {
      const totalKg = purchases.reduce((sum, purchase) => sum + purchase.quantityKg, 0);
      const extraChargeLabel = charges.map((charge) => charge.label).join(', ');
      let left = extra;
      purchases.forEach((purchase, i) => {
        // The last one takes what is left, so the shares add up to the paisa
        const share =
          i === purchases.length - 1 ? round(left) : round((extra * purchase.quantityKg) / totalKg);
        left -= share;
        Object.assign(purchase, {
          extraCharges: share,
          extraChargeLabel,
          amount: round(purchase.amount + share),
        });
      });
    }

    // Every feed type is checked above before any is saved, so a mistake in one saves none
    const saved = await prisma.feedPurchase.createManyAndReturn({ data: purchases });
    res.status(201).json(combined ? saved.map(recordJson) : recordJson(saved[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
