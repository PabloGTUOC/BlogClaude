# Session Handoff — enderthoughts

Last updated: 2026-06-26

---

## Fixed This Session (2026-06-26)

| # | What | Where |
|---|------|-------|
| 1 | `docker-compose.yml` typo `volumes:I` | `docker-compose.yml:57` |
| 2 | Firebase service account volume mount crash when path empty — added `:-/dev/null` default | `docker-compose.yml:44` |
| 3 | `.env` created with DB credentials, Firebase config, upload path | `.env` |
| 4 | Analog photo upload 500 — Axios `Content-Type: multipart/form-data` stripped the boundary | `frontend/src/stores/analog.js` |
| 5 | Digital photo upload same boundary bug | `frontend/src/stores/digital.js` |
| 6 | Digital gallery create 500 — `YEAR_MONTH` is a MySQL 8 reserved word, queries now use backticks | `api/src/routes/digital.js` |
| 7 | Digital gallery create Network Error — backtick inside template literal crashed nodemon | `api/src/routes/digital.js` |
| 8 | Photo grid layout — mixed portrait/landscape heights, added `aspect-ratio: 3/2` + `object-fit: cover` | `frontend/src/styles/components.css`, `PhotoCard.vue` |
| 9 | Lightbox not opening on click — `PhotoCard` div was missing `@click="$emit('click')"` | `frontend/src/components/PhotoCard.vue` |
| 10 | Any approved user can now open/create a gallery for any month via picker | `frontend/src/views/digital/MonthlyTimeline.vue` |
| 11 | Admin can create digital gallery for any past month | `frontend/src/views/admin/DigitalManager.vue` |
| 12 | Google Photos import: append `=d` to baseUrl for full-res + EXIF download | `api/src/services/googlePhotos.js` |
| 13 | Google Photos `creationTime` passed through and injected into `exif_json` as fallback | `api/src/services/googlePhotos.js`, `MonthlyGallery.vue` |
| 14 | Digital gallery photos now sorted by EXIF `DateTimeOriginal` ASC (chronological) | `api/src/routes/digital.js` |

---

## Pending — Start Here Tomorrow

### P1 — Google OAuth Client ID (BLOCKER for Google Photos import)
`VITE_GOOGLE_CLIENT_ID` in `.env` is set to the project number `801008022261`.
It needs the full OAuth Client ID from Google Cloud Console.

**Steps:**
1. [console.cloud.google.com](https://console.cloud.google.com) → project `blog80s`
2. APIs & Services → Credentials → OAuth 2.0 Client IDs → copy full Client ID
3. On the same screen add `http://localhost:5173` to Authorized JavaScript Origins
4. Update `.env`: `VITE_GOOGLE_CLIENT_ID=801008022261-xxxxxxxx.apps.googleusercontent.com`
5. Restart Vite dev server (env vars require restart)
6. Also verify Google Photos Library API is enabled: APIs & Services → Enabled APIs

---

### P2 — User Role & Group System (design agreed, not yet implemented)

**Agreed design:**

| Role | Access |
|------|--------|
| `admin` | Everything + admin panel |
| `family` | All analog + all digital galleries |
| `friend` | Only analog galleries tagged with a matching group tag |
| `user` | Legacy / pending (keep for backward compat) |

New `group` VARCHAR(50) nullable column on `users`:
- `null` → general friend (sees galleries tagged `friends`)
- `asturias` → sees galleries tagged `friends` OR `asturias`
- `berlin_a`, `berlin_b`, `berlin_c` → sees galleries tagged `friends` OR their group
- Adding new groups = just add a new tag + assign users that group string

**Files to change:**
- New migration: `db/migrations/008_user_roles_and_groups.sql`
  - `ALTER TABLE users MODIFY COLUMN role ENUM('admin','family','friend','user') DEFAULT 'user';`
  - `ALTER TABLE users ADD COLUMN \`group\` VARCHAR(50) NULL DEFAULT NULL;`
- `api/src/middleware/auth.js` — add `requireFamily`, update `requireApproved` to handle new roles
- `api/src/routes/analog.js` — filter gallery list by user role + group vs gallery tags
- `api/src/routes/digital.js` — restrict to `family` and `admin` only
- `frontend/src/views/admin/UserManager.vue` — add role selector + group input fields

---

### P3 — Feed Admin Rework

**Current behaviour (broken UX):** Feed manager shows a flat browser of ALL photos from all analog galleries. Too noisy, not intentional.

**Agreed new behaviour:**
1. Admin visits a specific analog gallery in the admin panel (`/admin/analog/:id`)
2. Each photo has a **"Push to Feed"** button — this promotes it as a feed candidate
3. **Feed Manager** (`/admin/feed`) only shows photos already promoted — admin writes caption, assigns tags, toggles publish/unpublish
4. Removing from feed = "Unpublish" or "Scrap" — reverts `is_public = FALSE`
5. Public home feed unchanged

**Files to change:**
- `frontend/src/views/admin/AnalogGallery.vue` — add "Push to Feed" button per photo (calls existing publish endpoint or a new promote endpoint)
- `frontend/src/views/admin/FeedManager.vue` — filter to only show `is_public = TRUE` OR photos in feed queue; remove the gallery browser
- `api/src/routes/admin/feed.js` — review/confirm endpoints support this flow

---

## Still Pending from Previous Sessions

### Functional Gaps
| # | File | Gap |
|---|------|-----|
| 1 | `frontend/src/router/index.js` | Missing `/analog/:id/photo/:photoId` route — photos not URL-addressable |
| 2 | `frontend/src/views/admin/FeedManager.vue` | No drag-and-drop reorder |
| 3 | `api/src/routes/admin/feed.js` | URL mismatch with README: `PUT /api/admin/photos/reorder` vs actual `PUT /api/admin/feed/reorder/bulk` |
| 4 | `frontend/src/views/Login.vue` | Dead email/password form — should be Google OAuth only |

### Design Pending (from 2026-06-12 session)
| # | What |
|---|------|
| A | Replace IBM Plex Mono with Martian Mono (`tokens.css` + `index.html`) |
| B | Auth button scrolls off mobile nav — move out of `.nav__tabs` in `App.vue` |
| C | Grain effect invisible — change `mix-blend-mode` from `overlay` to `screen` in `components.css` |
| D | Hardcoded `#00e0ff` in Home.vue — move to `--neon-cyan` token |

---

## Key File Locations

| What | Where |
|------|-------|
| Environment config | `.env` (project root) |
| DB migrations | `db/migrations/` |
| API entry point | `api/src/index.js` |
| Auth middleware | `api/src/middleware/auth.js` |
| Analog routes | `api/src/routes/analog.js` |
| Digital routes | `api/src/routes/digital.js` |
| Feed admin routes | `api/src/routes/admin/feed.js` |
| Sharp image processing | `api/src/services/sharp.js` |
| Google Photos import | `api/src/services/googlePhotos.js` |
| Design tokens | `frontend/src/styles/tokens.css` |
| Component CSS | `frontend/src/styles/components.css` |
| Admin feed manager | `frontend/src/views/admin/FeedManager.vue` |
| Admin analog gallery | `frontend/src/views/admin/AnalogGallery.vue` |
| Admin user manager | `frontend/src/views/admin/UserManager.vue` |
| Digital timeline (public) | `frontend/src/views/digital/MonthlyTimeline.vue` |
| Digital gallery (public) | `frontend/src/views/digital/MonthlyGallery.vue` |
| Photo card component | `frontend/src/components/PhotoCard.vue` |
| Lightbox component | `frontend/src/components/Lightbox.vue` |
| Design context | `.impeccable.md` (project root) |
