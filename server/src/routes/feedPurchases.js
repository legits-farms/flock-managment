import { Router } from 'express';
import { actor } from '../auth.js';
import { badRequest } from '../evidence.js';
import FeedPurchase from '../models/FeedPurchase.js';

const router = Router();

// Every purchase, newest first
router.get('/', async (req, res, next) => {
  try {
    res.json(await FeedPurchase.find().sort({ date: -1, createdAt: -1 }).limit(1000));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, feedType, feedCompany, remarks } = req.body;
    const quantityKg = Number(req.body.quantityKg);
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
      throw badRequest('Feed quantity must be more than 0');
    }
    const ratePerKg = Number(req.body.ratePerKg);
    if (req.body.ratePerKg === '' || !Number.isFinite(ratePerKg) || ratePerKg < 0) {
      throw badRequest('Enter the price per kg');
    }

    const purchase = await FeedPurchase.create({
      date,
      feedType,
      feedCompany,
      quantityKg,
      ratePerKg,
      amount: Number((quantityKg * ratePerKg).toFixed(2)),
      remarks,
      createdBy: actor(req),
    });
    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
});

export default router;
