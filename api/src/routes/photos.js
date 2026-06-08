const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

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

// GET /api/photos - Paginated public feed
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  const offset = (page - 1) * limit;

  try {
    // 1. Get total count
    const [countRows] = await db.pool.query('SELECT COUNT(*) as total FROM photos WHERE is_public = TRUE');
    const total = countRows[0].total;

    // 2. Get photos with tags and gallery details
    const queryStr = `
      SELECT p.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN photo_tags pt ON pt.tag_id = t.id
                WHERE pt.photo_id = p.id),
               JSON_ARRAY()
             ) AS tags,
             ag.camera, ag.film_stock, ag.month AS analog_month, ag.year AS analog_year,
             dg.year_month AS digital_year_month
      FROM photos p
      LEFT JOIN analog_galleries ag ON p.analog_gallery_id = ag.id
      LEFT JOIN digital_galleries dg ON p.digital_gallery_id = dg.id
      WHERE p.is_public = TRUE
      ORDER BY p.sort_order ASC, p.published_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [photos] = await db.pool.query(queryStr, [limit, offset]);

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

// GET /api/photos/:id - Photo detail (with EXIF, tags, and gallery info)
router.get('/:id', optionalAuth, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

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
             ag.title AS analog_gallery_title, ag.camera, ag.film_stock, ag.month AS analog_month, ag.year AS analog_year,
             dg.display_name AS digital_gallery_name, dg.year_month AS digital_year_month,
             u.name AS uploader_name, u.avatar_url AS uploader_avatar
      FROM photos p
      LEFT JOIN analog_galleries ag ON p.analog_gallery_id = ag.id
      LEFT JOIN digital_galleries dg ON p.digital_gallery_id = dg.id
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.id = ?
    `;
    const [rows] = await db.pool.query(queryStr, [photoId]);

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

module.exports = router;
