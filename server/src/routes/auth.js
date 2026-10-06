import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, signToken } from '../auth.js';
import { badRequest } from '../evidence.js';

const router = Router();

const session = (user) => ({
  token: signToken(user),
  user: { id: user._id, name: user.name, phone: user.phone },
});

function parsePhone(value) {
  const phone = String(value ?? '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) throw badRequest('Enter a valid phone number');
  return phone;
}

router.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!name) throw badRequest('Name is required');
    const phone = parsePhone(req.body.phone);
    if (password.length < 6) throw badRequest('Password must be at least 6 characters');

    if (await User.exists({ phone })) {
      throw badRequest('An account with this phone number already exists');
    }

    const user = await User.create({ name, phone, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json(session(user));
  } catch (err) {
    // Two sign-ups racing for the same phone number
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'An account with this phone number already exists' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const phone = String(req.body.phone ?? '').replace(/\D/g, '');
    const password = String(req.body.password ?? '');

    const user = await User.findOne({ phone }).select('+passwordHash');
    const matches = user && (await bcrypt.compare(password, user.passwordHash));
    if (!matches) throw badRequest('Wrong phone number or password');

    res.json(session(user));
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Please log in again' });
    res.json({ id: user._id, name: user.name, phone: user.phone });
  } catch (err) {
    next(err);
  }
});

export default router;
