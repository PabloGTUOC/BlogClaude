// Access-control matrix for the authenticated media route: who can fetch
// which files from /uploads. This is the enforcement point for the app's
// core promise (gated galleries), so every role × zone combination is pinned.
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { setDbHandler } from './helpers/mockDb.js';
const { JWT_SECRET, MEDIA_COOKIE } = require('../src/middleware/auth');
const mediaRouter = require('../src/routes/media');

const app = express();
app.use(cookieParser());
app.use('/uploads', mediaRouter);

const FIXTURE_DIR = process.env.UPLOAD_PATH;
const FILE = 'aabbccdd00112233aabbccdd00112233.jpg';

beforeAll(() => {
  fs.mkdirSync(path.join(FIXTURE_DIR, 'full'), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE_DIR, 'thumbs'), { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, 'full', FILE), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  fs.writeFileSync(path.join(FIXTURE_DIR, 'thumbs', FILE), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
});

const USERS = {
  admin: { id: 1, role: 'admin', status: 'approved', group: null },
  family: { id: 2, role: 'family', status: 'approved', group: null },
  friendBerlin: { id: 3, role: 'friend', status: 'approved', group: 'berlin' },
  friendAsturias: { id: 4, role: 'friend', status: 'approved', group: 'asturias' },
  friendNoGroup: { id: 5, role: 'friend', status: 'approved', group: null },
  pending: { id: 6, role: 'user', status: 'pending', group: null },
  legacyUser: { id: 8, role: 'user', status: 'approved', group: null }
};

const PHOTOS = {
  publicFeed: { is_public: 1, zone: 'analog', analog_gallery_id: 10, analog_published: 1 },
  digital: { is_public: 0, zone: 'digital', analog_gallery_id: null, analog_published: null },
  analogPublished: { is_public: 0, zone: 'analog', analog_gallery_id: 10, analog_published: 1 },
  analogUnpublished: { is_public: 0, zone: 'analog', analog_gallery_id: 11, analog_published: 0 },
  // Direct feed upload (zone 'feed', no gallery). Public while published;
  // once unpublished it must grant nothing to anyone but admin.
  feedPublic: { is_public: 1, zone: 'feed', analog_gallery_id: null, analog_published: null },
  feedUnpublished: { is_public: 0, zone: 'feed', analog_gallery_id: null, analog_published: null }
};

function setup({ photo, user, galleryTags = [] }) {
  setDbHandler((sql) => {
    if (sql.includes('FROM users')) return user ? [user] : [];
    if (sql.includes('FROM photos p')) return photo ? [photo] : [];
    if (sql.includes('analog_gallery_tags')) return galleryTags;
    throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
  });
}

function get(userKey) {
  const req = request(app).get(`/uploads/full/${FILE}`);
  if (userKey) {
    const token = jwt.sign({ id: USERS[userKey].id }, JWT_SECRET, { expiresIn: '1h' });
    req.set('Cookie', `${MEDIA_COOKIE}=${token}`);
  }
  return req;
}

describe('media access matrix', () => {
  beforeEach(() => setDbHandler(() => []));

  // [description, photo, userKey, galleryTags, expectedStatus]
  const matrix = [
    ['public photo, anonymous', 'publicFeed', null, [], 200],
    ['public photo, pending user', 'publicFeed', 'pending', [], 200],

    ['digital, anonymous', 'digital', null, [], 403],
    ['digital, pending', 'digital', 'pending', [], 403],
    ['digital, friend', 'digital', 'friendBerlin', [], 403],
    ['digital, legacy user', 'digital', 'legacyUser', [], 403],
    ['digital, family', 'digital', 'family', [], 200],
    ['digital, admin', 'digital', 'admin', [], 200],

    ['analog published, anonymous', 'analogPublished', null, [], 403],
    ['analog published, family', 'analogPublished', 'family', [], 200],
    ['analog published, legacy user', 'analogPublished', 'legacyUser', [], 200],
    ['analog published, friend w/ matching group', 'analogPublished', 'friendBerlin', [{ 1: 1 }], 200],
    ['analog published, friend w/ wrong group', 'analogPublished', 'friendAsturias', [], 403],
    ['analog published, friend w/o group', 'analogPublished', 'friendNoGroup', [], 403],

    ['analog unpublished, family', 'analogUnpublished', 'family', [], 403],
    ['analog unpublished, friend', 'analogUnpublished', 'friendBerlin', [{ 1: 1 }], 403],
    ['analog unpublished, admin', 'analogUnpublished', 'admin', [], 200],

    ['feed public, anonymous', 'feedPublic', null, [], 200],
    ['feed public, friend', 'feedPublic', 'friendBerlin', [], 200],
    ['feed unpublished, anonymous', 'feedUnpublished', null, [], 403],
    ['feed unpublished, family', 'feedUnpublished', 'family', [], 403],
    ['feed unpublished, friend', 'feedUnpublished', 'friendBerlin', [], 403],
    ['feed unpublished, admin', 'feedUnpublished', 'admin', [], 200]
  ];

  for (const [desc, photoKey, userKey, galleryTags, expected] of matrix) {
    it(`${desc} -> ${expected}`, async () => {
      setup({ photo: PHOTOS[photoKey], user: userKey ? USERS[userKey] : null, galleryTags });
      const res = await get(userKey);
      expect(res.status).toBe(expected);
    });
  }

  it('Bearer header works as an alternative to the cookie', async () => {
    setup({ photo: PHOTOS.digital, user: USERS.family });
    const token = jwt.sign({ id: USERS.family.id }, JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app)
      .get(`/uploads/full/${FILE}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('files without an owning photo row are 404', async () => {
    setup({ photo: null, user: null });
    const res = await request(app).get(`/uploads/full/${FILE}`);
    expect(res.status).toBe(404);
  });

  it('rejects path traversal attempts', async () => {
    setup({ photo: PHOTOS.publicFeed, user: null });
    const res = await request(app).get('/uploads/full/..%2E%2Fsecret.jpg');
    expect([400, 404]).toContain(res.status);
  });

  it('serves thumbnails under the same rules', async () => {
    setup({ photo: PHOTOS.digital, user: USERS.family });
    const res = await request(app)
      .get(`/uploads/thumbs/${FILE}`)
      .set('Cookie', `${MEDIA_COOKIE}=${jwt.sign({ id: 2 }, JWT_SECRET, { expiresIn: '1h' })}`);
    expect(res.status).toBe(200);
  });

  it('public media is cacheable, private media is not shared-cacheable', async () => {
    setup({ photo: PHOTOS.publicFeed, user: null });
    const pub = await request(app).get(`/uploads/full/${FILE}`);
    expect(pub.headers['cache-control']).toContain('public');

    setup({ photo: PHOTOS.digital, user: USERS.family });
    const priv = await request(app)
      .get(`/uploads/full/${FILE}`)
      .set('Cookie', `${MEDIA_COOKIE}=${jwt.sign({ id: 2 }, JWT_SECRET, { expiresIn: '1h' })}`);
    expect(priv.headers['cache-control']).toContain('private');
  });
});
