You are an expert full-stack developer and DevOps engineer. Build a complete, production-ready personal blog application called "enderthoughts" with the following specs.

---

## PROJECT CONTEXT

This runs on a 2015 MacBook Pro (i7, 16GB RAM, Ubuntu Server 24.04 LTS) deployed via Docker Compose, exposed via Cloudflare Tunnel to blog.enderthoughts.com. The developer uses OpenMediaVault on a separate NAS (192.168.50.174), has a working Cloudflare Tunnel and Nginx Proxy Manager setup, and is experienced with Docker, Linux, and full-stack JS (Vue 3, Express.js, MySQL). Images built on Apple Silicon Mac must use --platform linux/amd64 for x86 deployment.

---

## STACK

- Frontend: Vue 3 + Vite + Vue Router + Pinia
- Backend: Node.js + Express.js
- Database: MySQL 8
- Auth: Firebase Authentication (Google OAuth only, via Firebase SDK on frontend) + custom JWT for session management on backend
- Image processing: sharp (resize + thumbnail on upload)
- Reverse proxy: Nginx (per-service container)
- Containerization: Docker Compose (db, api, frontend services)
- File storage: local bind mount to NAS path, configurable via .env

---

## ROLES & ACCESS CONTROL

There are three roles: admin, user, public.

### Registration & Approval Flow
1. User clicks "Sign in with Google" (Firebase Auth, frontend SDK)
2. On success, Firebase ID token is sent to backend POST /api/auth/firebase
3. Backend verifies token with Firebase Admin SDK, creates or finds user record
4. If NEW user: status = 'pending'. Return a session JWT with role: 'pending'
5. If EXISTING user: check status. If 'approved' → JWT with role: 'user'. If 'revoked' → 401 error "Access revoked". If 'pending' → JWT with role: 'pending'
6. Frontend reads JWT role and routes accordingly:
   - pending → /waiting page (friendly message: "Your account is pending admin approval")
   - approved user → full private access
   - revoked → shown error, logged out

Admin is a special role set directly in the database (no self-registration path to admin). Admin status is not obtainable through the UI — it must be set manually in MySQL: UPDATE users SET role='admin', status='approved' WHERE email='pablo@...';

### Access Matrix

PUBLIC (unauthenticated):
- View public photo feed (/): YES
- View photo detail: YES
- Login/register: YES
- All private areas: NO

PENDING (logged in, not yet approved):
- View public feed: YES
- Private areas: NO — redirect to /waiting

USER (approved):
- Analog zone: VIEW ONLY (browse galleries, view photos)
- Digital zone: VIEW + UPLOAD + CREATE MONTHLY GALLERY
- Admin panel: NO

ADMIN:
- All of the above PLUS:
- Analog zone: create galleries, upload photos, edit/delete everything
- Digital zone: all user permissions + moderate/delete
- Admin panel (/admin): full access — feed management, gallery management, tag taxonomy, user management

---

## APP ZONES

### 1. PUBLIC ZONE — /

No auth. Instagram-style photo feed.

Routes:
- GET / → masonry photo grid of photos where is_public = true, ordered by published_at desc, paginated
- GET /photo/:id → lightbox detail: full image, EXIF terminal readout, tags, badge [35mm] or [DIGITAL], camera/film info if analog
- GET /about → static markdown page
- GET /login → Google Sign-In button (Firebase Auth)
- GET /waiting → shown to pending users after login

### 2. PRIVATE — ANALOG — /analog

Auth required (any approved user can VIEW; only admin can WRITE).

Analog galleries represent film rolls. Each gallery has:
- Title (free text)
- Camera (text field, e.g. "Leica M6", "Pentax K1000")
- Film stock (text field, e.g. "Kodak Portra 400", "Ilford HP5")
- Tags (multi-select from global tag taxonomy)
- Month (select: Jan–Dec)
- Year (number input)
- Notes (optional textarea)

These metadata fields are displayed below the gallery title in a terminal-style readout on every gallery page.

Routes:
- GET /analog → list of all analog galleries (all approved users)
- GET /analog/:id → gallery detail: metadata readout + photo grid (all approved users)
- GET /analog/:id/photo/:photoId → lightbox with EXIF (all approved users)

Admin-only actions (buttons shown only to admin):
- POST /api/analog/galleries → create gallery
- PUT /api/analog/galleries/:id → edit gallery metadata
- DELETE /api/analog/galleries/:id → delete gallery and its photos
- POST /api/analog/galleries/:id/photos → upload photo(s), sharp pipeline
- DELETE /api/analog/photos/:id → delete photo
- POST /api/analog/photos/:id/publish → push photo to public feed with caption and tags

### 3. PRIVATE — DIGITAL — /digital

Auth required. All approved users can create galleries and upload.

Monthly galleries are always structured as YYYY-MM. The gallery name is always the formatted month and year (e.g. "June 2026"). No custom naming.

When a user navigates to /digital, they see a timeline of monthly galleries. If no gallery exists for the current month, a "Start June 2026 gallery" button appears for any approved user to create it. At most one gallery per YYYY-MM.

Routes:
- GET /digital → timeline of monthly galleries with cover photo + uploader count + photo count (all approved users)
- GET /digital/:yearMonth → gallery view, e.g. /digital/2026-06 (all approved users)
- POST /api/digital/galleries → create monthly gallery (approved user or admin; enforces uniqueness on year_month)
- POST /api/digital/galleries/:id/photos → upload photos directly OR via Google Photos Picker API
- DELETE /api/digital/photos/:id → delete own photo (or admin deletes any)
- DETAILS:
- ### Monthly Gallery Creation — UX & Conflict Behaviour

Each calendar month has at most ONE gallery, enforced by UNIQUE constraint on year_month.

Frontend behaviour on /digital:
- If a gallery for the current month ALREADY EXISTS → show "Add your photos" button (links to that gallery's upload view). No create button.
- If NO gallery exists for the current month → show "Start [Month Year] gallery" button for any approved user.
- The gallery list is a chronological timeline. Each month card shows: cover photo, display name (e.g. "June 2026"), photo count, and contributor count (distinct uploaded_by values).

POST /api/digital/galleries — { year_month, display_name }
- If year_month already exists: return 409 { error: "Gallery for this month already exists", code: "GALLERY_EXISTS", galleryId: <existing id> }
- Frontend on 409: do NOT show an error. Instead silently redirect the user to the existing gallery's upload view. From the user's perspective it just works — they end up in the right place regardless of whether they or someone else created it first.
- If year_month does not exist: create and redirect to the new gallery.

Inside a monthly gallery (/digital/2026-06):
- Any approved user sees all photos from all contributors.
- Each photo card shows uploader name + avatar below the thumbnail (e.g. "↑ Grandpa Rosa").
- Upload button is always visible to approved users — direct upload or Google Photos Picker.
- Admin additionally sees a delete button on each photo.

Google Photos Picker integration:
- Use Google Photos Picker API (OAuth2 scope photoslibrary.readonly)
- User authenticates in the frontend via Google OAuth popup
- Selected photos are fetched server-side using the access token (backend proxies the download to avoid CORS)
- Downloaded, sharp-resized, and stored like any other upload

### 4. ADMIN PANEL — /admin

Admin role only. Hard guard on both frontend (router) and backend (middleware).

Sub-sections:

/admin/feed — Instagram Feed Manager
- Table of all public photos (is_public = true): thumbnail, caption, tags, published_at, actions
- Toggle: publish / unpublish individual photos
- Edit caption and tags inline
- Reorder: drag-and-drop or manual sort_order integer field
- Bulk: select multiple → bulk unpublish or bulk delete
- "Add from library" button: pick any uploaded photo and publish it to the feed

/admin/analog — Analog Gallery Manager
- List all analog galleries with metadata summary
- Create new gallery (full form: title, camera, film stock, tags, month, year, notes)
- Edit existing gallery metadata
- Delete gallery (with confirmation modal showing photo count)
- Inside each gallery: manage photos — upload, delete, publish to feed, reorder

/admin/digital — Digital Gallery Manager
- List all monthly galleries
- View any gallery, delete photos, moderate content

/admin/tags — Tag Taxonomy Manager
- Global list of all tags used across galleries and photos
- Create new tag (name + optional color/emoji)
- Edit tag name
- Delete tag (with warning: "used in N galleries and M photos")
- Tag assignments are shown as usage counts

/admin/users — User Management
- Tab 1 — PENDING: list of users with status='pending', showing: name, email, Google profile photo, registered_at. Actions: [APPROVE] [REVOKE]. Approve sets status='approved' and role='user'. Revoke sets status='revoked'.
- Tab 2 — APPROVED: list of active users. Action: [REVOKE] — immediately blocks them.
- Tab 3 — REVOKED: list of revoked users. Action: [RESTORE] — sets back to approved.
- Count badge on the "PENDING" tab shows number of users awaiting approval.
- On new user registration, send admin a notification email (nodemailer).

---

## DATABASE SCHEMA

Provide migration SQL files in /db/migrations/ numbered sequentially.

Tables:

users:
  id INT AUTO_INCREMENT PK
  firebase_uid VARCHAR(128) UNIQUE NOT NULL
  email VARCHAR(255) UNIQUE NOT NULL
  name VARCHAR(255)
  avatar_url VARCHAR(500)
  role ENUM('admin','user') DEFAULT 'user'
  status ENUM('pending','approved','revoked') DEFAULT 'pending'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  approved_at TIMESTAMP NULL
  approved_by INT NULL FK users.id

tags:
  id INT AUTO_INCREMENT PK
  name VARCHAR(100) UNIQUE NOT NULL
  color VARCHAR(20) NULL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

analog_galleries:
  id INT AUTO_INCREMENT PK
  title VARCHAR(255) NOT NULL
  camera VARCHAR(255) NOT NULL
  film_stock VARCHAR(255) NOT NULL
  month TINYINT NOT NULL (1-12)
  year SMALLINT NOT NULL
  notes TEXT NULL
  created_by INT FK users.id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at TIMESTAMP

analog_gallery_tags: (junction)
  gallery_id INT FK
  tag_id INT FK
  PRIMARY KEY (gallery_id, tag_id)

photos:
  id INT AUTO_INCREMENT PK
  zone ENUM('analog','digital') NOT NULL
  analog_gallery_id INT NULL FK analog_galleries.id
  digital_gallery_id INT NULL FK digital_galleries.id
  filename VARCHAR(500) NOT NULL
  thumbnail VARCHAR(500) NOT NULL
  width INT
  height INT
  exif_json JSON NULL
  is_public BOOLEAN DEFAULT FALSE
  caption TEXT NULL
  sort_order INT DEFAULT 0
  uploaded_by INT FK users.id
  source ENUM('direct','google_photos') DEFAULT 'direct'
  google_photos_id VARCHAR(255) NULL
  published_at TIMESTAMP NULL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

photo_tags: (junction)
  photo_id INT FK
  tag_id INT FK
  PRIMARY KEY (photo_id, tag_id)

digital_galleries:
  id INT AUTO_INCREMENT PK
  year_month VARCHAR(7) NOT NULL UNIQUE (format: YYYY-MM)
  display_name VARCHAR(50) NOT NULL (e.g. "June 2026")
  cover_photo_id INT NULL FK photos.id
  created_by INT FK users.id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## API ROUTES

All routes return JSON. Errors: { error: string, code: string }
Auth middleware: verifyJWT (any valid JWT), requireApproved (status=approved), requireAdmin (role=admin)

Auth:
  POST /api/auth/firebase — { firebaseToken } → verify with Firebase Admin SDK → return JWT

Public:
  GET /api/photos — paginated public feed ?page=&limit=12
  GET /api/photos/:id — photo detail with tags and gallery info

Analog (GET routes: requireApproved; POST/PUT/DELETE: requireAdmin):
  GET /api/analog/galleries — list all galleries with tag array and photo count
  POST /api/analog/galleries — create (admin)
  GET /api/analog/galleries/:id — gallery detail + photos
  PUT /api/analog/galleries/:id — update metadata (admin)
  DELETE /api/analog/galleries/:id — delete gallery and photos (admin)
  POST /api/analog/galleries/:id/photos — upload (admin), multipart, sharp pipeline
  DELETE /api/analog/photos/:id — delete photo (admin)
  POST /api/analog/photos/:id/publish — push to public feed { caption, tagIds } (admin)
  PUT /api/analog/photos/:id/unpublish — remove from public feed (admin)

Digital (all requireApproved; delete own or admin):
  GET /api/digital/galleries — list monthly galleries
  POST /api/digital/galleries — create { year_month, display_name } (approved user or admin; unique constraint)
  GET /api/digital/galleries/:id — gallery detail + photos
  POST /api/digital/galleries/:id/photos — upload photos (direct or google_photos source)
  DELETE /api/digital/photos/:id — delete own photo (or admin)

Admin (all requireAdmin):
  GET /api/admin/feed — paginated public photos with full metadata
  PUT /api/admin/photos/:id — edit caption, tags, sort_order, is_public
  DELETE /api/admin/photos/:id — hard delete
  PUT /api/admin/photos/reorder — bulk { updates: [{id, sort_order}] }

  GET /api/admin/tags — all tags with usage counts
  POST /api/admin/tags — create { name, color }
  PUT /api/admin/tags/:id — update
  DELETE /api/admin/tags/:id — delete (cascades junction tables)

  GET /api/admin/users?status=pending|approved|revoked — user list
  PUT /api/admin/users/:id/approve — set status=approved, approved_by, approved_at
  PUT /api/admin/users/:id/revoke — set status=revoked
  PUT /api/admin/users/:id/restore — set status=approved

---

## IMAGE PIPELINE

Every upload (analog or digital, direct or Google Photos import):
1. Receive file buffer (Multer memoryStorage)
2. Extract EXIF with exifr library
3. sharp: resize to max 2400px on long edge, quality 85, save as JPEG to UPLOAD_PATH/full/
4. sharp: resize to max 400px on long edge, quality 80, thumbnail, save to UPLOAD_PATH/thumbs/
5. Store both relative paths in photos table
6. Return { id, filename, thumbnail, width, height, exif }

Upload debouncing: button disabled + visual feedback ("TRANSMITTING...") from submit until response. Frontend prevents double POST.

---

## PROJECT STRUCTURE

enderthoughts/
├── docker-compose.yml
├── .env.example
├── deploy.sh
├── db/
│   └── migrations/
│       ├── 001_create_users.sql
│       ├── 002_create_tags.sql
│       ├── 003_create_analog_galleries.sql
│       ├── 004_create_digital_galleries.sql
│       ├── 005_create_photos.sql
│       └── 006_create_junction_tables.sql
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── middleware/
│       │   ├── auth.js (verifyJWT, requireApproved, requireAdmin)
│       │   └── upload.js (multer config)
│       ├── routes/
│       │   ├── auth.js
│       │   ├── photos.js (public)
│       │   ├── analog.js
│       │   ├── digital.js
│       │   └── admin/
│       │       ├── feed.js
│       │       ├── tags.js
│       │       └── users.js
│       └── services/
│           ├── firebase.js (Admin SDK init + verifyIdToken)
│           ├── sharp.js (processUpload)
│           ├── googlePhotos.js (fetch via Picker token)
│           └── mailer.js (nodemailer, new user notification)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── main.js
        ├── router/index.js (guards for pending, approved, admin)
        ├── stores/
        │   ├── auth.js (useAuthStore: token, user, role, status)
        │   ├── photos.js
        │   ├── analog.js
        │   ├── digital.js
        │   └── admin.js
        ├── views/
        │   ├── Home.vue
        │   ├── PhotoDetail.vue
        │   ├── About.vue
        │   ├── Login.vue
        │   ├── Waiting.vue
        │   ├── analog/
        │   │   ├── GalleryList.vue
        │   │   ├── GalleryDetail.vue
        │   │   └── PhotoUpload.vue (admin only component)
        │   ├── digital/
        │   │   ├── MonthlyTimeline.vue
        │   │   ├── MonthlyGallery.vue
        │   │   └── GooglePhotosImport.vue
        │   └── admin/
        │       ├── AdminLayout.vue (sidebar nav with pending badge)
        │       ├── FeedManager.vue
        │       ├── AnalogManager.vue
        │       ├── DigitalManager.vue
        │       ├── TagManager.vue
        │       └── UserManager.vue (tabs: Pending/Approved/Revoked)
        └── components/
            ├── PhotoGrid.vue (masonry)
            ├── PhotoCard.vue (with zone badge)
            ├── Lightbox.vue
            ├── GalleryCard.vue
            ├── GalleryMeta.vue (terminal readout: camera, film, tags, month/year)
            ├── TagBadge.vue
            ├── UploadZone.vue (drag-drop, debounced)
            ├── UserRow.vue
            └── StatusBar.vue

---

## DOCKER

- All images: --platform linux/amd64
- deploy.sh: build all → docker compose down → docker compose up -d
- Bind mount $UPLOAD_PATH on host → /app/uploads in api container
- MySQL volume persisted
- Firebase service account JSON mounted into api container via volume (path configurable in .env as FIREBASE_SERVICE_ACCOUNT_PATH)

.env.example must cover:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
  JWT_SECRET
  FIREBASE_SERVICE_ACCOUNT_PATH
  GOOGLE_CLIENT_ID (for Photos Picker frontend)
  UPLOAD_PATH
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL
  VITE_API_BASE_URL
  VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID

---

## CODE QUALITY

- ESLint + Prettier
- All API errors return { error: string, code: string }
- Vue Router guards:
  - /analog, /digital: redirect to /login if no JWT; redirect to /waiting if status=pending
  - /admin/*: redirect to / if role is not admin
  - /waiting: only accessible if status=pending; redirect approved users to /
- Pinia useAuthStore persists JWT to localStorage; on app mount, verify token still valid against backend
- Upload: disable submit button on click, re-enable on error; show inline progress
- GalleryMeta component renders a terminal-style metadata readout:
  "// CAMERA: Leica M6 // FILM: Kodak Portra 400 // JUNE 2025 // [TAG1] [TAG2]"

---

## DELIVERABLES

Produce ALL of the following, complete and working (no stubs, no TODOs):
1. Full docker-compose.yml
2. .env.example
3. deploy.sh (with --platform linux/amd64 in build commands)
4. All DB migration SQL files
5. Complete API (/api/src/) — all routes, middleware, services
6. Complete Vue 3 frontend (/frontend/src/) — all views, stores, router, components
7. Both Dockerfiles
8. nginx.conf
9. SETUP.md — first-run instructions: Firebase project setup, set first admin in MySQL, run migrations, Docker deploy
