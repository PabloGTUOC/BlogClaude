const express = require('express');
const router = express.Router();
const db = require('../../db');
const { verifyJWT, requireAdmin } = require('../../middleware/auth');

// Apply admin guard to all routes in this file
router.use(verifyJWT, requireAdmin);

// GET /api/admin/tags - Get all tags with usage counts
router.get('/', async (req, res) => {
  try {
    const queryStr = `
      SELECT t.*,
             (SELECT COUNT(*) FROM analog_gallery_tags WHERE tag_id = t.id) AS gallery_count,
             (SELECT COUNT(*) FROM photo_tags WHERE tag_id = t.id) AS photo_count
      FROM tags t
      ORDER BY t.name ASC
    `;
    const tags = await db.query(queryStr);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags', code: 'DATABASE_ERROR' });
  }
});

// POST /api/admin/tags - Create a tag
router.post('/', async (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tag name is required', code: 'INVALID_INPUT' });
  }

  try {
    const [insertResult] = await db.pool.query(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name, color || null]
    );

    res.status(201).json({
      id: insertResult.insertId,
      name,
      color: color || null
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Tag name already exists', code: 'DUPLICATE_TAG' });
    }
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag', code: 'DATABASE_ERROR' });
  }
});

// PUT /api/admin/tags/:id - Update tag name/color
router.put('/:id', async (req, res) => {
  const tagId = parseInt(req.params.id, 10);
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tag name is required', code: 'INVALID_INPUT' });
  }

  try {
    const result = await db.query(
      'UPDATE tags SET name = ?, color = ? WHERE id = ?',
      [name, color || null, tagId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tag not found', code: 'NOT_FOUND' });
    }

    res.json({ id: tagId, name, color: color || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Tag name already exists', code: 'DUPLICATE_TAG' });
    }
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag', code: 'DATABASE_ERROR' });
  }
});

// DELETE /api/admin/tags/:id - Delete tag (FK cascades will clear junction records)
router.delete('/:id', async (req, res) => {
  const tagId = parseInt(req.params.id, 10);

  try {
    const result = await db.query('DELETE FROM tags WHERE id = ?', [tagId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tag not found', code: 'NOT_FOUND' });
    }

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
