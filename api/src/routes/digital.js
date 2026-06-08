const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { verifyJWT, requireApproved } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { processUpload } = require('../services/sharp');
const { importGooglePhoto } = require('../services/googlePhotos');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Helper to delete physical files
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

// All digital routes require a valid approved user
router.use(verifyJWT, requireApproved);

// GET /api/digital/galleries - List monthly galleries for timeline
router.get('/galleries', async (req, res) => {
  try {
    const queryStr = `
      SELECT dg.*,
             (SELECT COUNT(*) FROM photos WHERE digital_gallery_id = dg.id) AS photo_count,
             (SELECT COUNT(DISTINCT uploaded_by) FROM photos WHERE digital_gallery_id = dg.id) AS contributor_count,
             cp.thumbnail AS cover_photo_url
      FROM digital_galleries dg
      LEFT JOIN photos cp ON dg.cover_photo_id = cp.id
      ORDER BY dg.year_month DESC
    `;
    const galleries = await db.query(queryStr);
    res.json(galleries);
  } catch (error) {
    console.error('Error fetching digital galleries:', error);
    res.status(500).json({ error: 'Failed to fetch galleries', code: 'DATABASE_ERROR' });
  }
});

// GET /api/digital/galleries/:idOrYearMonth - Gallery detail + photos
router.get('/galleries/:idOrYearMonth', async (req, res) => {
  const param = req.params.idOrYearMonth;
  const isYearMonth = /^\d{4}-\d{2}$/.test(param);

  try {
    let galleryQuery;
    let params;

    if (isYearMonth) {
      galleryQuery = 'SELECT * FROM digital_galleries WHERE year_month = ?';
      params = [param];
    } else {
      galleryQuery = 'SELECT * FROM digital_galleries WHERE id = ?';
      params = [parseInt(param, 10)];
    }

    const galleryRows = await db.query(galleryQuery, params);
    if (galleryRows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found', code: 'NOT_FOUND' });
    }

    const gallery = galleryRows[0];

    const photosQuery = `
      SELECT p.*, u.name AS uploader_name, u.avatar_url AS uploader_avatar
      FROM photos p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.digital_gallery_id = ?
      ORDER BY p.created_at DESC
    `;
    const photos = await db.query(photosQuery, [gallery.id]);

    res.json({
      gallery,
      photos
    });
  } catch (error) {
    console.error('Error fetching digital gallery details:', error);
    res.status(500).json({ error: 'Failed to fetch gallery details', code: 'DATABASE_ERROR' });
  }
});

// POST /api/digital/galleries - Create monthly gallery
router.post('/galleries', async (req, res) => {
  const { year_month, display_name } = req.body;

  if (!year_month || !display_name) {
    return res.status(400).json({ error: 'Missing year_month or display_name', code: 'INVALID_INPUT' });
  }

  try {
    // 1. Check for existing monthly gallery
    const existing = await db.query('SELECT id FROM digital_galleries WHERE year_month = ?', [year_month]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Gallery for this month already exists',
        code: 'GALLERY_EXISTS',
        galleryId: existing[0].id
      });
    }

    // 2. Create monthly gallery
    const insertResult = await db.query(
      'INSERT INTO digital_galleries (year_month, display_name, created_by) VALUES (?, ?, ?)',
      [year_month, display_name, req.user.id]
    );

    res.status(201).json({
      id: insertResult.insertId,
      year_month,
      display_name
    });
  } catch (error) {
    console.error('Error creating digital gallery:', error);
    res.status(500).json({ error: 'Failed to create digital gallery', code: 'DATABASE_ERROR' });
  }
});

// POST /api/digital/galleries/:id/photos - Upload photos (Direct Multipart OR Google Photos URLs)
router.post('/galleries/:id/photos', async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);

  // Determine if it's a direct multipart file upload or Google Photos import payload
  const isMultipart = req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data');

  if (isMultipart) {
    // Standard file upload processing
    upload.array('photos', 12)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message, code: 'MULTER_ERROR' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded', code: 'MISSING_FILES' });
      }

      const results = [];
      try {
        for (const file of req.files) {
          const processed = await processUpload(file.buffer, file.originalname);

          const [insertResult] = await db.pool.query(
            `INSERT INTO photos (zone, digital_gallery_id, filename, thumbnail, width, height, exif_json, uploaded_by, source) 
             VALUES ('digital', ?, ?, ?, ?, ?, ?, ?, 'direct')`,
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

          const photoId = insertResult.insertId;

          // Set cover photo if not set
          await db.query(
            'UPDATE digital_galleries SET cover_photo_id = ? WHERE id = ? AND cover_photo_id IS NULL',
            [photoId, galleryId]
          );

          results.push({
            id: photoId,
            ...processed,
            exif: processed.exif_json ? JSON.parse(processed.exif_json) : null
          });
        }

        res.status(201).json(results);
      } catch (uploadErr) {
        console.error('Multipart upload processing failed:', uploadErr);
        res.status(500).json({ error: 'Upload processing failed: ' + uploadErr.message, code: 'UPLOAD_FAILED' });
      }
    });
  } else {
    // Google Photos Import processing
    const { source, googlePhotos } = req.body;

    if (source !== 'google_photos' || !googlePhotos || !Array.isArray(googlePhotos) || googlePhotos.length === 0) {
      return res.status(400).json({ error: 'Invalid body parameters', code: 'INVALID_INPUT' });
    }

    const results = [];
    try {
      for (const item of googlePhotos) {
        const processed = await importGooglePhoto(item.baseUrl, item.filename);

        const [insertResult] = await db.pool.query(
          `INSERT INTO photos (zone, digital_gallery_id, filename, thumbnail, width, height, exif_json, uploaded_by, source, google_photos_id) 
           VALUES ('digital', ?, ?, ?, ?, ?, ?, ?, 'google_photos', ?)`,
          [
            galleryId,
            processed.filename,
            processed.thumbnail,
            processed.width,
            processed.height,
            processed.exif_json,
            req.user.id,
            item.id || null
          ]
        );

        const photoId = insertResult.insertId;

        // Set cover photo if not set
        await db.query(
          'UPDATE digital_galleries SET cover_photo_id = ? WHERE id = ? AND cover_photo_id IS NULL',
          [photoId, galleryId]
        );

        results.push({
          id: photoId,
          ...processed,
          exif: processed.exif_json ? JSON.parse(processed.exif_json) : null
        });
      }

      res.status(201).json(results);
    } catch (importErr) {
      console.error('Google Photos Import failed:', importErr);
      res.status(500).json({ error: 'Google Photos Import failed: ' + importErr.message, code: 'IMPORT_FAILED' });
    }
  }
});

// DELETE /api/digital/photos/:id - Delete own photo or any photo if admin
router.delete('/photos/:id', async (req, res) => {
  const photoId = parseInt(req.params.id, 10);

  try {
    const rows = await db.query('SELECT * FROM photos WHERE id = ? AND zone = "digital"', [photoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found', code: 'NOT_FOUND' });
    }

    const photo = rows[0];

    // Authorization: User must be uploader OR admin
    if (photo.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this photo', code: 'FORBIDDEN' });
    }

    // Delete physical files
    deletePhotoFiles(photo);

    // Delete from DB
    await db.query('DELETE FROM photos WHERE id = ?', [photoId]);

    // Update cover photo if we deleted the current cover photo
    await db.query(
      `UPDATE digital_galleries dg 
       SET cover_photo_id = (SELECT id FROM photos WHERE digital_gallery_id = dg.id LIMIT 1) 
       WHERE dg.cover_photo_id = ?`,
      [photoId]
    );

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
