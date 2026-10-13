import { Router } from 'express';
import { actor } from '../auth.js';
import { addCoop, addFarm, addFeedType, addVaccine, listOptions } from '../options.js';
import { checkFarm, managedFarm, optionsFor } from '../scope.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(optionsFor(req.user, await listOptions()));
  } catch (err) {
    next(err);
  }
});

// All of these respond with the full, updated lists (for a manager, those of their farm)

router.post('/farms', async (req, res, next) => {
  try {
    if (managedFarm(req.user)) {
      return res.status(403).json({ message: 'Only staff or an admin can add a farm' });
    }
    res.status(201).json(await addFarm(req.body.name, actor(req)));
  } catch (err) {
    next(err);
  }
});

// A coop is added to one farm: { farm, name }
router.post('/coops', async (req, res, next) => {
  try {
    checkFarm(req.user, req.body.farm);
    res
      .status(201)
      .json(optionsFor(req.user, await addCoop(req.body.farm, req.body.name, actor(req))));
  } catch (err) {
    next(err);
  }
});

// A vaccine is added with the age it is given at: { name, schedule }
router.post('/vaccines', async (req, res, next) => {
  try {
    res
      .status(201)
      .json(optionsFor(req.user, await addVaccine(req.body.name, req.body.schedule, actor(req))));
  } catch (err) {
    next(err);
  }
});

router.post('/feed-types', async (req, res, next) => {
  try {
    res.status(201).json(optionsFor(req.user, await addFeedType(req.body.name, actor(req))));
  } catch (err) {
    next(err);
  }
});

export default router;
