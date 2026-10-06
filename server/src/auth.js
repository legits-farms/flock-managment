import jwt from 'jsonwebtoken';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

// Rejects the request unless it carries a valid "Authorization: Bearer <token>"
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  try {
    if (scheme !== 'Bearer' || !token) throw new Error('No token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name };
    next();
  } catch {
    res.status(401).json({ message: 'Please log in again' });
  }
}

// The logged-in person, in the shape of the `byUser` schema fields
export const actor = (req) => ({ user: req.user.id, name: req.user.name });
