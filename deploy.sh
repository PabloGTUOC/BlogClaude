#!/bin/bash
# ============================================================
# ENDERTHOUGHTS // COMPILING & DEPLOYMENT UTILITY
# Builds linux/amd64 images and (re)launches the stack via Docker Compose.
# ============================================================

set -euo pipefail

# Always run from the repository root (where this script lives)
cd "$(dirname "$0")"

echo "=== ENDERTHOUGHTS // DEPLOYMENT ==="

# ------------------------------------------------------------
# STEP 0: PRE-FLIGHT CHECKS
# ------------------------------------------------------------
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

# Load .env into the shell so we can validate required values before building.
# (Docker Compose also auto-reads .env for ${...} interpolation in the compose file.)
set -a
# shellcheck disable=SC1091
source .env
set +a

# Fail fast if any deploy-critical variable is missing.
: "${DB_PASS:?DB_PASS missing in .env}"
: "${DB_APP_PASS:?DB_APP_PASS missing in .env (least-privilege DB user password)}"
: "${JWT_SECRET:?JWT_SECRET missing in .env}"
: "${UPLOAD_PATH:?UPLOAD_PATH missing in .env}"
: "${VITE_GOOGLE_CLIENT_ID:?VITE_GOOGLE_CLIENT_ID missing in .env}"
: "${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET missing in .env}"
: "${API_ORIGIN:?API_ORIGIN missing in .env}"
: "${FRONTEND_ORIGIN:?FRONTEND_ORIGIN missing in .env}"
# Frontend build args — a missing value bakes a broken bundle without any build error.
: "${VITE_API_BASE_URL:?VITE_API_BASE_URL missing in .env}"
: "${VITE_FIREBASE_API_KEY:?VITE_FIREBASE_API_KEY missing in .env}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?VITE_FIREBASE_AUTH_DOMAIN missing in .env}"
: "${VITE_FIREBASE_PROJECT_ID:?VITE_FIREBASE_PROJECT_ID missing in .env}"
: "${VITE_FIREBASE_APP_ID:?VITE_FIREBASE_APP_ID missing in .env}"

# Ensure the host upload directory exists (bind-mounted into the api container).
mkdir -p "${UPLOAD_PATH}/full" "${UPLOAD_PATH}/thumbs"

# ------------------------------------------------------------
# STEP 1: BUILD IMAGES
# Dockerfiles pin FROM --platform=linux/amd64, so images are amd64 regardless of host.
# VITE_* values are passed as build args (see docker-compose.yml) and baked into the bundle.
# The api image downloads the bundled ffmpeg/ffprobe binaries during npm install.
# ------------------------------------------------------------
echo "=== STEP 1: BUILDING IMAGES (linux/amd64) ==="
docker compose build --pull

# ------------------------------------------------------------
# STEP 2: SHUT DOWN ANY RUNNING STACK
# ------------------------------------------------------------
echo "=== STEP 2: SHUTTING DOWN ACTIVE INSTANCES ==="
docker compose down || true

# ------------------------------------------------------------
# STEP 3: LAUNCH
# DB migrations run automatically on API boot (see api/src/services/migrations.js).
# ------------------------------------------------------------
echo "=== STEP 3: LAUNCHING ORCHESTRATION DAEMON ==="
docker compose up -d

echo "=== STEP 4: STATUS ==="
docker compose ps

echo "=== DEPLOYMENT COMPLETED ==="
echo "Migrations apply automatically on API boot. Tail logs with: docker compose logs -f api"
