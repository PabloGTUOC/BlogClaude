# DEPLOY / DOCKER — PENDING ACTIONS

Handoff from the Docker & deploy review. Nothing below has been applied yet — these are
the agreed fixes to make next session. Ordered by priority. Each item has the file, the
problem, and the concrete change.

Files reviewed: `docker-compose.yml`, `deploy.sh`, `api/Dockerfile`, `frontend/Dockerfile`,
`frontend/nginx.conf`, `.env.example`.

---

## P1 — do first (low risk, one is a latent build-breaker)

### 1. Add `.dockerignore` files
**Why:** `frontend/Dockerfile` does `RUN npm ci` then `COPY . .` with no `.dockerignore`.
`frontend/` has local `node_modules` (macOS/arm64) + `dist`, so the build context copies the
wrong-arch `node_modules` over the freshly-installed linux one → `npm run build` fails on
linux/amd64. Also risks baking a stray `.env` into an image layer and bloats the context.

Create `frontend/.dockerignore`:
```
node_modules
dist
.env
.env.*
.git
.DS_Store
npm-debug.log*
```

Create `api/.dockerignore`:
```
node_modules
.env
.env.*
.git
uploads
.DS_Store
```

---

## P2 — security & correctness

### 2. Stop publishing MySQL to the host — `docker-compose.yml:12-13`
Only `api` needs the DB, over the internal compose network (`DB_HOST: db`).
**Change:** remove the `ports:` block on the `db` service (or, if host debugging wanted,
use `"127.0.0.1:3306:3306"`).

### 3. Don't run the app as MySQL `root` — `.env.example:9`, `docker-compose.yml` db service
Currently `DB_USER=root` and compose only sets `MYSQL_ROOT_PASSWORD`/`MYSQL_DATABASE`.
**Change:** add a least-privilege user to the `db` service env and point the app at it:
```yaml
db:
  environment:
    MYSQL_ROOT_PASSWORD: ${DB_PASS}
    MYSQL_DATABASE: ${DB_NAME}
    MYSQL_USER: ${DB_USER}        # e.g. enderthoughts
    MYSQL_PASSWORD: ${DB_APP_PASS}
```
Update `.env.example`: `DB_USER=enderthoughts` + new `DB_APP_PASS=...`, and make the api use
`DB_USER`/`DB_APP_PASS`. NOTE: `MYSQL_USER`/`MYSQL_PASSWORD` only take effect on a FRESH data
volume — existing `mysql-data` volume must be recreated or the user added manually.

### 4. Add DB healthcheck + gate the api — `docker-compose.yml:45-46`
`depends_on: [db]` waits for container start, not DB readiness → migration boot race.
**Change:**
```yaml
db:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p$$MYSQL_ROOT_PASSWORD"]
    interval: 5s
    timeout: 5s
    retries: 10
api:
  depends_on:
    db:
      condition: service_healthy
```

### 5. Fix personal path in `.env.example:33`
`UPLOAD_PATH=/Users/pablogtorres/Desktop/Projects/BlogClaude/uploads` is a macOS path leaking
into a Linux-target example.
**Change:** `UPLOAD_PATH=/srv/enderthoughts/uploads` (or `./uploads`).

### 6. Run containers as non-root — `api/Dockerfile`
No `USER`; api writes bind-mounted `uploads/` as root.
**Change:** add a non-root user before `CMD`, e.g.:
```dockerfile
RUN useradd -m -u 1001 app && mkdir -p /app/uploads && chown -R app:app /app
USER app
```
(nginx-alpine already runs workers as `nginx`, so frontend is lower priority.)

---

## P3 — polish / hardening

- **Remove `version: '3.8'`** — `docker-compose.yml:1` (obsolete in Compose v2, warns).
- **Trim api build toolchain** — `api/Dockerfile:4-8` keeps `python3/make/g++` in the runtime
  image. `sharp` ships prebuilt binaries for `node:20-slim`; try removing them. If a native
  build is genuinely needed, use multi-stage so they don't reach the final image.
- **nginx hardening** — `frontend/nginx.conf`: make `index.html` no-cache (hashed assets are
  already cached 1y, so the shell can go stale), add gzip + security headers:
  ```nginx
  location = /index.html { add_header Cache-Control "no-cache"; }
  gzip on; gzip_types text/css application/javascript image/svg+xml; gzip_min_length 1024;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  ```
  (Skip headers if the reverse proxy / NPM already injects them.)
- **Add `HEALTHCHECK`** to the api image (e.g. `curl -f http://localhost:3000/health` —
  verify such a route exists first).
- **Pin base images by digest** — `node:20-slim`, `nginx:stable-alpine`, `mysql:8.0` float.
- **deploy.sh validation** — `deploy.sh:30-35` validates backend vars but not the
  `VITE_FIREBASE_*` / `FRONTEND_ORIGIN` build args (a missing Firebase key silently bakes a
  broken auth config). Add them to the `:?` checks; consider `docker compose build --pull`.
- **Bind published api/frontend ports to `127.0.0.1`** if NPM/tunnel is on the same host.
- **Widen uploads .gitignore** — `.gitignore:149-150` only ignores `*IMG_*.jpg`; consider
  ignoring `uploads/` wholesale except a `.gitkeep`.

---

## What's already good (don't touch)
- Frontend multi-stage build → tiny nginx runtime, no Node.
- api Dockerfile copies only `package*.json` + `src/` (selective).
- `deploy.sh`: `set -euo pipefail`, fail-fast var validation, ensures upload dirs, idempotent
  down/up, DB data persists via named `mysql-data` volume.
- `.env` / `.env.*` gitignored and `.env` untracked; VITE public values documented as non-secret.

---

## Suggested order of execution next session
1. P1 `.dockerignore` (both files) — unblocks clean builds.
2. P2 compose changes that don't touch the data volume: remove DB `ports`, drop `version`,
   add healthcheck + `depends_on: condition`.
3. P2 `.env.example` path fix.
4. P2 non-root DB user (NOTE the fresh-volume caveat) + api `USER` — needs a test deploy.
5. P3 batch.
6. **Verify:** `docker compose build` then `docker compose up -d`, check `docker compose ps`
   and `docker compose logs -f api` (migrations run on api boot). Confirm uploads write and
   auth works end-to-end.

## Context notes
- Target host: Linux behind Cloudflare Tunnel / Nginx Proxy Manager; images built amd64
  (`FROM --platform=linux/amd64`) from Apple Silicon.
- App talks to the API directly via `VITE_API_BASE_URL` (not proxied through the frontend
  nginx), so CORS relies on `FRONTEND_ORIGIN` — keep that in mind for any nginx changes.
- Full review rationale lives in the session transcript; this file is the actionable subset.
