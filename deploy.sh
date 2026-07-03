#!/bin/bash
# ============================================================
# ENDERTHOUGHTS // BUILD-LOCAL, SHIP-REMOTE DEPLOYMENT
#
# Builds linux/amd64 images on this machine, streams them to the
# server over SSH, and (re)launches the stack there with Docker
# Compose. No git clone or image build happens on the server.
#
# Config lives in .env.production (gitignored). Password auth is
# fine: SSH connection sharing below means you type it ONCE.
#
# Usage:            ./deploy.sh
# First run only:   also copies docker-compose.yml, .env.production
#                   and the Firebase service-account JSON (always
#                   re-copied so config changes propagate too).
# ============================================================

set -euo pipefail
cd "$(dirname "$0")"

SERVER_USER="${SERVER_USER:-casa}"
SERVER_IP="${SERVER_IP:-192.168.50.210}"
REMOTE_DIR="/home/${SERVER_USER}/enderthoughts"
ENV_FILE=".env.production"

# Share one SSH connection across every ssh/scp below → one password prompt.
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$HOME/.ssh/deploy-%r@%h" -o ControlPersist=10m)

echo "=== ENDERTHOUGHTS // DEPLOY TO ${SERVER_USER}@${SERVER_IP} ==="

# ------------------------------------------------------------
# STEP 0: PRE-FLIGHT
# ------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. It holds the PRODUCTION config (origins," >&2
  echo "fresh secrets, server paths) — see .env.example for the schema." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Fail fast if any deploy-critical variable is missing.
: "${DB_PASS:?DB_PASS missing in $ENV_FILE}"
: "${DB_APP_PASS:?DB_APP_PASS missing in $ENV_FILE}"
: "${JWT_SECRET:?JWT_SECRET missing in $ENV_FILE}"
: "${UPLOAD_PATH:?UPLOAD_PATH missing in $ENV_FILE}"
: "${VITE_GOOGLE_CLIENT_ID:?VITE_GOOGLE_CLIENT_ID missing in $ENV_FILE}"
: "${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET missing in $ENV_FILE}"
: "${API_ORIGIN:?API_ORIGIN missing in $ENV_FILE}"
: "${FRONTEND_ORIGIN:?FRONTEND_ORIGIN missing in $ENV_FILE}"
# Frontend build args — a missing value bakes a broken bundle without any build error.
: "${VITE_API_BASE_URL:?VITE_API_BASE_URL missing in $ENV_FILE}"
: "${VITE_FIREBASE_API_KEY:?VITE_FIREBASE_API_KEY missing in $ENV_FILE}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?VITE_FIREBASE_AUTH_DOMAIN missing in $ENV_FILE}"
: "${VITE_FIREBASE_PROJECT_ID:?VITE_FIREBASE_PROJECT_ID missing in $ENV_FILE}"
: "${VITE_FIREBASE_APP_ID:?VITE_FIREBASE_APP_ID missing in $ENV_FILE}"

# Firebase admin JSON to ship (server path is set in $ENV_FILE)
FIREBASE_JSON_SRC="${FIREBASE_JSON_SRC:-$(ls ./*firebase-adminsdk*.json 2>/dev/null | head -1)}"
if [ -z "$FIREBASE_JSON_SRC" ] || [ ! -f "$FIREBASE_JSON_SRC" ]; then
  echo "ERROR: Firebase service-account JSON not found (set FIREBASE_JSON_SRC)." >&2
  exit 1
fi

# ------------------------------------------------------------
# STEP 1: BUILD IMAGES LOCALLY (linux/amd64)
# ------------------------------------------------------------
echo "=== STEP 1: BUILDING IMAGES (linux/amd64) ==="
# Repo-root context: the api image also packs db/migrations (outside api/)
docker build --platform linux/amd64 -t enderthoughts-api:latest -f api/Dockerfile .

docker build --platform linux/amd64 -t enderthoughts-frontend:latest \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  --build-arg VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" \
  --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
  --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
  --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
  ./frontend

# ------------------------------------------------------------
# STEP 2: SAVE + TRANSFER
# ------------------------------------------------------------
echo "=== STEP 2: SAVING IMAGES ==="
TMPDIR_LOCAL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT
docker save enderthoughts-api:latest      | gzip > "$TMPDIR_LOCAL/api.tar.gz"
docker save enderthoughts-frontend:latest | gzip > "$TMPDIR_LOCAL/frontend.tar.gz"
ls -lh "$TMPDIR_LOCAL"

echo "=== STEP 3: TRANSFERRING TO SERVER (one password prompt) ==="
ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_IP}" "mkdir -p '$REMOTE_DIR' '$UPLOAD_PATH/full' '$UPLOAD_PATH/thumbs'"
scp "${SSH_OPTS[@]}" \
  "$TMPDIR_LOCAL/api.tar.gz" \
  "$TMPDIR_LOCAL/frontend.tar.gz" \
  docker-compose.yml \
  "$ENV_FILE" \
  "$FIREBASE_JSON_SRC" \
  "${SERVER_USER}@${SERVER_IP}:$REMOTE_DIR/"

# ------------------------------------------------------------
# STEP 4: LOAD + LAUNCH ON SERVER
# Compose reads .env for ${...} interpolation; images are the ones
# we just loaded (image: tags in docker-compose.yml, --no-build).
# ------------------------------------------------------------
echo "=== STEP 4: LOADING IMAGES + LAUNCHING STACK ==="
ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_IP}" bash -s <<EOF
  set -euo pipefail
  cd '$REMOTE_DIR'
  mv -f '$(basename "$ENV_FILE")' .env
  mv -f '$(basename "$FIREBASE_JSON_SRC")' firebase-service-account.json
  chmod 600 .env firebase-service-account.json
  docker load < api.tar.gz
  docker load < frontend.tar.gz
  rm -f api.tar.gz frontend.tar.gz
  docker compose up -d --no-build
  echo "--- waiting for api health ---"
  for i in \$(seq 1 30); do
    state=\$(docker inspect --format '{{.State.Health.Status}}' enderthoughts-api 2>/dev/null || echo starting)
    [ "\$state" = "healthy" ] && break
    sleep 2
  done
  docker compose ps
  echo "--- last api log lines (migrations) ---"
  docker compose logs --tail=8 api
EOF

# Close the shared SSH connection.
ssh "${SSH_OPTS[@]}" -O exit "${SERVER_USER}@${SERVER_IP}" 2>/dev/null || true

echo "=== DEPLOYMENT COMPLETED ==="
echo "Frontend is on ${SERVER_IP}:8080 (point the NAS nginx at it)."
echo "Tail logs with: ssh ${SERVER_USER}@${SERVER_IP} 'cd $REMOTE_DIR && docker compose logs -f api'"
