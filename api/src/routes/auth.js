const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyIdToken } = require('../services/firebase');
const { sendAdminNotification } = require('../services/mailer');
const db = require('../db');
const { JWT_SECRET, MEDIA_COOKIE } = require('../middleware/auth');

// Cookie scoped to /uploads only: it exists solely so <img>/<video> tags can
// authenticate against the gated media route (they can't send Bearer headers).
const MEDIA_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/uploads'
};

router.post('/firebase', async (req, res) => {
  const { firebaseToken } = req.body;
  if (!firebaseToken) {
    return res.status(400).json({ error: 'firebaseToken is required', code: 'MISSING_TOKEN' });
  }

  try {
    // 1. Verify token via Firebase Admin SDK
    const decodedToken = await verifyIdToken(firebaseToken);
    const { uid, email, name, picture } = decodedToken;

    if (!email) {
      return res.status(400).json({ error: 'Firebase authentication failed to provide email', code: 'MISSING_EMAIL' });
    }

    // 2. Query user from database
    let users = await db.query('SELECT * FROM users WHERE firebase_uid = ?', [uid]);
    let user;

    if (users.length === 0) {
      // First-time user creation
      const nameVal = name || email.split('@')[0];
      const avatarUrlVal = picture || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(nameVal)}`;

      const insertResult = await db.query(
        'INSERT INTO users (firebase_uid, email, name, avatar_url, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, email, nameVal, avatarUrlVal, 'user', 'pending']
      );

      const newUserId = insertResult.insertId;

      // Retrieve new user record
      const newUsers = await db.query('SELECT * FROM users WHERE id = ?', [newUserId]);
      user = newUsers[0];

      // Async nodemailer dispatch to admin
      sendAdminNotification(user).catch(err => console.error('Mailer error:', err));
    } else {
      user = users[0];
    }

    // 3. Check user state
    if (user.status === 'revoked') {
      return res.status(401).json({ error: 'Access revoked by administrator.', code: 'ACCESS_REVOKED' });
    }

    // 4. Generate custom session JWT
    const payload = {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      role: user.role,
      group: user.group || null,
      status: user.status
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie(MEDIA_COOKIE, token, { ...MEDIA_COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Firebase Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed: ' + error.message, code: 'AUTH_FAILED' });
  }
});

// POST /api/auth/logout - Clear the media cookie (the Bearer token lives in the
// frontend's localStorage; dropping it is the client's job).
router.post('/logout', (req, res) => {
  res.clearCookie(MEDIA_COOKIE, MEDIA_COOKIE_OPTS);
  res.json({ message: 'Logged out' });
});

module.exports = router;
