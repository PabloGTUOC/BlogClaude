const express = require('express');
const router = express.Router();
const db = require('../../db');
const { verifyJWT, requireAdmin } = require('../../middleware/auth');

// Apply admin guard to all routes in this file
router.use(verifyJWT, requireAdmin);

// GET /api/admin/users - List users by status (pending | approved | revoked)
router.get('/', async (req, res) => {
  const { status } = req.query;

  if (!status || !['pending', 'approved', 'revoked'].includes(status)) {
    return res.status(400).json({ error: 'Valid status parameter is required (pending|approved|revoked)', code: 'INVALID_INPUT' });
  }

  try {
    const queryStr = `
      SELECT id, firebase_uid, email, name, avatar_url, role, status, created_at AS registered_at, approved_at, approved_by
      FROM users
      WHERE status = ?
      ORDER BY created_at DESC
    `;
    const users = await db.query(queryStr, [status]);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/users/:id/approve - Approve user (status='approved', approved_by=adminId, approved_at=now)
router.put('/:id/approve', async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      'UPDATE users SET status = "approved", approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.user.id, targetUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Failed to approve user', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/users/:id/revoke - Revoke user (status='revoked')
router.put('/:id/revoke', async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);

  try {
    // Check if the user is attempting to revoke themselves
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot revoke your own administrative status', code: 'SELF_REVOCATION' });
    }

    const result = await db.query(
      'UPDATE users SET status = "revoked" WHERE id = ?',
      [targetUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    res.json({ message: 'User access revoked successfully' });
  } catch (error) {
    console.error('Error revoking user:', error);
    res.status(500).json({ error: 'Failed to revoke user', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/users/:id/restore - Restore user (status='approved')
router.put('/:id/restore', async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      'UPDATE users SET status = "approved" WHERE id = ?',
      [targetUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    res.json({ message: 'User access restored successfully' });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
