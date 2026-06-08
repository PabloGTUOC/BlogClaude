const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { verifyJWT, requireAdmin } = require('../../middleware/auth');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../../uploads');

// Apply admin guard to all routes in this file
router.use(verifyJWT, requireAdmin);

// Helper to delete files
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

// GET /api/admin/feed - Get all photos (both public and library photos to curating)
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const offset = (page - 1) * limit;
  const filterPublic = req.query.is_public; // optional 'true' or 'false'

  try {
    let queryParams = [limit, offset];
    let filterClause = '';
    if (filterPublic === 'true') {
      filterClause = 'WHERE p.is_public = TRUE';
    } else if (filterPublic === 'false') {
      filterClause = 'WHERE p.is_public = FALSE';
    }

    const countQuery = `SELECT COUNT(*) as total FROM photos p ${filterClause}`;
    const [countRows] = await db.pool.query(countQuery);
    const total = countRows[0].total;

    const dataQuery = `
      SELECT p.*,
             COALESCE(
               (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t
                JOIN photo_tags pt ON pt.tag_id = t.id
                WHERE pt.photo_id = p.id),
               JSON_ARRAY()
             ) AS tags,
             ag.title AS analog_gallery_title,
             dg.display_name AS digital_gallery_name
      FROM photos p
      LEFT JOIN analog_galleries ag ON p.analog_gallery_id = ag.id
      LEFT JOIN digital_galleries dg ON p.digital_gallery_id = dg.id
      ${filterClause}
      ORDER BY p.sort_order ASC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [photos] = await db.pool.query(dataQuery, queryParams);

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
    console.error('Error fetching admin feed:', error);
    res.status(500).json({ error: 'Failed to fetch admin feed', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/photos/:id - Edit caption, tags, sort_order, is_public
router.put('/:id', async (req, res) => {
  const photoId = parseInt(req.params.id, 10);
  const { caption, tagIds, sort_order, is_public } = req.body;

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT is_public FROM photos WHERE id = ?', [photoId]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    const currentPhoto = rows[0];

    // Determine published_at value changes
    let publishedAtVal = undefined;
    if (is_public !== undefined) {
      if (is_public && !currentPhoto.is_public) {
        publishedAtVal = new Date(); // newly published
      } else if (!is_public) {
        publishedAtVal = null; // unpublished
      }
    }

    // Dynamic field updates
    const updates = [];
    const values = [];

    if (caption !== undefined) {
      updates.push('caption = ?');
      values.push(caption || null);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(parseInt(sort_order, 10));
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }
    if (publishedAtVal !== undefined) {
      updates.push('published_at = ?');
      values.push(publishedAtVal);
    }

    if (updates.length > 0) {
      values.push(photoId);
      await connection.query(`UPDATE photos SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      await connection.query('DELETE FROM photo_tags WHERE photo_id = ?', [photoId]);

      if (Array.isArray(tagIds) && tagIds.length > 0) {
        const tagRows = tagIds.map(tagId => [photoId, tagId]);
        await connection.query('INSERT INTO photo_tags (photo_id, tag_id) VALUES ?', [tagRows]);
      }
    }

    await connection.commit();
    res.json({ message: 'Photo updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

// DELETE /api/admin/photos/:id - Hard delete photo
router.delete('/:id', async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const rows = await db.query('SELECT filename, thumbnail FROM photos WHERE id = ?', [photoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    // Delete physical files
    deletePhotoFiles(rows[0]);

    // Hard delete from database (foreign key cascades remove entries in photo_tags and sets digital/analog links null/cascade)
    await db.query('DELETE FROM photos WHERE id = ?', [photoId]);

    res.json({ message: 'Photo hard deleted successfully' });
  } catch (error) {
    console.error('Error hard deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/photos/reorder - Bulk reorder
router.put('/reorder/bulk', async (req, res) => {
  const { updates } = req.body; // Array of { id, sort_order }

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Missing reorder updates list', code: 'INVALID_INPUT' });
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of updates) {
      await connection.query('UPDATE photos SET sort_order = ? WHERE id = ?', [
        parseInt(item.sort_order, 10),
        parseInt(item.id, 10)
      ]);
    }

    await connection.commit();
    res.json({ message: 'Feed order updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error reordering feed:', error);
    res.status(500).json({ error: 'Failed to reorder feed', code: 'DATABASE_ERROR' });
  } finally {
    connection.release();
  }
});

module.exports = router;
