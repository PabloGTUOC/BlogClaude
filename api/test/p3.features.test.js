// Coverage for the P3 features: small-thumbnail serving through the media
// route, gallery zip download access rules, and the engagement digest's
// state machine.
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { setDbHandler } from './helpers/mockDb.js';

// The digest module destructures the mailer export at require time, so the
// spy must be installed on the mailer object BEFORE digest.js is loaded.
const mailer = require('../src/services/mailer');
const digestSpy = vi.fn(async () => {});
mailer.sendEngagementDigest = digestSpy;
const { runDigestCheck } = require('../src/services/digest');

const { JWT_SECRET, MEDIA_COOKIE } = require('../src/middleware/auth');
const mediaRouter = require('../src/routes/media');
const analogRouter = require('../src/routes/analog');

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/uploads', mediaRouter);
app.use('/api/analog', analogRouter);

const FIXTURE_DIR = process.env.UPLOAD_PATH;
const FILE = 'ffeeddccbbaa00112233445566778899.jpg';

beforeAll(() => {
  for (const dir of ['full', 'thumbs', 'small']) {
    fs.mkdirSync(path.join(FIXTURE_DIR, dir), { recursive: true });
    fs.writeFileSync(path.join(FIXTURE_DIR, dir, FILE), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  }
});

function token(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
}

describe('media route serves the small thumbnail variant', () => {
  it('matches thumbnail_small and applies the same access rules', async () => {
    setDbHandler((sql) => {
      if (sql.includes('FROM photos p')) {
        return [{ is_public: 1, zone: 'analog', analog_gallery_id: 1, analog_published: 1 }];
      }
      return [];
    });
    const res = await request(app).get(`/uploads/small/${FILE}`);
    expect(res.status).toBe(200);
  });
});

describe('analog gallery zip download', () => {
  const USERS = {
    admin: { id: 1, role: 'admin', status: 'approved', group: null },
    friendNoGroup: { id: 5, role: 'friend', status: 'approved', group: null }
  };

  function setup(user, { gallery = [{ title: 'Berlin Roll' }], photos = [{ filename: `full/${FILE}` }] } = {}) {
    setDbHandler((sql) => {
      if (sql.includes('FROM users')) return user ? [user] : [];
      if (sql.includes('FROM analog_galleries ag')) return gallery;
      if (sql.includes('SELECT filename FROM photos')) return photos;
      throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
    });
  }

  it('streams a zip for an authorized user', async () => {
    setup(USERS.admin);
    const res = await request(app)
      .get('/api/analog/galleries/1/download')
      .set('Authorization', `Bearer ${token(1)}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('zip');
    expect(res.headers['content-disposition']).toContain('Berlin_Roll.zip');
    // zip local file header magic
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
  });

  it('rejects anonymous requests', async () => {
    setup(null);
    const res = await request(app).get('/api/analog/galleries/1/download');
    expect(res.status).toBe(401);
  });

  it('friend without a group cannot download (gallery invisible)', async () => {
    // The access clause returns no gallery row for a groupless friend
    setup(USERS.friendNoGroup, { gallery: [] });
    const res = await request(app)
      .get('/api/analog/galleries/1/download')
      .set('Cookie', `${MEDIA_COOKIE}=${token(5)}`);
    expect(res.status).toBe(404);
  });

  it('404s when the gallery has no photos', async () => {
    setup(USERS.admin, { photos: [] });
    const res = await request(app)
      .get('/api/analog/galleries/1/download')
      .set('Authorization', `Bearer ${token(1)}`);
    expect(res.status).toBe(404);
  });
});

describe('engagement digest state machine', () => {
  let state;
  let writes;

  function setupDigestDb({ comments = [], likes = [] } = {}) {
    writes = [];
    setDbHandler((sql, params) => {
      if (sql.includes('FROM app_state')) return state ? [{ value: state }] : [];
      if (sql.startsWith('INSERT INTO app_state')) {
        writes.push(params[1]);
        state = params[1];
        return { affectedRows: 1 };
      }
      if (sql.includes('FROM photo_comments c')) return comments;
      if (sql.includes('FROM photo_likes l')) return likes;
      throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
    });
  }

  beforeEach(() => {
    state = null;
    digestSpy.mockClear();
  });

  it('first run initializes the window without sending anything', async () => {
    setupDigestDb();
    await runDigestCheck();
    expect(digestSpy).not.toHaveBeenCalled();
    expect(writes.length).toBe(1);
  });

  it('does nothing before 24h have elapsed', async () => {
    state = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    setupDigestDb({ comments: [{ body: 'x', author: 'A', photo_id: 1 }] });
    await runDigestCheck();
    expect(digestSpy).not.toHaveBeenCalled();
    expect(writes.length).toBe(0);
  });

  it('sends the digest and advances the window after 24h with activity', async () => {
    state = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    setupDigestDb({
      comments: [{ body: 'lovely grain', author: 'A', caption: 'roll', photo_id: 1 }],
      likes: [{ author: 'B', caption: null, photo_id: 2 }]
    });
    await runDigestCheck();
    expect(digestSpy).toHaveBeenCalledTimes(1);
    const arg = digestSpy.mock.calls[0][0];
    expect(arg.comments.length).toBe(1);
    expect(arg.likes.length).toBe(1);
    expect(writes.length).toBe(1);
  });

  it('advances the window silently on a quiet day', async () => {
    state = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    setupDigestDb();
    await runDigestCheck();
    expect(digestSpy).not.toHaveBeenCalled();
    expect(writes.length).toBe(1); // window advanced, no email
  });
});
