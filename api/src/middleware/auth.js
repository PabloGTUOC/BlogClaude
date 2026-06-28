const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'enderthoughts_secret_key_1984';

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required', code: 'AUTH_REQUIRED' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
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
  requireApproved,
  requireFamily,
  requireAdmin,
  JWT_SECRET
};
