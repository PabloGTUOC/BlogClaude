const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Gated media serving — replaces the old unauthenticated express.static mount.
// Every file is looked up in `photos` and released only if the requester could
// see that photo through the JSON API:
//   - is_public                  -> anyone (the public feed)
//   - admin                      -> everything
//   - digital zone               -> approved family
//   - analog zone                -> approved members, gallery published;
//                                   friends additionally need their group tag
// Auth arrives as a Bearer header or the /uploads-scoped media cookie set at
// login (plain <img>/<video> tags can't send headers).
router.get('/:dir(full|thumbs)/:name', optionalAuth, async (req, res) => {
  const { dir, name } = req.params;

  // Route params never contain '/', but be explicit about traversal anyway.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).json({ error: 'Invalid media path', code: 'INVALID_INPUT' });
  }
  const rel = `${dir}/${name}`;

  try {
    // A photo row owns two files (full + thumbnail); match either column.
    const rows = await db.query(
      `SELECT p.is_public, p.zone, p.analog_gallery_id,
              ag.is_published AS analog_published
       FROM photos p
       LEFT JOIN analog_galleries ag ON ag.id = p.analog_gallery_id
       WHERE p.filename = ? OR p.thumbnail = ?
       LIMIT 1`,
      [rel, rel]
    );

    if (rows.length === 0) {
      // Files with no owning photo row (orphans) are never served.
      return res.status(404).json({ error: 'Media not found', code: 'NOT_FOUND' });
    }

    const photo = rows[0];
    const user = req.user;

    let allowed = false;
    if (photo.is_public) {
      allowed = true;
    } else if (user && user.role === 'admin') {
      allowed = true;
    } else if (user && user.status === 'approved') {
      if (photo.zone === 'digital') {
        allowed = user.role === 'family';
      } else if (photo.zone === 'analog' && photo.analog_published) {
        if (user.role === 'friend') {
          // Friends see a gallery's media only when it carries their group tag
          if (user.group) {
            const tagRows = await db.query(
              `SELECT 1 FROM analog_gallery_tags agt
               JOIN tags t ON t.id = agt.tag_id
               WHERE agt.gallery_id = ? AND t.name = ?
               LIMIT 1`,
              [photo.analog_gallery_id, user.group]
            );
            allowed = tagRows.length > 0;
          }
        } else {
          allowed = true; // family + legacy 'user' role
        }
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }

    res.set('Cache-Control', photo.is_public ? 'public, max-age=86400' : 'private, max-age=3600');
    // sendFile handles Range requests, so <video> seeking keeps working.
    res.sendFile(path.join(uploadPath, rel), err => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Media not found', code: 'NOT_FOUND' });
      }
    });
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(500).json({ error: 'Failed to serve media', code: 'DATABASE_ERROR' });
  }
});

module.exports = router;
