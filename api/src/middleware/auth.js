const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Refusing to start with no signing secret.');
  process.exit(1);
}

// HttpOnly cookie carrying the session JWT, scoped to /uploads. <img>/<video>
// tags can't send Authorization headers, so gated media auths via this cookie
// (frontend and API are same-site in both dev and production).
const MEDIA_COOKIE = 'enderthoughts_media';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies[MEDIA_COOKIE]) {
    return req.cookies[MEDIA_COOKIE];
  }
  return null;
}

// Role/status/group are re-read from the DB on every request so revocations and
// role changes take effect immediately instead of when the 7-day token expires.
async function loadFreshUser(decoded) {
  const rows = await db.query(
    'SELECT id, firebase_uid, email, role, `group`, status FROM users WHERE id = ?',
    [decoded.id]
  );
  return rows[0] || null;
}

async function verifyJWT(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Access token required', code: 'AUTH_REQUIRED' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }

  try {
    const user = await loadFreshUser(decoded);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists', code: 'INVALID_TOKEN' });
    }
    if (user.status === 'revoked') {
      return res.status(401).json({ error: 'Access revoked by administrator.', code: 'ACCESS_REVOKED' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth lookup failed:', err);
    return res.status(500).json({ error: 'Authentication lookup failed', code: 'DATABASE_ERROR' });
  }
}

// Attaches req.user when a valid token is present, but never rejects — for public routes
// whose response varies by viewer (liked_by_me, private photo detail, EXIF visibility).
async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await loadFreshUser(decoded);
      if (user && user.status !== 'revoked') {
        req.user = user;
      }
    } catch (err) {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}

function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  const { role, status } = req.user;
  const hasAccess = role === 'admin' || (status === 'approved' && ['family', 'friend', 'user'].includes(role));
  if (!hasAccess) {
    return res.status(403).json({ error: 'Account pending approval or access revoked', code: 'ACCESS_RESTRICTED' });
  }

  next();
}

// Requires family or admin — blocks friends
function requireFamily(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  const { role, status } = req.user;
  if (role !== 'admin' && !(status === 'approved' && role === 'family')) {
    return res.status(403).json({ error: 'Family access required', code: 'ACCESS_RESTRICTED' });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED' });
  }

  next();
}

module.exports = {
  verifyJWT,
  optionalAuth,
  requireApproved,
  requireFamily,
  requireAdmin,
  JWT_SECRET,
  MEDIA_COOKIE
};
