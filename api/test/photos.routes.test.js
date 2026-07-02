import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { setDbHandler } from './helpers/mockDb.js';
const { JWT_SECRET } = require('../src/middleware/auth');
const photosRouter = require('../src/routes/photos');

const app = express();
app.use(express.json());
app.use('/api/photos', photosRouter);

const approvedToken = jwt.sign({ id: 7 }, JWT_SECRET, { expiresIn: '1h' });
const APPROVED_USER = { id: 7, role: 'family', status: 'approved', group: null };

const GPS_EXIF = JSON.stringify({
  Make: 'Canon', Model: 'AE-1', ISO: 400,
  GPSLatitude: [40, 25, 0], GPSLongitude: [3, 42, 0], GPSAltitude: 650,
  latitude: 40.4167, longitude: -3.7033
});

function feedHandler({ photos = [], captureParams } = {}) {
  return (sql, params) => {
    if (sql.includes('COUNT(*) as total')) return [{ total: photos.length }];
    if (sql.includes('FROM users')) return [APPROVED_USER];
    if (sql.includes('FROM photos p')) {
      if (captureParams) captureParams(params);
      return photos.map(p => ({ ...p }));
    }
    throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
  };
}

describe('GET /api/photos pagination clamping', () => {
  beforeEach(() => setDbHandler(() => []));

  const cases = [
    // [query, expectedLimit, expectedOffset]
    ['', 12, 0],
    ['?page=0&limit=100000', 50, 0],
    ['?page=-3&limit=-5', 1, 0],
    ['?page=3&limit=20', 20, 40],
    ['?page=abc&limit=xyz', 12, 0]
  ];

  for (const [query, expLimit, expOffset] of cases) {
    it(`"${query || '(defaults)'}" -> limit ${expLimit}, offset ${expOffset}`, async () => {
      let captured;
      setDbHandler(feedHandler({ captureParams: p => { captured = p; } }));
      const res = await request(app).get(`/api/photos${query}`);
      expect(res.status).toBe(200);
      // params are [uid, limit, offset]
      expect(captured[1]).toBe(expLimit);
      expect(captured[2]).toBe(expOffset);
      expect(Number.isFinite(res.body.pagination.pages)).toBe(true);
    });
  }
});

describe('EXIF GPS stripping', () => {
  const photo = { id: 1, is_public: 1, exif_json: GPS_EXIF, tags: [] };

  it('anonymous viewers get EXIF without location', async () => {
    setDbHandler(feedHandler({ photos: [photo] }));
    const res = await request(app).get('/api/photos');
    expect(res.status).toBe(200);
    const exif = JSON.parse(res.body.photos[0].exif_json);
    expect(exif.Make).toBe('Canon'); // camera readout survives
    expect(exif.ISO).toBe(400);
    for (const key of Object.keys(exif)) {
      expect(key.startsWith('GPS')).toBe(false);
    }
    expect(exif.latitude).toBeUndefined();
    expect(exif.longitude).toBeUndefined();
  });

  it('approved members get full EXIF including GPS', async () => {
    setDbHandler(feedHandler({ photos: [photo] }));
    const res = await request(app)
      .get('/api/photos')
      .set('Authorization', `Bearer ${approvedToken}`);
    expect(res.status).toBe(200);
    const exif = JSON.parse(res.body.photos[0].exif_json);
    expect(exif.GPSLatitude).toBeDefined();
    expect(exif.latitude).toBeCloseTo(40.4167);
  });

  it('handles exif_json already parsed to an object (mysql2 JSON column)', async () => {
    setDbHandler(feedHandler({ photos: [{ ...photo, exif_json: JSON.parse(GPS_EXIF) }] }));
    const res = await request(app).get('/api/photos');
    expect(res.status).toBe(200);
    const exif = res.body.photos[0].exif_json;
    expect(exif.Make).toBe('Canon');
    expect(exif.GPSLatitude).toBeUndefined();
  });
});

describe('POST /api/photos/:id/comments validation', () => {
  function commentHandler() {
    return (sql, params) => {
      if (sql.includes('FROM users')) return [APPROVED_USER];
      if (sql.includes('SELECT id, is_public FROM photos')) return [{ id: 1, is_public: 1 }];
      if (sql.startsWith('INSERT INTO photo_comments')) return { insertId: 42 };
      if (sql.includes('FROM photo_comments c')) {
        return [{ id: 42, body: params ? 'ok' : 'ok', created_at: new Date().toISOString(), user_id: 7 }];
      }
      throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
    };
  }

  it('rejects an empty comment', async () => {
    setDbHandler(commentHandler());
    const res = await request(app)
      .post('/api/photos/1/comments')
      .set('Authorization', `Bearer ${approvedToken}`)
      .send({ body: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a comment over 2000 chars', async () => {
    setDbHandler(commentHandler());
    const res = await request(app)
      .post('/api/photos/1/comments')
      .set('Authorization', `Bearer ${approvedToken}`)
      .send({ body: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('rejects anonymous commenters', async () => {
    setDbHandler(commentHandler());
    const res = await request(app).post('/api/photos/1/comments').send({ body: 'hello' });
    expect(res.status).toBe(401);
  });

  it('accepts a valid comment from an approved user', async () => {
    setDbHandler(commentHandler());
    const res = await request(app)
      .post('/api/photos/1/comments')
      .set('Authorization', `Bearer ${approvedToken}`)
      .send({ body: 'lovely grain on this roll' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
  });
});
