import { Router } from 'express';
import { ROLES } from '../auth.js';
import prisma from '../db.js';
import { badRequest } from '../evidence.js';

const router = Router();

// Who has an account and what they may do is the admin's business alone
router.use((req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Only an admin can see the users' });
  next();
});

const userJson = (user) => ({
  _id: user.id,
  name: user.name,
  phone: user.phone,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

// Everyone who can log in, the newest first. Accounts still waiting for approval,
// or rejected, are left out: they have no role to speak of yet.
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map(userJson));
  } catch (err) {
    next(err);
  }
});

// Changes what someone may do, between the roles an account can be approved as.
// An admin is made by hand and is not changed from here, the admin's own account included.
router.post('/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!Object.hasOwn(ROLES, role ?? '')) throw badRequest('Choose what they can do');
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'Not found' });
    if (user.role === 'admin') throw badRequest('An admin cannot be changed here');

    res.json(userJson(await prisma.user.update({ where: { id: user.id }, data: { role } })));
  } catch (err) {
    next(err);
  }
});

export default router;
