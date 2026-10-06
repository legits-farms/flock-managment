import { Router } from 'express';
import { actor } from '../auth.js';
import { addOption, listOptions } from '../options.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listOptions());
  } catch (err) {
    next(err);
  }
});

// Both respond with the full, updated { farms, coops } lists
for (const kind of ['farm', 'coop']) {
  router.post(`/${kind}s`, async (req, res, next) => {
    try {
      res.status(201).json(await addOption(kind, req.body.name, actor(req)));
    } catch (err) {
      next(err);
    }
  });
}

export default router;
