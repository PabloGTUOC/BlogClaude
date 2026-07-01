const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, verifyJWT, requireApproved } = require('../middleware/auth');

// Optional auth parsing for details
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}

// Reusable SQL fragment: like/comment counts + whether the requesting user liked it.
// `?` is bound to the requesting user id (0 when anonymous → liked_by_me is always false).
const engagementSelect = `
  (SELECT COUNT(*) FROM photo_likes pl WHERE pl.photo_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM photo_comments pc WHERE pc.photo_id = p.id) AS comment_count,
  EXISTS(SELECT 1 FROM photo_likes pl WHERE pl.photo_id = p.id AND pl.user_id = ?) AS liked_by_me
`;

// GET /api/photos - Paginated public feed
router.get('/', optionalAuth, async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  const offset = (page - 1) * limit;
  const uid = req.user?.id || 0;

  try {
    // 1. Get total count
    const [countRows] = await db.pool.query('SELECT COUNT(*) as total FROM photos WHERE is_public = TRUE');
    const total = countRows[0].total;

    // 2. Get photos with tags, gallery details, and engagement counts
    const queryStr = `
      SELECT p.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN photo_tags pt ON pt.tag_id = t.id
                WHERE pt.photo_id = p.id),
               JSON_ARRAY()
             ) AS tags,
             ${engagementSelect},
             ag.camera, ag.film_stock, ag.month AS analog_month, ag.year AS analog_year,
             dg.year_month AS digital_year_month
      FROM photos p
      LEFT JOIN analog_galleries ag ON p.analog_gallery_id = ag.id
      LEFT JOIN digital_galleries dg ON p.digital_gallery_id = dg.id
      WHERE p.is_public = TRUE
      ORDER BY p.sort_order ASC, p.published_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [photos] = await db.pool.query(queryStr, [uid, limit, offset]);

    res.json({
      photos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching public photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos', code: 'DATABASE_ERROR' });
  }
});

// GET /api/photos/:id - Photo detail (with EXIF, tags, gallery info, engagement)
router.get('/:id', optionalAuth, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);
  const uid = req.user?.id || 0;

  try {
    const queryStr = `
      SELECT p.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN photo_tags pt ON pt.tag_id = t.id
                WHERE pt.photo_id = p.id),
               JSON_ARRAY()
             ) AS tags,
             ${engagementSelect},
             ag.title AS analog_gallery_title, ag.camera, ag.film_stock, ag.month AS analog_month, ag.year AS analog_year,
             dg.display_name AS digital_gallery_name, dg.year_month AS digital_year_month,
             u.name AS uploader_name, u.avatar_url AS uploader_avatar
      FROM photos p
      LEFT JOIN analog_galleries ag ON p.analog_gallery_id = ag.id
      LEFT JOIN digital_galleries dg ON p.digital_gallery_id = dg.id
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.id = ?
    `;
    const [rows] = await db.pool.query(queryStr, [uid, photoId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    const photo = rows[0];

    // Access control: if photo is not public, user must be logged in and approved
    if (!photo.is_public) {
      if (!req.user || (req.user.status !== 'approved' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied to private photo', code: 'FORBIDDEN' });
      }
    }

    res.json(photo);
  } catch (error) {
    console.error('Error fetching photo detail:', error);
    res.status(500).json({ error: 'Failed to fetch photo detail', code: 'DATABASE_ERROR' });
  }
});

// Confirms a photo exists before allowing interaction, and returns its visibility.
async function loadInteractablePhoto(photoId) {
  const rows = await db.query('SELECT id, is_public FROM photos WHERE id = ?', [photoId]);
  return rows[0] || null;
}

// POST /api/photos/:id/like - Toggle the requesting user's like
router.post('/:id/like', verifyJWT, requireApproved, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const photo = await loadInteractablePhoto(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    const existing = await db.query(
      'SELECT 1 FROM photo_likes WHERE photo_id = ? AND user_id = ?',
      [photoId, req.user.id]
    );

    let liked;
    if (existing.length > 0) {
      await db.query('DELETE FROM photo_likes WHERE photo_id = ? AND user_id = ?', [photoId, req.user.id]);
      liked = false;
    } else {
      await db.query('INSERT INTO photo_likes (photo_id, user_id) VALUES (?, ?)', [photoId, req.user.id]);
      liked = true;
    }

    const [countRow] = await db.query('SELECT COUNT(*) AS c FROM photo_likes WHERE photo_id = ?', [photoId]);
    res.json({ liked, like_count: countRow.c });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like', code: 'DATABASE_ERROR' });
  }
});

// GET /api/photos/:id/comments - List comments (readable by anyone who can see the photo)
router.get('/:id/comments', optionalAuth, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const photo = await loadInteractablePhoto(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    // Private photos: only approved users / admins may read the thread
    if (!photo.is_public && (!req.user || (req.user.status !== 'approved' && req.user.role !== 'admin'))) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }

    const comments = await db.query(
      `SELECT c.id, c.body, c.created_at, c.user_id,
              u.name AS author_name, u.avatar_url AS author_avatar
       FROM photo_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.photo_id = ?
       ORDER BY c.created_at ASC`,
      [photoId]
    );

    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments', code: 'DATABASE_ERROR' });
  }
});

// POST /api/photos/:id/comments - Add a comment
router.post('/:id/comments', verifyJWT, requireApproved, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);
  const body = (req.body.body || '').trim();

  if (!body) {
    return res.status(400).json({ error: 'Comment body is required', code: 'INVALID_INPUT' });
  }
  if (body.length > 2000) {
    return res.status(400).json({ error: 'Comment is too long (max 2000 chars)', code: 'INVALID_INPUT' });
  }

  try {
    const photo = await loadInteractablePhoto(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    const result = await db.query(
      'INSERT INTO photo_comments (photo_id, user_id, body) VALUES (?, ?, ?)',
      [photoId, req.user.id, body]
    );

    const rows = await db.query(
      `SELECT c.id, c.body, c.created_at, c.user_id,
              u.name AS author_name, u.avatar_url AS author_avatar
       FROM photo_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment', code: 'DATABASE_ERROR' });
  }
});

// DELETE /api/photos/:id/comments/:commentId - Delete own comment (or any, if admin)
router.delete('/:id/comments/:commentId', verifyJWT, requireApproved, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);

  try {
    const rows = await db.query('SELECT user_id FROM photo_comments WHERE id = ?', [commentId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this comment', code: 'FORBIDDEN' });
    }

    await db.query('DELETE FROM photo_comments WHERE id = ?', [commentId]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
