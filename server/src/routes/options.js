import { Router } from 'express';
import { actor } from '../auth.js';
import { addCoop, addFarm, listOptions } from '../options.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listOptions());
  } catch (err) {
    next(err);
  }
});

// Both respond with the full, updated { farms, coops } lists

router.post('/farms', async (req, res, next) => {
  try {
    res.status(201).json(await addFarm(req.body.name, actor(req)));
  } catch (err) {
    next(err);
  }
});

// A coop is added to one farm: { farm, name }
router.post('/coops', async (req, res, next) => {
  try {
    res.status(201).json(await addCoop(req.body.farm, req.body.name, actor(req)));
  } catch (err) {
    next(err);
  }
});

export default router;
