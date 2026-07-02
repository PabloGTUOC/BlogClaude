import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { setDbHandler } from './helpers/mockDb.js';
const {
  verifyJWT, optionalAuth, requireApproved, requireFamily, requireAdmin,
  JWT_SECRET, MEDIA_COOKIE
} = require('../src/middleware/auth');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

function sign(payload) {
  return jwt.sign({ id: 1, ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

describe('role gate matrix', () => {
  // [middleware, role, status, shouldPass]
  const matrix = [
    [requireApproved, 'admin', 'pending', true], // admin bypasses status
    [requireApproved, 'family', 'approved', true],
    [requireApproved, 'family', 'pending', false],
    [requireApproved, 'friend', 'approved', true],
    [requireApproved, 'friend', 'pending', false],
    [requireApproved, 'user', 'approved', true],
    [requireFamily, 'admin', 'pending', true],
    [requireFamily, 'family', 'approved', true],
    [requireFamily, 'family', 'pending', false],
    [requireFamily, 'friend', 'approved', false],
    [requireFamily, 'user', 'approved', false],
    [requireAdmin, 'admin', 'approved', true],
    [requireAdmin, 'family', 'approved', false],
    [requireAdmin, 'friend', 'approved', false],
    [requireAdmin, 'user', 'approved', false]
  ];

  for (const [mw, role, status, shouldPass] of matrix) {
    it(`${mw.name}: ${role}/${status} -> ${shouldPass ? 'allow' : 'deny'}`, () => {
      const req = { user: { id: 1, role, status } };
      const res = mockRes();
      const next = vi.fn();
      mw(req, res, next);
      if (shouldPass) {
        expect(next).toHaveBeenCalled();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
      }
    });
  }

  it('all gates reject a missing user with 401', () => {
    for (const mw of [requireApproved, requireFamily, requireAdmin]) {
      const res = mockRes();
      const next = vi.fn();
      mw({}, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('verifyJWT (DB-fresh claims)', () => {
  beforeEach(() => setDbHandler(() => []));

  it('overrides stale token claims with current DB values', async () => {
    // Token says family, DB says friend — DB must win.
    setDbHandler(() => [{ id: 1, role: 'friend', status: 'approved', group: 'berlin' }]);
    const req = { headers: { authorization: `Bearer ${sign({ role: 'family', status: 'approved' })}` } };
    const res = mockRes();
    const next = vi.fn();
    await verifyJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('friend');
    expect(req.user.group).toBe('berlin');
  });

  it('rejects a user revoked after their token was issued', async () => {
    setDbHandler(() => [{ id: 1, role: 'family', status: 'revoked' }]);
    const req = { headers: { authorization: `Bearer ${sign({ role: 'family', status: 'approved' })}` } };
    const res = mockRes();
    const next = vi.fn();
    await verifyJWT(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('ACCESS_REVOKED');
  });

  it('rejects a token for a deleted account', async () => {
    setDbHandler(() => []);
    const req = { headers: { authorization: `Bearer ${sign({})}` } };
    const res = mockRes();
    const next = vi.fn();
    await verifyJWT(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects garbage and missing tokens', async () => {
    for (const headers of [{ authorization: 'Bearer not-a-jwt' }, {}]) {
      const res = mockRes();
      const next = vi.fn();
      await verifyJWT({ headers }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    }
  });

  it('accepts the media cookie as a token source', async () => {
    setDbHandler(() => [{ id: 1, role: 'family', status: 'approved' }]);
    const req = { headers: {}, cookies: { [MEDIA_COOKIE]: sign({}) } };
    const res = mockRes();
    const next = vi.fn();
    await verifyJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('family');
  });
});

describe('optionalAuth', () => {
  it('attaches a fresh user when the token is valid', async () => {
    setDbHandler(() => [{ id: 1, role: 'admin', status: 'approved' }]);
    const req = { headers: { authorization: `Bearer ${sign({})}` } };
    const next = vi.fn();
    await optionalAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
  });

  it('continues anonymously on invalid token or revoked user', async () => {
    setDbHandler(() => [{ id: 1, role: 'family', status: 'revoked' }]);
    for (const headers of [{ authorization: 'Bearer junk' }, { authorization: `Bearer ${sign({})}` }, {}]) {
      const req = { headers };
      const next = vi.fn();
      await optionalAuth(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    }
  });
});
