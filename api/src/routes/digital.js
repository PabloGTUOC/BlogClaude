const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const db = require('../db');
const { verifyJWT, requireFamily } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { processUpload } = require('../services/sharp');
const { processVideo } = require('../services/video');
const { importGooglePhoto, importGoogleVideo } = require('../services/googlePhotos');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// In-memory store for Google Photos OAuth sessions (cleared after use or 10 min timeout).
// NOTE: both maps assume a single API instance — sessions die on restart and won't be
// shared across replicas. Fine for this deployment; needs external storage if that changes.
const oauthSessions = new Map();
// Holds access tokens between poll-done and the subsequent import request (30 min TTL)
const importSessions = new Map();

// Helper to delete physical files
function deletePhotoFiles(photo) {
  for (const rel of [photo.filename, photo.thumbnail, photo.thumbnail_small]) {
    if (!rel) continue;
    const abs = path.join(uploadPath, rel);
    fs.unlink(abs, err => {
      if (err && err.code !== 'ENOENT') console.error(`Failed to delete file ${abs}:`, err);
    });
  }
}

// GET /api/digital/google-photos/oauth-url
// Returns a one-time Google OAuth URL + sessionId. Frontend opens this URL in a popup.
router.get('/google-photos/oauth-url', verifyJWT, requireFamily, (req, res) => {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    return res.status(500).json({ error: 'Google client secret not configured', code: 'CONFIG_ERROR' });
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const apiOrigin = process.env.API_ORIGIN || 'http://localhost:3000';

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: process.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${apiOrigin}/api/digital/google-photos/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    access_type: 'online',
    prompt: 'consent',
    state: sessionId
  });

  oauthSessions.set(sessionId, { status: 'pending' });
  setTimeout(() => oauthSessions.delete(sessionId), 10 * 60 * 1000);

  res.json({ url: authUrl.toString(), sessionId });
});

// GET /api/digital/google-photos/callback
// OAuth redirect target — no JWT, receives the code from Google, exchanges it, fetches photos,
// then sends a postMessage to the opener popup and closes.
router.get('/google-photos/callback', async (req, res) => {
  const { code, state: sessionId, error } = req.query;
  const apiOrigin = process.env.API_ORIGIN || 'http://localhost:3000';

  const closeWithError = (msg) => {
    if (sessionId && oauthSessions.has(sessionId)) {
      oauthSessions.set(sessionId, { status: 'error', error: msg });
    }
    res.send('<!DOCTYPE html><html><body><script>window.close();</script></body></html>');
  };

  if (error || !code) {
    return closeWithError(error || 'no_code');
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.VITE_GOOGLE_CLIENT_ID,
        client_secret: clientSecret,
        redirect_uri: `${apiOrigin}/api/digital/google-photos/callback`,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('[GooglePhotos] Token exchange failed:', tokenData);
      return closeWithError(tokenData.error_description || tokenData.error || 'token_exchange_failed');
    }

    console.log('[GooglePhotos] Token exchange OK, scopes:', tokenData.scope);

    // Create a Photos Picker session — gives us a pickerUri to redirect the popup into.
    const pickerRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const pickerSession = await pickerRes.json();

    if (!pickerRes.ok) {
      console.error('[GooglePhotos] Picker session creation failed:', pickerSession);
      return closeWithError(pickerSession?.error?.message || 'picker_session_failed');
    }

    console.log('[GooglePhotos] Picker session created:', pickerSession.id);

    if (sessionId && oauthSessions.has(sessionId)) {
      oauthSessions.set(sessionId, {
        status: 'picking',
        pickerSessionId: pickerSession.id,
        accessToken: tokenData.access_token
      });
    }

    // Redirect the popup into Google's own photo picker UI
    res.redirect(pickerSession.pickerUri);
  } catch (err) {
    console.error('[GooglePhotos] Callback error:', err);
    if (sessionId && oauthSessions.has(sessionId)) {
      oauthSessions.set(sessionId, { status: 'error', error: 'server_error' });
    }
    res.send('<!DOCTYPE html><html><body><script>window.close();</script></body></html>');
  }
});

// GET /api/digital/google-photos/picker-done
// Google redirects the picker popup here after the user confirms their selection.
// Just closes the window — the frontend is already polling the backend for status.
router.get('/google-photos/picker-done', (req, res) => {
  res.send('<!DOCTYPE html><html><body><script>window.close();</script></body></html>');
});

// GET /api/digital/google-photos/poll/:sessionId
// Frontend polls this every 2s. Handles three phases:
//   'pending'  — waiting for OAuth callback
//   'picking'  — OAuth done, user is selecting in Google's picker popup
//   'done'     — items selected, returned to frontend
router.get('/google-photos/poll/:sessionId', verifyJWT, requireFamily, async (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired', code: 'SESSION_NOT_FOUND' });
  }

  if (session.status === 'picking') {
    try {
      const pickerRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${session.pickerSessionId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const pickerData = await pickerRes.json();

      if (!pickerRes.ok) {
        console.error('[GooglePhotos] Picker session check failed:', pickerData);
        oauthSessions.delete(req.params.sessionId);
        return res.json({ status: 'error', error: pickerData?.error?.message || 'picker_check_failed' });
      }

      if (pickerData.mediaItemsSet) {
        const itemsRes = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${session.pickerSessionId}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
        const itemsData = await itemsRes.json();

        // Fetch small thumbnails server-side — Picker API baseUrls require auth so <img> tags
        // can't load them directly. We return base64 data URLs the browser can display without headers.
        const items = await Promise.all((itemsData.mediaItems || []).map(async item => {
          const baseUrl = item.mediaFile?.baseUrl;
          let thumbnailDataUrl = null;
          if (baseUrl) {
            try {
              const thumbRes = await fetch(`${baseUrl}=w200-h200`, {
                headers: { Authorization: `Bearer ${session.accessToken}` }
              });
              if (thumbRes.ok) {
                const buf = Buffer.from(await thumbRes.arrayBuffer());
                const mime = thumbRes.headers.get('content-type') || 'image/jpeg';
                thumbnailDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
              }
            } catch (e) { /* non-fatal — img will fall back to placeholder */ }
          }
          return {
            id: item.id,
            type: item.type || 'PHOTO', // 'PHOTO' | 'VIDEO'
            baseUrl,
            thumbnailDataUrl,
            filename: item.mediaFile?.filename || 'photo.jpg',
            creationTime: item.createTime
          };
        }));

        console.log(`[GooglePhotos] Picker done — ${items.length} items selected`);

        // Stash the access token so the import route can auth the image downloads.
        // We don't send the real token to the frontend — just an opaque session key.
        const importSessionId = crypto.randomBytes(16).toString('hex');
        importSessions.set(importSessionId, session.accessToken);
        setTimeout(() => importSessions.delete(importSessionId), 30 * 60 * 1000);

        oauthSessions.delete(req.params.sessionId);
        return res.json({ status: 'done', items, importSessionId });
      }

      // User is still picking
      return res.json({ status: 'picking' });
    } catch (err) {
      console.error('[GooglePhotos] Poll error:', err);
      oauthSessions.delete(req.params.sessionId);
      return res.json({ status: 'error', error: 'server_error' });
    }
  }

  // 'pending' stays in map; 'done' / 'error' are cleaned up
  if (session.status !== 'pending') {
    oauthSessions.delete(req.params.sessionId);
  }
  res.json(session);
});

// Digital routes require family or admin (friends only get analog)
router.use(verifyJWT, requireFamily);

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
      galleryQuery = 'SELECT * FROM digital_galleries WHERE `year_month` = ?';
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
      SELECT p.*, u.name AS uploader_name, u.avatar_url AS uploader_avatar,
             (SELECT COUNT(*) FROM photo_likes pl WHERE pl.photo_id = p.id) AS like_count,
             (SELECT COUNT(*) FROM photo_comments pc WHERE pc.photo_id = p.id) AS comment_count,
             EXISTS(SELECT 1 FROM photo_likes pl WHERE pl.photo_id = p.id AND pl.user_id = ?) AS liked_by_me
      FROM photos p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.digital_gallery_id = ?
      ORDER BY COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(p.exif_json, '$.DateTimeOriginal')),
        p.created_at
      ) ASC
    `;
    const photos = await db.query(photosQuery, [req.user.id, gallery.id]);

    res.json({
      gallery,
      photos
    });
  } catch (error) {
    console.error('Error fetching digital gallery details:', error);
    res.status(500).json({ error: 'Failed to fetch gallery details', code: 'DATABASE_ERROR' });
  }
});

// GET /api/digital/galleries/:id/download - Stream the month's media as a zip
// (family/admin only via the router-level guard above)
router.get('/galleries/:id/download', async (req, res) => {
  const galleryId = parseInt(req.params.id, 10);

  try {
    const galleryRows = await db.query(
      'SELECT `year_month`, display_name FROM digital_galleries WHERE id = ?',
      [galleryId]
    );
    if (galleryRows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found', code: 'NOT_FOUND' });
    }

    const photos = await db.query(
      'SELECT filename FROM photos WHERE digital_gallery_id = ? ORDER BY created_at ASC',
      [galleryId]
    );
    if (photos.length === 0) {
      return res.status(404).json({ error: 'Gallery has no media', code: 'NOT_FOUND' });
    }

    const gallery = galleryRows[0];
    const safeName = (gallery.display_name || gallery.year_month || '').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_')
      || `digital-gallery-${galleryId}`;
    res.attachment(`${safeName}.zip`);

    // store-only: JPEG/MP4 payloads don't compress, so skip deflate CPU
    const archive = archiver('zip', { store: true });
    archive.on('error', err => {
      console.error('Zip stream error:', err);
      res.destroy(err);
    });
    archive.pipe(res);

    photos.forEach((p, i) => {
      const abs = path.join(uploadPath, p.filename);
      if (fs.existsSync(abs)) {
        archive.file(abs, { name: `${String(i + 1).padStart(3, '0')}_${path.basename(p.filename)}` });
      }
    });
    archive.finalize();
  } catch (error) {
    console.error('Error building gallery zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build gallery download', code: 'DOWNLOAD_FAILED' });
    }
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
    const existing = await db.query('SELECT id FROM digital_galleries WHERE `year_month` = ?', [year_month]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Gallery for this month already exists',
        code: 'GALLERY_EXISTS',
        galleryId: existing[0].id
      });
    }

    // 2. Create monthly gallery
    const insertResult = await db.query(
      'INSERT INTO digital_galleries (`year_month`, display_name, created_by) VALUES (?, ?, ?)',
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

  // Validate the target before processing anything, so a bad gallery id is a
  // clean 404 instead of an FK-violation 500 after files hit the disk.
  try {
    const galleryRows = await db.query('SELECT id FROM digital_galleries WHERE id = ?', [galleryId]);
    if (galleryRows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found', code: 'NOT_FOUND' });
    }
  } catch (error) {
    console.error('Error checking gallery existence:', error);
    return res.status(500).json({ error: 'Failed to verify gallery', code: 'DATABASE_ERROR' });
  }

  // Determine if it's a direct multipart file upload or Google Photos import payload
  const isMultipart = req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data');

  if (isMultipart) {
    // Standard file upload processing
    upload.array('photos', 12)(req, res, async (err) => {
      if (err) {
        upload.cleanupFiles(req.files); // files staged before the failure
        return res.status(400).json({ error: err.message, code: 'MULTER_ERROR' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded', code: 'MISSING_FILES' });
      }

      const results = [];
      try {
        for (const file of req.files) {
          const isVideo = file.mimetype.startsWith('video/');
          const processed = isVideo
            ? await processVideo(file.path, file.originalname)
            : await processUpload(file.path, file.originalname);

          const [insertResult] = await db.pool.query(
            `INSERT INTO photos (zone, digital_gallery_id, filename, thumbnail, thumbnail_small, width, height, duration, media_type, exif_json, uploaded_by, source)
             VALUES ('digital', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'direct')`,
            [
              galleryId,
              processed.filename,
              processed.thumbnail,
              processed.thumbnail_small,
              processed.width,
              processed.height,
              processed.duration,
              processed.media_type,
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
      } finally {
        upload.cleanupFiles(req.files);
      }
    });
  } else {
    // Google Photos Import processing
    const { source, googlePhotos, importSessionId } = req.body;

    if (source !== 'google_photos' || !googlePhotos || !Array.isArray(googlePhotos) || googlePhotos.length === 0) {
      return res.status(400).json({ error: 'Invalid body parameters', code: 'INVALID_INPUT' });
    }

    // Retrieve the access token stored by the poll endpoint — needed to download Picker API images
    const accessToken = importSessionId ? importSessions.get(importSessionId) : null;
    if (!accessToken) {
      return res.status(400).json({ error: 'Import session expired or missing. Please re-import from Google Photos.', code: 'IMPORT_SESSION_EXPIRED' });
    }
    // Keep the session until the import succeeds so a failed import can be retried
    // with the same token (it's cleaned up on success, or by its 30-min TTL otherwise).

    const results = [];
    try {
      for (const item of googlePhotos) {
        const isVideo = item.type === 'VIDEO';
        const processed = isVideo
          ? await importGoogleVideo(item.baseUrl, item.filename, accessToken)
          : await importGooglePhoto(item.baseUrl, item.filename, item.creationTime, accessToken);

        const [insertResult] = await db.pool.query(
          `INSERT INTO photos (zone, digital_gallery_id, filename, thumbnail, thumbnail_small, width, height, duration, media_type, exif_json, uploaded_by, source, google_photos_id)
           VALUES ('digital', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_photos', ?)`,
          [
            galleryId,
            processed.filename,
            processed.thumbnail,
            processed.thumbnail_small,
            processed.width,
            processed.height,
            processed.duration,
            processed.media_type,
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

      importSessions.delete(importSessionId);
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
