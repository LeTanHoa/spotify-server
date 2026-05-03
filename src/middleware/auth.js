import jwt from 'jsonwebtoken';

/**
 * Verifies JWT from Authorization: Bearer <token> or ?token= for HTML5 audio elements.
 */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  let token =
    header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query.token) {
    token = String(req.query.token);
  }
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET missing');
    }
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
