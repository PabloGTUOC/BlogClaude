# Repo Review — Proposed Enhancements

Full-repo review (API, DB, frontend, deploy) from 2026-07-01. Ordered by priority: P0 items
are security holes worth fixing before anything else; P3 items are product ideas. Docker /
deploy items already agreed in [`deploy_pending.MD`](./deploy_pending.MD) are **not** repeated
here — that list still stands and its P1 (`.dockerignore`) is still the first deploy fix to make.

---

## P0 — Security (fix first)

> **Status:** #1–#3, #4 step 1, #5, #6 and the #7 batch were implemented on this branch
> (2026-07-02). #4 step 2 (authenticated media route) remains open — best done once the
> P2 test suite exists.

### 1. Mock auth fails open in production ✅ *implemented*
`api/src/services/firebase.js:21-24` — if `FIREBASE_SERVICE_ACCOUNT_PATH` is missing *or the
file fails to parse*, the API silently drops into MOCK AUTH MODE where **any string is accepted
as a valid login token**. A production misconfiguration (bad mount, typo'd path — exactly the
kind of thing `deploy_pending.MD` item 2 already hit once) turns the whole gate off: anyone can
register, and anyone who guesses/knows an email pattern can mint sessions.

**Fix:** gate mock mode behind an explicit opt-in and hard-exit otherwise:

```js
if (!firebaseApp) {
  if (process.env.ALLOW_MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    isMock = true;
  } else {
    console.error('FATAL: Firebase Admin SDK could not be initialized.');
    process.exit(1);
  }
}
```

### 2. Hardcoded JWT secret fallback ✅ *implemented*
`api/src/middleware/auth.js:3` — `JWT_SECRET || 'enderthoughts_secret_key_1984'`. The fallback
is in a public repo, so if `JWT_SECRET` is ever unset, anyone can forge an admin token. Same
pattern as #1: fail fast at boot if `JWT_SECRET` is missing instead of falling back.

### 3. Revoked users keep access for up to 7 days ✅ *implemented*
`api/src/routes/auth.js:65` bakes `role`/`status`/`group` into a 7-day JWT, and all middleware
(`requireApproved`, `requireFamily`, `requireAdmin`) trusts the token payload. Revoking or
demoting a user in Admin → Users does nothing until their token expires — the one moment you
revoke someone is exactly when you want it to bite immediately.

**Fix (pick one):**
- Cheapest: in `verifyJWT`, re-read `role`/`status`/`group` from the DB (one indexed PK lookup)
  and overwrite the token claims. At this app's traffic level the extra query is negligible.
- Alternative: keep claims but add a `token_version` column bumped on revoke/role change.

### 4. Private photos are publicly fetchable by URL ⚠️ *step 1 implemented; step 2 open*
`api/src/index.js:33` serves the entire uploads tree statically with no auth, and filenames are
guessable: `Date.now()_<originalname>.jpg` (`api/src/services/sharp.js:30-32`,
`video.js:29-35`). Every "gated" analog/digital photo is retrievable by anyone who can iterate
timestamps or who ever saw a URL. For a product whose core promise is *gated intimacy*, this is
the biggest gap between promise and implementation.

**Fix, two steps:**
1. Immediately: make filenames unguessable — `crypto.randomBytes(16).toString('hex')` instead
   of timestamp + original name (also fixes the same-millisecond collision where two uploads
   named alike overwrite each other).
2. Properly: serve media through an authenticated route (or nginx `X-Accel-Redirect`) that
   checks the photo's `is_public` / zone / group rules — the same logic the JSON routes already
   enforce. Public feed images can stay on the static path.

### 5. CORS is `origin: '*'` ✅ *implemented*
`api/src/index.js:19-23` — the comment even says to narrow it. `FRONTEND_ORIGIN` is already in
the environment (compose passes it); use it:

```js
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*', ... }));
```

### 6. Public feed photos can leak GPS home coordinates ✅ *implemented*
`sharp.js:19-24` extracts EXIF **including GPS** and stores it verbatim; `GET /api/photos`
returns `p.*` including `exif_json` to unauthenticated visitors. A photo taken at home and
pushed to the public feed publishes the house's coordinates.

**Fix:** strip GPS keys from `exif_json` in the public-feed and public photo-detail responses
(or at publish time). Keep full EXIF for logged-in zones — the camera/film readout is part of
the identity.

### 7. Smaller hardening items ✅ *implemented*
- **Rate limiting** — nothing on `POST /api/auth/firebase` or the comment endpoints.
  `express-rate-limit` on auth + writes is a few lines.
- **`helmet()`** on the API (skip CSP; the API only serves JSON + media).
- **`multipleStatements: true`** (`api/src/db.js:12`) is only needed by the migration runner but
  is enabled pool-wide, amplifying any future SQL-injection slip. Create a dedicated connection
  for migrations and drop the flag from the shared pool.
- **Google Photos OAuth endpoints** (`digital.js:38,153`) sit above the
  `router.use(verifyJWT, requireFamily)` line, so pending/friend accounts can start OAuth/poll
  sessions. Harmless-ish today, but move them behind `requireFamily` for consistency.

---

## P1 — Correctness & robustness

### 8. 200 MB uploads are buffered fully in RAM
`api/src/middleware/upload.js:4` uses `multer.memoryStorage()` with a 200 MB limit and up to 12
files per request — a single import batch can try to hold >2 GB in the Node heap and OOM the
container. Videos are then written back out as-is anyway (`video.js:41`).

**Fix:** switch multer to disk storage (temp dir under `UPLOAD_PATH`), pass paths instead of
buffers into `processUpload`/`processVideo` (sharp and ffmpeg both accept paths), and delete the
temp file in a `finally`.

### 9. Unvalidated pagination params
`api/src/routes/photos.js:31-33` — `?limit=0` yields `pages: Infinity`, `?page=0` a negative
offset (MySQL error → 500), `?limit=100000` dumps the table. Clamp: `page ≥ 1`,
`1 ≤ limit ≤ 50`.

### 10. Missing existence / affectedRows checks
- `digital.js` `POST /galleries/:id/photos` never checks the gallery exists → FK violation
  surfaces as a 500 instead of a 404, *after* files were already written to disk.
- `analog.js` `PUT /galleries/:id` ignores `affectedRows` → updating a nonexistent gallery
  returns "updated successfully".

### 11. Video files are stored as-is, so playback is codec roulette
`video.js:41` stores the original container/codec untouched. iPhone HEVC `.mov` files won't play
in Chrome/Firefox `<video>` tags. Since ffmpeg is already bundled, transcode non-H.264 sources
to H.264/AAC MP4 (or at minimum probe the codec and warn the uploader). This is the most likely
"my video doesn't play for grandma" bug report.

### 12. Feed query indexes
The public feed filters `WHERE is_public = TRUE ORDER BY sort_order, published_at DESC` with
per-row correlated subqueries for likes/comments. Fine at hundreds of photos, but a
`011_add_indexes.sql` adding `INDEX idx_photos_public_feed (is_public, sort_order, published_at)`
is cheap insurance and follows the existing migration pattern.

### 13. In-memory OAuth/import sessions
`digital.js:16-18` — documented single-instance behavior, fine for this deployment. Worth a
code comment noting the constraint; not worth Redis.

---

## P2 — Engineering infrastructure (currently zero)

### 14. Tests — start with the access-control matrix
There are no tests at all, yet the app's whole value is its permission model, which is also
what keeps regressing across sessions (see `Session.MD`). The highest-yield first test suite is
an integration matrix over the auth rules using `supertest` + `vitest` and a throwaway MySQL
(compose already provides one):

| | public | pending | friend (no group) | friend (berlin) | family | admin |
|---|---|---|---|---|---|---|
| feed / photo detail | ✅ | … | | | | |
| analog list/detail (published, tagged berlin) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| digital anything | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| admin routes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Mock-auth mode (#1) becomes genuinely useful here as the test-mode login path.

### 15. CI — GitHub Actions
No `.github/workflows`. A single workflow that runs lint + the test suite + `docker compose
build` on PRs would have caught several of the "fixed this session" items in `Session.MD`
(the nodemon-crashing template literal, the reserved-word 500) before they reached deploy.

### 16. ESLint + Prettier
No lint config in either package. `eslint` + `eslint-plugin-vue` on the frontend and a basic
node config on the API, wired into CI. Keeps multi-session/AI-assisted edits stylistically
convergent.

### 17. CLAUDE.md
This repo is developed session-by-session with AI assistance (`Session.MD`, `.impeccable/`),
but has no `CLAUDE.md`. Distill the stable facts — stack, run commands, migration convention,
the role/group access rules, "never restyle the CRT identity" — so every session starts with
the same context instead of re-deriving it from README/Session notes.

### 18. Root `package.json` is an accident
The root `package.json`/`package-lock.json` contain a single stray `firebase@^12` dependency —
nothing in the repo uses it (frontend has its own `firebase@^10`). Delete both files, or replace
with npm workspaces if a root manifest is wanted.

### 19. Backup story
`mysql-data` volume + the uploads bind mount are the family archive; neither is backed up by
anything in the repo. A documented `mysqldump` + uploads rsync cron (even just in SETUP.md)
turns "the disk died" from catastrophe into inconvenience.

---

## P3 — Product enhancements (aligned with PRODUCT.md)

- **Comment notifications** — the mailer service exists (admin signup alerts); extend it so the
  owner (later: photo uploader) gets a nightly digest of new comments/likes. Engagement is the
  product's stated success metric.
- **Gallery zip download** — "give me the Berlin roll" as one archive; a streaming `archiver`
  endpoint per gallery, admin/family only.
- **Responsive images** — cards ship the 900px thumb regardless of viewport; add a small
  (~320px) size and `srcset`, big mobile win for the feed.
- **PWA manifest + icon** — this is a phone app in practice; add-to-home-screen with the CRT
  boot flash as splash would land well with zero framework changes.
- **Finish the `Session.MD` pending list** — dead email/password form on Login, feed drag-and-drop
  reorder, Martian Mono swap, mobile nav auth button. Small, already-specced.

---

## Suggested execution order

1. **P0 #1–#3** (fail-open auth, JWT fallback, stale-claims) — one short session, no schema
   changes, immediately closes the forgeable/unrevokable-session holes.
2. **P0 #4** step 1 (random filenames) + #5 (CORS) + #7 batch.
3. **P1 #8–#10** (disk-storage uploads, param clamping, existence checks).
4. **P2 #14–#16** (tests + CI + lint) so everything after this has a safety net.
5. **P0 #4 step 2** (authenticated media route) — the largest single change, best done with
   tests in place.
6. `deploy_pending.MD` batch, then P1 #11/#12 and P3 as appetite allows.
