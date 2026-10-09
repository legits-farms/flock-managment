// New accounts wait for the manager's approval. Signing up emails the manager a
// link to a page where they approve or reject the person.
import jwt from 'jsonwebtoken';
import { badRequest } from './evidence.js';

const LINK_VALID_FOR = '7d';

// Where the app is opened from. Never taken from the request: a forged Host
// header would send the manager's approval link, and its token, to someone else.
const appUrl = () =>
  (
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:5173')
  ).replace(/\/+$/, '');

export const approvalConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MANAGER_EMAIL);

export const approvalToken = (user) =>
  jwt.sign({ sub: user.id, purpose: 'approval' }, process.env.JWT_SECRET, {
    expiresIn: LINK_VALID_FOR,
  });

// The user id an approval link was made for
export function readApprovalToken(token) {
  try {
    const payload = jwt.verify(String(token ?? ''), process.env.JWT_SECRET);
    if (payload.purpose !== 'approval') throw new Error('Wrong kind of token');
    return payload.sub;
  } catch {
    throw badRequest('This approval link is not valid or has expired.');
  }
}

export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );

// A small standalone page, shown to the manager outside the app
export const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 32px 16px; background: #fdf7ee; color: #414042;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; }
  main { max-width: 420px; margin: 0 auto; padding: 24px 20px; background: #fff;
    border: 1px solid #ecdcca; border-radius: 20px; }
  h1 { margin: 0 0 12px; font-size: 1.3rem; }
  p { margin: 0 0 12px; }
  dl { margin: 0 0 20px; padding: 12px 14px; background: #fdf7ee; border-radius: 14px; }
  dt { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #5f5c5e; }
  dd { margin: 0 0 8px; font-weight: 700; }
  dd:last-child { margin-bottom: 0; }
  form { display: flex; gap: 10px; }
  button { flex: 1; min-height: 48px; border-radius: 30px; font: inherit; font-weight: 700; cursor: pointer; }
  .approve { border: none; background: #ee6620; color: #fff; }
  .reject { border: 1px solid #b3261e; background: #fff; color: #b3261e; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;

// Emails the manager about a new sign-up. Rejects when the email cannot be sent.
export async function requestApproval(user) {
  const link = `${appUrl()}/api/auth/approval?token=${encodeURIComponent(approvalToken(user))}`;
  const name = escapeHtml(user.name);
  const phone = escapeHtml(user.phone);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Energy Eggs Flock Management <onboarding@resend.dev>',
      to: [process.env.MANAGER_EMAIL],
      subject: `Approve access for ${user.name}?`,
      html: `<p><strong>${name}</strong> (phone ${phone}) has signed up for the Energy Eggs flock management app and is waiting for your approval.</p>
<p>They cannot see or change anything until you approve them.</p>
<p><a href="${link}">Review this request</a></p>
<p>The link works for 7 days. If you do not know this person, open it and choose Reject.</p>`,
      text: `${user.name} (phone ${user.phone}) has signed up for the Energy Eggs flock management app and is waiting for your approval.\n\nReview this request: ${link}\n\nThe link works for 7 days. If you do not know this person, open it and choose Reject.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend answered ${res.status}: ${detail.slice(0, 300)}`);
  }
}
