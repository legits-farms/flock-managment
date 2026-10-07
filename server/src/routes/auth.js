import { Router, urlencoded } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, signToken } from '../auth.js';
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

const session = (user) => ({
  token: signToken(user),
  user: { id: user._id, name: user.name, phone: user.phone },
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

    const existing = await User.findOne({ phone });
    if (existing?.status === 'pending') throw badRequest(WAITING);
    if (existing?.status === 'rejected') throw badRequest(REJECTED);
    if (existing) throw badRequest('An account with this phone number already exists');

    const user = await User.create({
      name,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'pending',
    });

    try {
      await requestApproval(user);
    } catch (err) {
      // Without the email the manager would never hear of this account
      console.error(`Could not email the approval request: ${err.message}`);
      await user.deleteOne();
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
    if (err.code === 11000) {
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
    const user = await User.findById(readApprovalToken(req.query.token));
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

    // Only a pending account can be decided, so an old link cannot undo a decision
    const user = await User.findOneAndUpdate(
      { _id: readApprovalToken(req.body.token), status: 'pending' },
      { status },
      { new: true }
    );
    if (!user) throw badRequest('This request was already decided or no longer exists.');

    res.send(
      page(
        `Access ${status}`,
        `<h1>Access ${status}</h1><p><strong>${escapeHtml(user.name)}</strong> ${
          status === 'approved' ? 'can now log in to the app.' : 'cannot log in to the app.'
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

    const user = await User.findOne({ phone }).select('+passwordHash');
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
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Please log in again' });
    res.json({ id: user._id, name: user.name, phone: user.phone });
  } catch (err) {
    next(err);
  }
});

export default router;
