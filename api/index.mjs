// Vercel serverless entry — wraps the Express app.
// All /api/* requests are rewritten here (see vercel.json). The rewrite carries
// the original path in __original because newer Vercel routing hands the
// function the rewritten destination path instead of the requested one.
import app from '../server/src/app.js';

export default function handler(req, res) {
  const [, qs = ''] = (req.url || '').split('?');
  const params = new URLSearchParams(qs);
  const original = params.get('__original');
  if (original) {
    params.delete('__original');
    const rest = params.toString();
    req.url = original + (rest ? `?${rest}` : '');
  }
  return app(req, res);
}
