const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { verifyJWT, requireApproved, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { processUpload } = require('../services/sharp');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Helper to delete physical files safely
function deletePhotoFiles(photo) {
  if (photo.filename) {
    const fullPath = path.join(uploadPath, photo.filename);
    fs.unlink(fullPath, err => {
      if (err && err.code !== 'ENOENT') console.error(`Failed to delete file ${fullPath}:`, err);
    });
  }
  if (photo.thumbnail) {
    const thumbPath = path.join(uploadPath, photo.thumbnail);
    fs.unlink(thumbPath, err => {
      if (err && err.code !== 'ENOENT') console.error(`Failed to delete thumbnail ${thumbPath}:`, err);
    });
  }
}

// -------------------------------------------------------------
// PUBLIC/APPROVED USER ROUTES (RequireApproved)
// -------------------------------------------------------------

// GET /api/analog/galleries - List analog galleries filtered by role
router.get('/galleries', verifyJWT, requireApproved, async (req, res) => {
  try {
    const { role, group: userGroup } = req.user;
    const isAdmin = role === 'admin';
    const isFriend = role === 'friend';

    let whereClause;
    let params = [];

    if (isAdmin) {
      // Admins see everything including unpublished
      whereClause = '';
    } else if (isFriend) {
      // Friends only see published galleries tagged with their OWN group (e.g. 'berlin').
      // The 'friends' tag alone does NOT grant access — the group tag is required.
      if (!userGroup) {
        // Friend with no group assigned sees nothing
        whereClause = 'WHERE 1 = 0';
        params = [];
      } else {
        whereClause = `
          WHERE ag.is_published = 1
            AND EXISTS (
              SELECT 1 FROM analog_gallery_tags agt
              JOIN tags t ON t.id = agt.tag_id
              WHERE agt.gallery_id = ag.id AND t.name = ?
            )
        `;
        params = [userGroup];
      }
    } else {
      // Family and legacy 'user' role: all published galleries
      whereClause = 'WHERE ag.is_published = 1';
    }

    const queryStr = `
      SELECT ag.*,
             (SELECT COUNT(*) FROM photos WHERE analog_gallery_id = ag.id) AS photo_count,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN analog_gallery_tags agt ON agt.tag_id = t.id
                WHERE agt.gallery_id = ag.id),
               JSON_ARRAY()
             ) AS tags,
             COALESCE(
               (SELECT p.thumbnail FROM photos p
                WHERE p.analog_gallery_id = ag.id AND p.in_gallery = 1
                ORDER BY p.sort_order ASC, p.created_at ASC LIMIT 1),
               (SELECT p.thumbnail FROM photos p
                WHERE p.analog_gallery_id = ag.id
                ORDER BY p.sort_order ASC, p.created_at ASC LIMIT 1)
             ) AS cover_thumbnail
      FROM analog_galleries ag
      ${whereClause}
      ORDER BY ag.year DESC, ag.month DESC, ag.created_at DESC
    `;
    const galleries = await db.query(queryStr, params);
    res.json(galleries);
  } catch (error) {
    console.error('Error fetching analog galleries:', error);
    res.status(500).json({ error: 'Failed to fetch galleries', code: 'DATABASE_ERROR' });
  }
});

// GET /api/analog/galleries/:id - Gallery detail + photos
router.get('/galleries/:id', verifyJWT, requireApproved, async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);

  try {
    const { role, group: userGroup } = req.user;
    const isAdmin = role === 'admin';
    const isFriend = role === 'friend';

    let accessClause = '';
    let accessParams = [galleryId];

    if (isFriend) {
      // Friends only see a gallery tagged with their OWN group (e.g. 'berlin').
      // The 'friends' tag alone does NOT grant access — the group tag is required.
      if (!userGroup) {
        // Friend with no group assigned sees nothing
        accessClause = 'AND 1 = 0';
        accessParams = [galleryId];
      } else {
        accessClause = `
          AND ag.is_published = 1
          AND EXISTS (
            SELECT 1 FROM analog_gallery_tags agt
            JOIN tags t ON t.id = agt.tag_id
            WHERE agt.gallery_id = ag.id AND t.name = ?
          )
        `;
        accessParams = [galleryId, userGroup];
      }
    } else if (!isAdmin) {
      accessClause = 'AND ag.is_published = 1';
    }

    const galleryQuery = `
      SELECT ag.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN analog_gallery_tags agt ON agt.tag_id = t.id
                WHERE agt.gallery_id = ag.id),
               JSON_ARRAY()
             ) AS tags
      FROM analog_galleries ag
      WHERE ag.id = ?
      ${accessClause}
    `;
    const galleryRows = await db.query(galleryQuery, accessParams);

    if (galleryRows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found', code: 'NOT_FOUND' });
    }

    const photosQuery = `
      SELECT p.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN photo_tags pt ON pt.tag_id = t.id
                WHERE pt.photo_id = p.id),
               JSON_ARRAY()
             ) AS tags
      FROM photos p
      WHERE p.analog_gallery_id = ?
      ${isAdmin ? '' : 'AND p.in_gallery = 1'}
      ORDER BY p.sort_order ASC, p.created_at DESC
    `;
    const photos = await db.query(photosQuery, [galleryId]);

    res.json({
      gallery: galleryRows[0],
      photos
    });
  } catch (error) {
    console.error('Error fetching gallery details:', error);
    res.status(500).json({ error: 'Failed to fetch gallery details', code: 'DATABASE_ERROR' });
  }
});

// -------------------------------------------------------------
// ADMIN WRITE ROUTES (RequireAdmin)
// -------------------------------------------------------------

// POST /api/analog/galleries - Create new gallery
router.post('/galleries', verifyJWT, requireAdmin, async (req, res) => {
  const { title, camera, film_stock, month, year, notes, tagIds } = req.body;

  if (!title || !camera || !film_stock || !month || !year) {
    return res.status(400).json({ error: 'Missing required metadata fields', code: 'INVALID_INPUT' });
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      'INSERT INTO analog_galleries (title, camera, film_stock, month, year, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, camera, film_stock, month, year, notes || null, req.user.id]
    );
    const galleryId = insertResult.insertId;

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const tagRows = tagIds.map(tagId => [galleryId, tagId]);
      await connection.query('INSERT INTO analog_gallery_tags (gallery_id, tag_id) VALUES ?', [tagRows]);
    }

    await connection.commit();
    res.status(201).json({ id: galleryId, title, camera, film_stock, month, year, notes });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating gallery:', error);
    res.status(500).json({ error: 'Failed to create gallery', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

// PUT /api/analog/galleries/:id - Update gallery metadata
router.put('/galleries/:id', verifyJWT, requireAdmin, async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);
  const { title, camera, film_stock, month, year, notes, tagIds } = req.body;

  if (!title || !camera || !film_stock || !month || !year) {
    return res.status(400).json({ error: 'Missing required metadata fields', code: 'INVALID_INPUT' });
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'UPDATE analog_galleries SET title = ?, camera = ?, film_stock = ?, month = ?, year = ?, notes = ? WHERE id = ?',
      [title, camera, film_stock, month, year, notes || null, galleryId]
    );

    // Update tags: remove old tags, insert new tags
    await connection.query('DELETE FROM analog_gallery_tags WHERE gallery_id = ?', [galleryId]);

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const tagRows = tagIds.map(tagId => [galleryId, tagId]);
      await connection.query('INSERT INTO analog_gallery_tags (gallery_id, tag_id) VALUES ?', [tagRows]);
    }

    await connection.commit();
    res.json({ message: 'Gallery updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating gallery:', error);
    res.status(500).json({ error: 'Failed to update gallery', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

// DELETE /api/analog/galleries/:id - Delete gallery and all photos
router.delete('/galleries/:id', verifyJWT, requireAdmin, async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);

  try {
    // 1. Fetch all photos in the gallery to delete physical files
    const photos = await db.query('SELECT filename, thumbnail FROM photos WHERE analog_gallery_id = ?', [galleryId]);

    for (const photo of photos) {
      deletePhotoFiles(photo);
    }

    // 2. Delete gallery from DB (cascade handles photo records, photo tags, and gallery tags in DB)
    await db.query('DELETE FROM analog_galleries WHERE id = ?', [galleryId]);

    res.json({ message: 'Gallery and associated photos deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery:', error);
    res.status(500).json({ error: 'Failed to delete gallery', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/analog/galleries/:id/publish - Toggle published state
router.put('/galleries/:id/publish', verifyJWT, requireAdmin, async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);
  try {
    const rows = await db.query('SELECT is_published FROM analog_galleries WHERE id = ?', [galleryId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found', code: 'NOT_FOUND' });
    }
    const newState = rows[0].is_published ? 0 : 1;
    await db.query('UPDATE analog_galleries SET is_published = ? WHERE id = ?', [newState, galleryId]);
    res.json({ is_published: !!newState });
  } catch (error) {
    console.error('Error toggling gallery publish state:', error);
    res.status(500).json({ error: 'Failed to toggle gallery publish state', code: 'DATABASE_ERROR' });
  }
});

// POST /api/analog/galleries/:id/photos - Upload photos to gallery (admin only, multipart)
router.post('/galleries/:id/photos', verifyJWT, requireAdmin, upload.array('photos', 12), async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No photo files uploaded', code: 'MISSING_FILES' });
  }

  const results = [];
  try {
    for (const file of req.files) {
      const processed = await processUpload(file.buffer, file.originalname);

      const [insertResult] = await db.pool.query(
        `INSERT INTO photos (zone, analog_gallery_id, filename, thumbnail, width, height, exif_json, uploaded_by) 
         VALUES ('analog', ?, ?, ?, ?, ?, ?, ?)`,
        [
          galleryId,
          processed.filename,
          processed.thumbnail,
          processed.width,
          processed.height,
          processed.exif_json,
          req.user.id
        ]
      );

      results.push({
        id: insertResult.insertId,
        ...processed,
        exif: processed.exif_json ? JSON.parse(processed.exif_json) : null
      });
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Error uploading analog photos:', error);
    res.status(500).json({ error: 'Failed to process and upload photos: ' + error.message, code: 'UPLOAD_FAILED' });
  }
});

// PUT /api/analog/galleries/:id/photos/reorder - Reorder photos within gallery
router.put('/galleries/:id/photos/reorder', verifyJWT, requireAdmin, async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Missing reorder updates list', code: 'INVALID_INPUT' });
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of updates) {
      await connection.query(
        'UPDATE photos SET sort_order = ? WHERE id = ? AND analog_gallery_id = ?',
        [parseInt(item.sort_order, 10), parseInt(item.id, 10), galleryId]
      );
    }
    await connection.commit();
    res.json({ message: 'Photo order updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error reordering analog photos:', error);
    res.status(500).json({ error: 'Failed to reorder photos', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

// DELETE /api/analog/photos/:id - Delete photo
router.delete('/photos/:id', verifyJWT, requireAdmin, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const rows = await db.query('SELECT filename, thumbnail FROM photos WHERE id = ? AND zone = "analog"', [photoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    // Delete physical files
    deletePhotoFiles(rows[0]);

    // Delete from DB
    await db.query('DELETE FROM photos WHERE id = ?', [photoId]);

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/analog/photos/:id/gallery - Toggle in_gallery state
router.put('/photos/:id/gallery', verifyJWT, requireAdmin, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);
  try {
    const rows = await db.query('SELECT in_gallery FROM photos WHERE id = ? AND zone = "analog"', [photoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }
    const newState = rows[0].in_gallery ? 0 : 1;
    await db.query('UPDATE photos SET in_gallery = ? WHERE id = ?', [newState, photoId]);
    res.json({ in_gallery: !!newState });
  } catch (error) {
    console.error('Error toggling photo gallery state:', error);
    res.status(500).json({ error: 'Failed to toggle photo gallery state', code: 'DATABASE_ERROR' });
  }
});

// POST /api/analog/photos/:id/publish - Push photo to public feed
router.post('/photos/:id/publish', verifyJWT, requireAdmin, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);
  const { caption, tagIds } = req.body;

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id FROM photos WHERE id = ? AND zone = "analog"', [photoId]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    // Update photo to public
    await connection.query(
      'UPDATE photos SET is_public = TRUE, caption = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?',
      [caption || null, photoId]
    );

    // Update photo tags
    await connection.query('DELETE FROM photo_tags WHERE photo_id = ?', [photoId]);

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const tagRows = tagIds.map(tagId => [photoId, tagId]);
      await connection.query('INSERT INTO photo_tags (photo_id, tag_id) VALUES ?', [tagRows]);
    }

    await connection.commit();
    res.json({ message: 'Photo published to public feed successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error publishing photo:', error);
    res.status(500).json({ error: 'Failed to publish photo', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

// PUT /api/analog/photos/:id/unpublish - Remove from public feed
router.put('/photos/:id/unpublish', verifyJWT, requireAdmin, async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      'UPDATE photos SET is_public = FALSE, published_at = NULL WHERE id = ? AND zone = "analog"',
      [photoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    res.json({ message: 'Photo unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing photo:', error);
    res.status(500).json({ error: 'Failed to unpublish photo', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
