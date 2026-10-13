import { Router, urlencoded } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { ROLES, requireAuth, signToken } from '../auth.js';
import {
  approvalConfigured,
  approvalToken,
  escapeHtml,
  page,
  readApprovalToken,
  requestApproval,
} from '../approval.js';
import { badRequest } from '../evidence.js';

const router = Router();

// What the app knows about the logged-in person. An admin gets the admin-only parts
// of the forms, and a security guard only the mortality ones.
const profile = (user) => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  role: user.role,
  isAdmin: user.role === 'admin',
});

const session = (user) => ({
  token: signToken(user),
  user: profile(user),
});

const WAITING = "Your account is waiting for the manager's approval.";
const REJECTED = 'This account was not approved. Please contact the manager.';

function parsePhone(value) {
  const phone = String(value ?? '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) throw badRequest('Enter a valid phone number');
  return phone;
}

// Creates the account as pending and asks the manager to approve it.
// Responds with { pending: true, message }: nobody is logged in yet.
router.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!name) throw badRequest('Name is required');
    if (name.length > 60) throw badRequest('Name is too long');
    const phone = parsePhone(req.body.phone);
    if (password.length < 6) throw badRequest('Password must be at least 6 characters');

    if (!approvalConfigured()) {
      console.error('Sign-up is off: set RESEND_API_KEY and MANAGER_EMAIL in server/.env');
      return res.status(503).json({ message: 'Sign-up is not set up yet. Contact the manager.' });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing?.status === 'pending') throw badRequest(WAITING);
    if (existing?.status === 'rejected') throw badRequest(REJECTED);
    if (existing) throw badRequest('An account with this phone number already exists');

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        status: 'pending',
      },
    });

    try {
      await requestApproval(user);
    } catch (err) {
      // Without the email the manager would never hear of this account
      console.error(`Could not email the approval request: ${err.message}`);
      await prisma.user.delete({ where: { id: user.id } });
      return res
        .status(503)
        .json({ message: 'Could not send your request to the manager. Please try again.' });
    }

    res.status(201).json({
      pending: true,
      message: 'Your request was sent to the manager. You can log in once they approve it.',
    });
  } catch (err) {
    // Two sign-ups racing for the same phone number
    if (err.code === 'P2002') {
      return res
        .status(400)
        .json({ message: 'An account with this phone number already exists' });
    }
    next(err);
  }
});

// The page the manager's email links to. Opening it changes nothing (mail
// scanners open links too); approving or rejecting takes a press of a button.
router.get('/approval', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: readApprovalToken(req.query.token) },
    });
    if (!user) throw badRequest('This account no longer exists.');

    if (user.status !== 'pending') {
      return res.send(
        page(
          'Already decided',
          `<h1>Already decided</h1><p><strong>${escapeHtml(user.name)}</strong> was already ${escapeHtml(user.status)}.</p>`
        )
      );
    }

    res.send(
      page(
        'Approve access?',
        `<h1>Approve access?</h1>
<p>This person signed up for the flock management app. Approve only if you know them.</p>
<dl><dt>Name</dt><dd>${escapeHtml(user.name)}</dd><dt>Phone</dt><dd>${escapeHtml(user.phone)}</dd></dl>
<form method="post" action="/api/auth/approval">
  <input type="hidden" name="token" value="${escapeHtml(approvalToken(user))}">
  <fieldset class="roles">
    <legend>What can they do?</legend>
    ${Object.entries(ROLES)
      .map(
        ([role, label], i) =>
          `<label><input type="radio" name="role" value="${role}"${i === 0 ? ' checked' : ''}> ${escapeHtml(label)}</label>`
      )
      .join('')}
  </fieldset>
  <button class="reject" name="decision" value="reject">Reject</button>
  <button class="approve" name="decision" value="approve">Approve</button>
</form>`
      )
    );
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).send(page('Link not valid', `<h1>Link not valid</h1><p>${escapeHtml(err.message)}</p>`));
    }
    next(err);
  }
});

router.post('/approval', urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const { decision } = req.body;
    if (decision !== 'approve' && decision !== 'reject') throw badRequest('Choose Approve or Reject.');
    const status = decision === 'approve' ? 'approved' : 'rejected';
    // What the person may do, chosen as they are approved
    const role = req.body.role ?? 'user';
    if (status === 'approved' && !Object.hasOwn(ROLES, role)) throw badRequest('Choose what they can do.');

    // Only a pending account can be decided, so an old link cannot undo a decision
    const id = readApprovalToken(req.body.token);
    const { count } = await prisma.user.updateMany({
      where: { id, status: 'pending' },
      data: status === 'approved' ? { status, role } : { status },
    });
    if (count === 0) throw badRequest('This request was already decided or no longer exists.');
    const user = await prisma.user.findUnique({ where: { id } });

    res.send(
      page(
        `Access ${status}`,
        `<h1>Access ${status}</h1><p><strong>${escapeHtml(user.name)}</strong> ${
          status === 'approved'
            ? `can now log in to the app as <strong>${escapeHtml(ROLES[role])}</strong>.`
            : 'cannot log in to the app.'
        }</p>`
      )
    );
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).send(page('Not done', `<h1>Not done</h1><p>${escapeHtml(err.message)}</p>`));
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const phone = String(req.body.phone ?? '').replace(/\D/g, '');
    const password = String(req.body.password ?? '');

    const user = await prisma.user.findUnique({
      where: { phone },
      omit: { passwordHash: false },
    });
    const matches = user && (await bcrypt.compare(password, user.passwordHash));
    if (!matches) throw badRequest('Wrong phone number or password');
    if (user.status === 'pending') return res.status(403).json({ message: WAITING });
    if (user.status !== 'approved') return res.status(403).json({ message: REJECTED });

    res.json(session(user));
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ message: 'Please log in again' });
    res.json(profile(user));
  } catch (err) {
    next(err);
  }
});

export default router;
