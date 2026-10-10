import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { parseId } from './validate.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

// Rejects the request unless it carries a valid "Authorization: Bearer <token>"
// of an approved account. The account is looked up every time, so access ends
// as soon as it is no longer approved, not when the token runs out.
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  let payload;
  try {
    if (scheme !== 'Bearer' || !token) throw new Error('No token');
    payload = jwt.verify(token, process.env.JWT_SECRET);
    // Approval links are signed with the same secret but are not logins
    if (payload.purpose || !parseId(payload.sub)) throw new Error('Not a login token');
  } catch {
    return res.status(401).json({ message: 'Please log in again' });
  }

  try {
    const approved = await prisma.user.findFirst({
      where: { id: payload.sub, status: 'approved' },
      select: { role: true },
    });
    if (!approved) return res.status(401).json({ message: 'Please log in again' });
    req.user = {
      id: payload.sub,
      name: payload.name,
      role: approved.role,
      isAdmin: approved.role === 'admin',
    };
    next();
  } catch (err) {
    next(err);
  }
}

// What an account can be. A security guard only registers and looks at mortality;
// only these can be given when an account is approved (an admin is made by hand).
export const ROLES = { user: 'Staff — everything', security: 'Security — mortality only' };

const MORTALITY_ONLY = 'Your account can only register and see mortality.';

// Keeps a security guard out of everything this is put in front of
export function staffOnly(req, res, next) {
  if (req.user.role === 'security') return res.status(403).json({ message: MORTALITY_ONLY });
  next();
}

// A security guard may read what there is to register mortality against, and change nothing
export function staffOrReadOnly(req, res, next) {
  if (req.user.role === 'security' && req.method !== 'GET') {
    return res.status(403).json({ message: MORTALITY_ONLY });
  }
  next();
}

// The logged-in person: { user, name }
export const actor = (req) => ({ user: req.user.id, name: req.user.name });
