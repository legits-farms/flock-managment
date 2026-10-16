import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { badRequest } from './evidence.js';
import { listedFarm } from './options.js';
import { parseId } from './validate.js';

// The one account that approves mortality, by its phone number. What anyone else
// registers waits for it, and takes no birds off the coop until it is approved.
const MORTALITY_APPROVER = process.env.MORTALITY_APPROVER_PHONE || '8105369922';
export const canApproveMortality = (user) => user?.phone === MORTALITY_APPROVER;

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
      select: { role: true, farm: true, phone: true },
    });
    if (!approved) return res.status(401).json({ message: 'Please log in again' });
    // A manager is of one farm; without it there is nothing they may see
    if (approved.role === 'manager' && !approved.farm) {
      return res.status(403).json({ message: 'Your account has no farm yet. Ask the admin.' });
    }
    req.user = {
      id: payload.sub,
      name: payload.name,
      role: approved.role,
      farm: approved.role === 'manager' ? approved.farm : null,
      isAdmin: approved.role === 'admin',
      canApproveMortality: canApproveMortality(approved),
    };
    next();
  } catch (err) {
    next(err);
  }
}

// What an account can be. A security guard only registers and looks at mortality,
// and a manager sees and works on one farm alone; only these can be given when an
// account is approved (an admin is made by hand).
export const ROLES = {
  user: 'Staff — everything',
  security: 'Security — mortality only',
  manager: 'Farm manager — one farm only',
};

// A role as it is said of one account: a manager is named with their farm
export const roleLabel = ({ role, farm }) =>
  role === 'manager' && farm ? `${farm} manager — ${farm} only` : (ROLES[role] ?? role);

// The role chosen for an account, checked, as its columns: { role, farm }.
// A manager needs a farm from the list; nobody else has one.
export async function parseRole(role, rawFarm) {
  if (!Object.hasOwn(ROLES, role ?? '')) throw badRequest('Choose what they can do');
  if (role !== 'manager') return { role, farm: null };
  const farm = await listedFarm(rawFarm);
  if (!farm) throw badRequest('Choose the farm they manage');
  return { role, farm };
}

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
