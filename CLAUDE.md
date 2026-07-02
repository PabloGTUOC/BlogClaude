# CLAUDE.md — enderthoughts

Private, retro-terminal-styled photo/video blog for family and friends. Public feed up front;
gated analog (film) and digital (monthly) galleries behind Google sign-in with role/group access.

## Commands

```bash
# API (from api/)
npm run dev        # nodemon; auto-runs DB migrations on boot
npm test           # vitest (no MySQL needed — db module is mocked)
npm run lint       # eslint

# Frontend (from frontend/)
npm run dev        # vite dev server on :5173
npm run build
npm run lint

# Full stack
docker compose up -d db          # just MySQL for local dev
./deploy.sh                      # production build + compose up
```

Copy `.env.example` → `.env` first. `JWT_SECRET` is required (API exits without it).
Local dev without Firebase credentials requires `ALLOW_MOCK_AUTH=true` (never in production).

## Architecture facts

- **Stack:** Vue 3 (Options API) + Vite + Pinia frontend; Express + MySQL 8 (`mysql2`) API;
  Firebase Auth (Google) exchanged for a custom 7-day JWT at `POST /api/auth/firebase`.
- **Auth middleware** (`api/src/middleware/auth.js`) re-reads role/status/group from the DB on
  every request — token claims are never trusted for authorization. Media requests (`/uploads`)
  authenticate via an HttpOnly cookie set at login (imgs can't send Bearer headers); everything
  else uses the Authorization header.
- **Media is NOT static.** `api/src/routes/media.js` checks per-photo access rules before
  serving any file. Never re-add `express.static` for uploads.
- **Migrations** live in `db/migrations/NNN_description.sql`, run automatically on API boot,
  tracked in `migrations_history`. Never edit an applied migration — add a new numbered file.
- **Media pipeline:** images → sharp (full 5000px + thumb 900px + small 320px JPEG, random hex filenames);
  videos → probed and stored as browser-safe H.264/AAC MP4 (remux or transcode as needed).
  Uploads stage on disk under `UPLOAD_PATH/tmp`, never in memory. Filenames must stay
  unguessable (crypto-random) — they are part of the access-control story.

## Access rules (the core invariant — don't regress these)

| Role | Public feed | Analog | Digital | Admin |
|---|---|---|---|---|
| anonymous / pending | ✅ | ❌ | ❌ | ❌ |
| friend (approved) | ✅ | published galleries tagged with **their `group`** only | ❌ | ❌ |
| family / legacy `user` (approved) | ✅ | published | family only | ❌ |
| admin | ✅ | all | all | ✅ |

- The `friends` tag grants nothing; only the user's `group` tag does. A friend with no group sees nothing.
- `admin` is set directly in MySQL; there is no UI path to it.
- EXIF GPS is stripped from responses to anonymous/pending viewers.
- These rules are pinned by `api/test/media.routes.test.js` and `api/test/middleware.auth.test.js` —
  run the tests after touching anything in `middleware/`, `routes/media.js`, or role logic.

## Conventions

- API errors are always `{ error, code }` JSON.
- CommonJS in `api/src`; tests are ESM but load src modules via `createRequire`
  (see `api/test/helpers/mockDb.js` for why).
- MySQL reserved words used as columns (`year_month`, `group`) need backticks.
- **Design identity is a hard constraint:** 1984-CRT retro-brutalist terminal aesthetic
  (see `PRODUCT.md`). Never restyle toward generic SaaS; no rounded corners, no soft shadows.
  Improve the existing system in place. `enderthoughts-styleguide.html` is the reference.

## Key documents

- `README.md` — full architecture and route map
- `SETUP.md` — Firebase/Google Cloud setup, deployment, backups
- `PRODUCT.md` — brand voice, anti-references, design principles
- `ENHANCEMENTS.md` — prioritized improvement backlog with status
- `deploy_pending.MD` — agreed Docker/deploy fixes not yet applied
