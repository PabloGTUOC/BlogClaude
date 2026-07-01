# enderthoughts

A private, retro-terminal-styled photo & video blog for family and friends. Public Instagram-style
feed up front; gated **analog** (film roll) and **digital** (monthly) galleries behind Google sign-in,
with fine-grained access control by role and friend group.

> **Setup & deployment instructions live in [SETUP.md](./SETUP.md).** This document describes what the
> app is, how it's built, and how the pieces fit together.

---

## Stack

- **Frontend:** Vue 3 (Options API) + Vite + Vue Router + Pinia
- **Backend:** Node.js + Express + MySQL 8 (`mysql2`)
- **Auth:** Firebase Authentication (Google OAuth) on the frontend → custom JWT sessions on the backend
- **Image processing:** `sharp` (full + thumbnail, EXIF via `exifr`)
- **Video processing:** `fluent-ffmpeg` + bundled `ffmpeg-static` / `ffprobe-static` (no system ffmpeg needed)
- **Cloud import:** Google Photos **Picker API** (`photospicker.googleapis.com`)
- **Deployment:** Docker Compose (db / api / frontend), images pinned to `linux/amd64`

Target host: a Linux box behind a Cloudflare Tunnel / Nginx Proxy Manager. Images are built on
Apple Silicon with `--platform linux/amd64` for x86 deployment.

---

## Roles & access control

Three independent levers govern access:

| Lever | Values | Meaning |
|---|---|---|
| **role** | `admin` · `family` · `friend` · `user` | Access tier |
| **status** | `pending` · `approved` · `revoked` | Account state |
| **group** | a tag name (e.g. `berlin`) | Friend circle membership |

### Tier capabilities

| Capability | admin | family | friend | user (legacy) | public |
|---|:--:|:--:|:--:|:--:|:--:|
| Public feed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analog galleries (view) | ✅ all | ✅ published | ✅ **group-tagged only** | ✅ published | ❌ |
| Digital galleries | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload / delete own media | ✅ | ✅ (digital) | ❌ | ❌ | ❌ |
| Admin panel | ✅ | ❌ | ❌ | ❌ | ❌ |

- **Digital** is family + admin only (`requireFamily`).
- **Friend analog access rule:** a friend sees a *published* analog gallery **only if it carries a tag
  matching their `group`**. The `friends` tag is just a label and grants no access on its own. A friend
  with no group sees nothing.
- **admin** is set directly in MySQL — there is no UI path to it.

### Registration flow
1. User signs in with Google (Firebase).
2. Frontend sends the Firebase ID token to `POST /api/auth/firebase`.
3. Backend verifies it (Firebase Admin SDK), upserts the user, returns a session JWT carrying
   `role`, `status`, and `group`.
4. `pending` → `/waiting`; `approved` → access per role; `revoked` → logged out.

Group assignment and approvals are handled in **Admin → Users**; the group dropdown is populated from
the existing tag taxonomy so group names can never drift from gallery tags.

---

## App zones

### Public — `/`
Masonry feed of photos where `is_public = true`. Photo detail lightbox with EXIF readout, tags, and a
`[35mm]` / `[DIGITAL]` badge. Plus `/about`, `/login`, `/waiting`.

### Analog — `/analog`
Film-roll galleries with terminal-style metadata (camera, film stock, month/year, notes, tags).
View for approved users (filtered for friends); create/edit/delete/publish are admin-only.

### Digital — `/digital`
One monthly gallery per `YYYY-MM` (e.g. "June 2026"), enforced by a unique constraint. Family/admin
browse a timeline, create the current month's gallery, and upload **photos or videos** — by direct
upload or Google Photos import. Each card shows the uploader. Uploaders can delete their own media;
admins can delete anything.

### Admin — `/admin`
Feed manager, analog manager, digital manager, tag taxonomy, and user management (pending / approved /
revoked tabs, with role + group assignment). Guarded on both router and backend middleware.

---

## Media pipeline

Every upload (analog/digital, direct or Google Photos):

- **Images** → `sharp`: full image (max 5000px long edge, JPEG q92, 4:4:4) + thumbnail (max 900px,
  q88); EXIF extracted with `exifr`. Stored under `UPLOAD_PATH/full` and `UPLOAD_PATH/thumbs`.
- **Videos** → stored as-is; `ffmpeg`/`ffprobe` (bundled, static binaries) extract a poster-frame
  thumbnail plus dimensions and duration. Rendered with a `<video>` player in the lightbox and a
  play badge + duration on cards.
- Accepts `image/*` and `video/*`, up to **200 MB** per file.

The `photos` table tracks `media_type` (`image` | `video`) and `duration`.

### Google Photos import (Picker API)
The legacy Photos *Library* API is deprecated; the app uses the **Picker API** with the
`photospicker.mediaitems.readonly` scope and a server-side **authorization-code** flow:

1. Backend returns a one-time OAuth URL; the frontend opens it in a popup.
2. Google redirects to `…/api/digital/google-photos/callback`; the backend exchanges the code
   (`GOOGLE_CLIENT_SECRET`) and creates a Picker session, then redirects the popup into Google's picker.
3. The frontend polls the backend; when the user finishes selecting, the backend reads the chosen items
   and downloads them (photos with `=d`, videos with `=dv`, authorized with the access token).
4. Items are processed through the normal image/video pipeline.

(Backend polling + a server-stored session sidestep the COOP restrictions that break popup
`postMessage`.)

---

## Database

Migrations live in `db/migrations/` and run **automatically on API boot**
(`api/src/services/migrations.js`, tracked in a `migrations_history` table):

| File | Purpose |
|---|---|
| `001_create_users.sql` | users |
| `002_create_tags.sql` | tags |
| `003_create_analog_galleries.sql` | analog galleries |
| `004_create_digital_galleries.sql` | digital (monthly) galleries |
| `005_create_photos.sql` | photos (images & videos) |
| `006_create_junction_tables.sql` | `analog_gallery_tags`, `photo_tags` |
| `007_add_gallery_published_and_in_gallery.sql` | `is_published`, `in_gallery` |
| `008_user_roles_and_groups.sql` | role enum → `admin/family/friend/user`, `group` column |
| `009_add_media_type_to_photos.sql` | `media_type`, `duration` |

Core `photos` columns: `zone`, `analog_gallery_id`/`digital_gallery_id`, `filename`, `thumbnail`,
`width`, `height`, `duration`, `media_type`, `exif_json`, `is_public`, `caption`, `sort_order`,
`uploaded_by`, `source` (`direct` | `google_photos`), `google_photos_id`, `published_at`.

---

## API routes

All responses are JSON; errors are `{ error, code }`. Middleware: `verifyJWT`, `requireApproved`,
`requireFamily`, `requireAdmin`.

**Auth** — `POST /api/auth/firebase`

**Public** — `GET /api/photos` (paginated feed), `GET /api/photos/:id`

**Analog** (GET: `requireApproved`, filtered for friends; writes: `requireAdmin`)
`GET/POST /api/analog/galleries`, `GET/PUT/DELETE /api/analog/galleries/:id`,
`POST /api/analog/galleries/:id/photos`, `DELETE /api/analog/photos/:id`,
`POST /api/analog/photos/:id/publish`, `PUT /api/analog/photos/:id/unpublish`

**Digital** (`requireFamily`)
`GET/POST /api/digital/galleries`, `GET /api/digital/galleries/:id`,
`POST /api/digital/galleries/:id/photos` (direct multipart **or** `google_photos` source),
`DELETE /api/digital/photos/:id` (own, or any if admin),
plus Google Photos: `GET …/google-photos/oauth-url`, `GET …/google-photos/callback`,
`GET …/google-photos/picker-done`, `GET …/google-photos/poll/:sessionId`

**Admin** (`requireAdmin`)
`/api/admin/feed` (+ `/:id`, `/reorder/bulk`), `/api/admin/tags`,
`/api/admin/users` (+ `:id/role`, `:id/approve`, `:id/revoke`, `:id/restore`)

---

## Project structure

```
enderthoughts/
├── docker-compose.yml        # db / api / frontend (frontend build args for VITE_*)
├── deploy.sh                 # validate .env → build (amd64) → compose up
├── .env.example
├── SETUP.md                  # full setup & deployment guide
├── db/migrations/            # 001–009, auto-applied on boot
├── api/
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── middleware/       # auth.js, upload.js (image/* + video/*, 200MB)
│       ├── routes/           # auth, photos, analog, digital, admin/*
│       └── services/         # sharp.js, video.js, googlePhotos.js, migrations.js, firebase, mailer
└── frontend/
    ├── Dockerfile            # multi-stage Vite build → nginx; VITE_* via build args
    ├── nginx.conf
    └── src/
        ├── router/           # guards: pending / approved / admin
        ├── stores/           # auth, photos, analog, digital, admin, ui (toasts + confirm)
        ├── views/            # Home, PhotoDetail, analog/*, digital/*, admin/*
        └── components/       # PhotoCard, Lightbox, UploadZone, UserRow,
                              #   TerminalModal (a11y modal), GlobalNotifications (toasts/confirm), …
```

---

## Local development

```bash
docker compose up -d db          # MySQL
cd api && npm install && npm run dev        # API (auto-runs migrations on boot)
cd ../frontend && npm install && npm run dev  # Vue app
```

Copy `.env.example` → `.env` first and fill it in. See **[SETUP.md](./SETUP.md)** for Firebase,
Google Photos Picker, the first admin user, and Docker deployment.

## Deployment

```bash
./deploy.sh
```

Builds `linux/amd64` images (passing `VITE_*` as build args), recreates the Compose stack, and applies
migrations on API boot. Published ports: frontend `8080`, api `3000`, db `3306`.
